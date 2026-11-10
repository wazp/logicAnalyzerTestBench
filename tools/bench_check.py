#!/usr/bin/env python3
"""Checks a real test bench against the firmware's own model, using a gusmanb LogicAnalyzer.

For each preset it switches the board through its USB console, takes captures
with the analyzer's TerminalCapture command line tool, and compares every
sample against the frame the firmware plays (tools/export_frame.cpp, built
from the same frame builders and timeline encoder). GP0-GP9 and GP26 are
compared against web/src/data/signals.json.

Three checks per capture, after aligning it to the frame and fitting the
clock difference between analyzer and board:
  - every sample that is not right next to an expected edge has the expected level;
  - every edge with room around it lands within one sample (plus input skew) of its expected time;
  - every frame window (one transaction, fault or burst) that fits in the capture has exactly the
    expected number of edges on each pin, when its shortest pulse is at least one sample long.

Developer tooling for the analyzer the maintainer owns; the guide itself stays analyzer neutral.
Needs pyserial, the host build (build-tests/export_frame) and TerminalCapture.

  tools/bench_check.py                       # all presets, then back to the one that was active
  tools/bench_check.py faults verify         # only these
  tools/bench_check.py --keep-captures DIR   # keep the .tcs/.csv files
"""

import argparse
import bisect
import csv
import glob
import json
import os
import random
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass, field

import serial

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPORT_FRAME = os.path.join(REPO, 'build-tests', 'export_frame')
SIGNALS_JSON = os.path.join(REPO, 'web', 'src', 'data', 'signals.json')
TERMINAL_CAPTURE = '/opt/logicanalyzer/current/TerminalCapture'

PRESETS = ['protocols', 'video', 'faults', 'verify']
TITLES = {'protocols': 'Protocols', 'video': 'Video and input', 'faults': 'Faults', 'verify': 'Verify'}
TIMELINE = list(range(10, 23))
BASIC = list(range(0, 10)) + [26]

# Found by trial on a PCB 6.0 analyzer: a capture over these limits hangs
# instead of failing. A channel above 7 switches it to its 24-channel mode,
# and the pre-trigger part may be about a tenth of the buffer at most.
# Rates are whole fractions of 100 MHz: others come from a fractional clock
# divider and run a few hundred ppm off (24 MS/s measured -309 ppm).
MAX_RATE = 100_000_000
SKEW_NS = 20  # Allowed input skew and jitter on top of the sample quantization.
MAX_PPM = 100  # Two crystals, each good to about 30 ppm.
# GP5 (100 kHz) goes into every capture, so zero padding before the trigger
# (see Analyzer.capture) can be told from real data.
LIVENESS_GPIO = 5


def max_samples(channels):
    return 390_000 if max(channels) < 8 else 90_000


def max_pre(channels):
    return max_samples(channels) // 18


# ---------------------------------------------------------------- expected waveforms

@dataclass
class Pin:
    gpio: int
    times: list  # Toggle times in ns, in [0, period), sorted. A change at the frame wrap is at 0.
    after: list  # Level after each toggle.
    end_level: int  # Level just before time 0.

    def level(self, f):
        i = bisect.bisect_right(self.times, f)
        return self.after[i - 1] if i else self.end_level

    def distance(self, f, period):
        """Distance from frame time f to the nearest edge, across the frame wrap."""
        if not self.times:
            return float('inf')
        i = bisect.bisect_left(self.times, f)
        a = self.times[i - 1] if i > 0 else self.times[-1] - period
        b = self.times[i] if i < len(self.times) else self.times[0] + period
        return min(f - a, b - f)


def make_pin(gpio, initial, toggles_ns):
    after = [initial ^ ((k + 1) & 1) for k in range(len(toggles_ns))]
    end = after[-1] if after else initial
    times = list(toggles_ns)
    if end != initial:
        times = [0.0] + times
        after = [initial] + after
    return Pin(gpio, times, after, end)


@dataclass
class Window:
    name: str
    start: float
    end: float


@dataclass
class Group:
    """Pins that share one time base and are aligned together."""
    name: str
    period: float
    pins: dict
    windows: list = field(default_factory=list)


def timeline_group(preset):
    with tempfile.NamedTemporaryFile(suffix='.json') as tmp:
        subprocess.run([EXPORT_FRAME, preset, tmp.name], check=True)
        d = json.load(open(tmp.name))
    ns = 1e9 / d['sysHz']
    pins = {p['gpio']: make_pin(p['gpio'], p['initial'], [t * ns for t in p['toggles']]) for p in d['pins']}
    windows = [Window(f"{w['protocol']} {w['label']} at {w['start'] * ns / 1e6:.3f} ms", w['start'] * ns,
                      w['end'] * ns) for w in d['windows']]
    return Group(TITLES[preset], d['frameCycles'] * ns, pins, windows)


def basic_groups():
    """One group per pin: GP0-GP9 and GP26 run on separate peripherals with no fixed phase."""
    groups = []
    for s in json.load(open(SIGNALS_JSON))['signals']:
        t, toggles, level = 0.0, [], s['segments'][0]['level']
        for seg in s['segments']:
            if seg['level'] != level:
                toggles.append(t)
                level = seg['level']
            t += seg['ns']
        initial = s['segments'][0]['level']
        groups.append(Group(f"GP{s['gpio']} {s['name']}", t, {s['gpio']: make_pin(s['gpio'], initial, toggles)}))
    return groups


# ---------------------------------------------------------------- devices

def find_port(pattern, what):
    ports = glob.glob(f'/dev/serial/by-id/*{pattern}*')
    if not ports:
        sys.exit(f'{what} not found (/dev/serial/by-id/*{pattern}*)')
    return ports[0]


class Bench:
    def __init__(self, port):
        self.port = port

    def _open(self, wait=20.0):
        deadline = time.time() + wait
        while True:
            try:
                s = serial.Serial(self.port, 115200, timeout=0.2)
                time.sleep(0.5)
                return s
            except (serial.SerialException, OSError):
                if time.time() > deadline:
                    raise
                time.sleep(0.5)

    @staticmethod
    def _read(s, seconds):
        out, end = b'', time.time() + seconds
        while time.time() < end:
            out += s.read(4096)
        return out.decode(errors='replace')

    def active(self):
        with self._open() as s:
            s.reset_input_buffer()
            s.write(b'p')
            menu = self._read(s, 0.8)
            s.write(b'x')  # Cancels the menu.
            self._read(s, 0.3)
        for line in menu.splitlines():
            if '(active)' in line:
                for p in PRESETS:
                    if TITLES[p] in line:
                        return p
        sys.exit(f'could not read the active preset from the console:\n{menu}')

    def switch(self, preset):
        if self.active() == preset:
            return
        with self._open() as s:
            s.write(b'p')
            self._read(s, 0.5)
            s.write(str(PRESETS.index(preset) + 1).encode())
            self._read(s, 1.0)
        time.sleep(3)  # The board restarts and enumerates again.
        if self.active() != preset:
            sys.exit(f'the board did not switch to {TITLES[preset]}')
        time.sleep(1)


@dataclass
class Capture:
    rate: int
    pre: int
    levels: dict  # gpio -> bytes, one level per sample
    trigger: int
    _transitions: dict = field(default_factory=dict)

    @property
    def dt(self):
        return 1e9 / self.rate

    @property
    def length(self):
        return len(next(iter(self.levels.values())))

    def transitions(self, gpio):
        """(index of the first sample at the new level, new level) for every change."""
        if gpio not in self._transitions:
            v = self.levels[gpio]
            self._transitions[gpio] = [(i, v[i]) for i in range(1, len(v)) if v[i] != v[i - 1]]
        return self._transitions[gpio]


class Analyzer:
    def __init__(self, port, channel_of, keep_dir):
        self.port = port
        self.channel_of = channel_of
        self.dir = keep_dir or tempfile.mkdtemp(prefix='bench_check_')
        self.count = 0

    def capture(self, gpios, rate, samples, pre, trigger, rising):
        assert rate <= MAX_RATE and 100_000_000 % rate == 0, f'{rate} is not a whole fraction of 100 MHz'
        if LIVENESS_GPIO not in gpios:
            gpios = gpios + [LIVENESS_GPIO]
        channels = [self.channel_of[g] for g in gpios]
        samples = min(samples, max_samples(channels))
        pre = min(pre, max_pre(channels))
        self.count += 1
        base = os.path.join(self.dir, f'capture{self.count:03d}')
        settings = {
            'Frequency': rate, 'PreTriggerSamples': pre, 'PostTriggerSamples': samples - pre, 'LoopCount': 0,
            'MeasureBursts': False, 'Bursts': None, 'TriggerType': 0, 'TriggerChannel': self.channel_of[trigger],
            'TriggerInverted': not rising, 'TriggerBitCount': 0, 'TriggerPattern': 0,
            'CaptureChannels': [{'TextualChannelNumber': f'Channel {c + 1}', 'ChannelNumber': c,
                                 'ChannelName': f'GP{g}', 'ChannelColor': None, 'Hidden': False, 'Samples': None}
                                for g, c in zip(gpios, channels)],
        }
        json.dump(settings, open(base + '.tcs', 'w'))
        if os.path.exists(base + '.csv'):
            os.remove(base + '.csv')
        try:
            subprocess.run([TERMINAL_CAPTURE, 'capture', self.port, base + '.tcs', base + '.csv'],
                           capture_output=True, timeout=10 + 2 * samples / rate, check=True)
        except subprocess.TimeoutExpired:
            return None  # No trigger, or settings the analyzer refused.
        with open(base + '.csv') as f:
            rows = csv.reader(f)
            names = next(rows)
            cols = list(zip(*[[int(x) for x in r] for r in rows]))
        # When the trigger comes before the pre-trigger part has filled, the
        # analyzer pads its start with zeros on every channel. Drop them; with
        # GP5 in the capture this loses at most 5 us of real data.
        start = 0
        while start < pre and not any(c[start] for c in cols):
            start += 1
        levels = {int(n[2:]): bytes(c[start:]) for n, c in zip(names, cols)}
        return Capture(rate, pre - start, levels, trigger)


# ---------------------------------------------------------------- comparison

@dataclass
class Result:
    errors: list = field(default_factory=list)
    timed: set = field(default_factory=set)  # (gpio, frame time) of edges verified to the sample
    counted: set = field(default_factory=set)  # window names whose edge count was checked
    offset: float = 0.0
    ppm: float = 0.0
    worst_ns: float = 0.0
    edges: int = 0


def min_gap(pin, period):
    """Shortest time between two edges of a pin, across the frame wrap."""
    t = pin.times
    if len(t) < 2:
        return period
    return min(b2 - a2 for a2, b2 in zip(t, t[1:] + [t[0] + period]))


def align(group, cap):
    """Frame time of the capture's first sample, from the transition nearest the trigger."""
    gpios = [g for g in group.pins if g in cap.levels]
    # Only a pin whose pulses all span two samples can anchor: shorter ones
    # alias into edges that are not where the pin's real edges are.
    usable = [g for g in gpios if cap.transitions(g) and min_gap(group.pins[g], group.period) >= 2 * cap.dt]
    anchor = cap.trigger if cap.trigger in usable else next(iter(usable), None)
    if anchor is None:
        return None
    idx, lvl = min(cap.transitions(anchor), key=lambda t: abs(t[0] - cap.pre))
    tau = (idx - 0.5) * cap.dt
    pin = group.pins[anchor]
    # Score each candidate on samples near the anchor, where clock drift is still negligible.
    span = int(min(max(400e3, 200 * cap.dt), group.period / 2) / cap.dt)
    lo, hi = max(0, idx - span), min(cap.length, idx + span)
    step = max(1, (hi - lo) // 80)
    points = range(lo, hi, step)
    guard = 1.5 * cap.dt + 30
    scored = []
    for e, a in zip(pin.times, pin.after):
        if a != lvl:
            continue
        off = e - tau
        score = 0
        for g in gpios:
            p, v = group.pins[g], cap.levels[g]
            for i in points:
                f = (off + i * cap.dt) % group.period
                if p.distance(f, group.period) > guard and p.level(f) != v[i]:
                    score += 1
        scored.append((score, off))
    if not scored:
        return None
    # The Faults preset repeats transactions with one bit changed, so several
    # places can look right near the anchor. Settle ties on the whole capture.
    low = min(s for s, _ in scored)
    tied = [off for s, off in scored if s == low]
    if len(tied) == 1:
        return tied[0]
    return min(tied, key=lambda off: misfit(group, cap, gpios, off, tau))


def misfit(group, cap, gpios, off, tau_anchor):
    """Captured edges with no expected edge near them, plus the reverse, for one alignment."""
    count = 0
    for g in gpios:
        pin = group.pins[g]
        trans = cap.transitions(g)
        taus = [(i - 0.5) * cap.dt for i, _ in trans]
        for tau in taus:
            tol = cap.dt + SKEW_NS + MAX_PPM * 1e-6 * abs(tau - tau_anchor)
            if pin.distance((off + tau) % group.period, group.period) > tol:
                count += 1
        end = cap.length * cap.dt
        for u, _ in unwrapped_edges(pin, group.period, off, off + end):
            tau = u - off
            tol = cap.dt + SKEW_NS + MAX_PPM * 1e-6 * abs(tau - tau_anchor)
            j = bisect.bisect_left(taus, tau - tol)
            if j == len(taus) or taus[j] > tau + tol:
                count += 1
    return count


def unwrapped_edges(pin, period, f0, f1):
    """Expected edges with frame time in [f0, f1], not wrapped, as (time, level after)."""
    out = []
    k = int(f0 // period) - 1
    while k * period <= f1:
        for t, a in zip(pin.times, pin.after):
            u = t + k * period
            if f0 <= u <= f1:
                out.append((u, a))
        k += 1
    return out


def compare(group, cap):
    r = Result()
    gpios = [g for g in group.pins if g in cap.levels]
    dt, n = cap.dt, cap.length
    for g in gpios:
        if cap.transitions(g):
            continue
        p = group.pins[g]
        gaps = [b2 - a2 for a2, b2 in zip(p.times, p.times[1:] + [p.times[0] + group.period])] if p.times else []
        # A pin with a pulse shorter than a sample may legitimately show nothing.
        if gaps and min(gaps) >= dt and max(gaps) < n * dt:
            r.errors.append(f'GP{g} never changes, but should every {max(gaps) / 1e6:.3f} ms at most')
    off = align(group, cap)
    if off is None:
        return r
    match = dt + 60

    # Pair captured transitions with isolated expected edges, then fit capture time = a + b * frame time.
    pairs = []
    for g in gpios:
        pin = group.pins[g]
        exp = unwrapped_edges(pin, group.period, off - match, off + n * dt + match)
        times = [u for u, _ in exp]
        for idx, lvl in cap.transitions(g):
            tau = (idx - 0.5) * dt
            u0 = off + tau
            j = bisect.bisect_left(times, u0)
            cands = [k for k in (j - 1, j) if 0 <= k < len(exp)]
            if not cands:
                continue
            k = min(cands, key=lambda k: abs(times[k] - u0))
            # Wide matching window at first; drift grows with distance from the anchor.
            if abs(times[k] - u0) > match + MAX_PPM * 1e-6 * n * dt or exp[k][1] != lvl:
                continue
            gap_before = times[k] - times[k - 1] if k > 0 else float('inf')
            gap_after = times[k + 1] - times[k] if k + 1 < len(times) else float('inf')
            if min(gap_before, gap_after) > 2 * dt:
                pairs.append((times[k], tau, g))
    # A drift fit needs edges spread over a long enough stretch; a single pulse would give nonsense.
    spread = max(u for u, _, _ in pairs) - min(u for u, _, _ in pairs) if pairs else 0
    if len(pairs) >= 10 and spread >= 500e3:
        mu = sum(u for u, _, _ in pairs) / len(pairs)
        mt = sum(t for _, t, _ in pairs) / len(pairs)
        var = sum((u - mu) ** 2 for u, _, _ in pairs)
        b = sum((u - mu) * (t - mt) for u, t, _ in pairs) / var if var > 0 else 1.0
        a = mt - b * mu
    else:
        # Keep the alignment on the trigger edge: averaging two edges of one
        # pulse would hide a wrong width by splitting it between them.
        b = 1.0
        a = -off
    r.ppm = (b - 1) * 1e6
    r.offset = (-a / b) % group.period
    if abs(r.ppm) > MAX_PPM:
        r.errors.append(f'clock difference of {r.ppm:.0f} ppm: misaligned capture or wrong frequency')

    def frame_time(tau):
        return (tau - a) / b

    # Timing of every isolated edge. A sample shows an edge up to one sample
    # late, and the fitted line shares that error between edges unevenly when
    # drift moves some of them across a sample boundary during the capture.
    tol = dt + SKEW_NS
    for u, tau, g in pairs:
        err = tau - (a + b * u)
        r.worst_ns = max(r.worst_ns, abs(err))
        if abs(err) > tol:
            r.errors.append(f'GP{g} edge at {(u % group.period) / 1e6:.6f} ms is {err:+.0f} ns off')
        else:
            r.timed.add((g, round(u % group.period, 1)))
    r.edges = len(pairs)

    # Every sample away from an expected edge has the expected level.
    guard = dt + SKEW_NS
    for g in gpios:
        pin, v = group.pins[g], cap.levels[g]
        run_start, last_bad = None, None
        for i in range(n):
            f = frame_time(i * dt) % group.period
            bad = pin.distance(f, group.period) > guard and pin.level(f) != v[i]
            if bad and run_start is None:
                run_start = i
            if bad:
                last_bad = i
            if run_start is not None and (not bad or i == n - 1):
                f0 = frame_time(run_start * dt) % group.period
                r.errors.append(f'GP{g} reads {v[run_start]} instead of {1 - v[run_start]} at {f0 / 1e6:.6f} ms '
                                f'for {(last_bad - run_start + 1) * dt:.0f} ns')
                run_start = None
                if len(r.errors) > 40:
                    r.errors.append('more mismatches not shown')
                    return r

    # Edge count of every window that fits, when the analyzer can see every pulse in it.
    t0, t1 = frame_time(0), frame_time((n - 1) * dt)
    margin = guard + dt
    for w in group.windows:
        k = int((t0 - w.start) // group.period) + 1
        start, end = w.start + k * group.period, w.end + k * group.period
        if start - margin < t0 or end + margin > t1:
            continue
        ok = True
        checks = []
        for g in gpios:
            exp = [u for u, _ in unwrapped_edges(group.pins[g], group.period, start - margin, end + margin)]
            inside = [u for u in exp if start <= u <= end]
            if len(inside) != len(exp):
                ok = False  # Another transaction's edges sit in the margin.
                break
            if any(b2 - a2 < dt for a2, b2 in zip(exp, exp[1:])):
                ok = False  # A pulse shorter than a sample may be missed: not countable at this rate.
                break
            i0 = int((a + b * (start - margin)) / dt) + 1
            i1 = int((a + b * (end + margin)) / dt)
            got = sum(1 for idx, _ in cap.transitions(g) if i0 <= idx <= i1)
            checks.append((g, len(exp), got, exp))
        if not ok:
            continue
        r.counted.add(w.name)
        for g, want, got, exp in checks:
            if got != want:
                r.errors.append(f'{w.name}: GP{g} has {got} edges, expected {want}')
            else:
                r.timed.update((g, round(u % group.period, 1)) for u in exp)
    return r


# ---------------------------------------------------------------- what to capture

@dataclass
class Job:
    name: str
    gpios: list
    rate: int
    trigger: int
    rising: bool = False
    pre: int = 1000
    samples: int = 90_000
    repeat: int = 1
    until: tuple = ()  # Repeat (up to `repeat` times) until every window of these protocols is counted.
    triggers: tuple = ()  # Rotate through these (gpio, rising) instead.


DETAIL = 25_000_000

JOBS = {
    'protocols': [
        Job('whole frame', TIMELINE, 625_000, 17, pre=100),
        Job('detail', TIMELINE, DETAIL, 17, repeat=12, until=('spi', 'ws2812', 'i2c', 'uart'),
            triggers=((17, False), (18, True), (12, False), (10, False), (11, False))),
    ],
    'video': [
        Job('whole frame', TIMELINE, 2_500_000, 11, pre=100),
        Job('detail', TIMELINE, DETAIL, 15, rising=True, repeat=8, until=('nes', 'ps2'),
            triggers=((15, True), (18, False))),
    ],
    'faults': [
        Job('whole frame', TIMELINE, 625_000, 20, pre=100),
        Job('detail', TIMELINE, DETAIL, 17, repeat=30,
            until=('uart', 'parity', 'i2c', 'spi', 'ws2812', 'onewire'),
            triggers=((10, False), (11, False), (12, False), (17, False), (18, True), (19, False))),
        Job('glitches', [20], MAX_RATE, 20, repeat=60, until=('irq',)),
    ],
    'verify': [
        # Each capture holds 3.6 ms of the 8.192 ms frame; the top counter bits
        # (GP21 changes at 0 and 4.096 ms, GP20 every 2.048 ms) place them.
        Job('counter', TIMELINE, DETAIL, 21, repeat=6, pre=5000,
            triggers=((21, False), (21, True), (20, True), (20, False), (20, True), (20, False))),
        Job('bursts', [22], MAX_RATE, 22, rising=True, pre=1000),
    ],
}

BASIC_JOBS = [
    Job('slow', BASIC, 10_000, 2, rising=True, pre=100),
    Job('fast', BASIC, 10_000_000, 3, rising=True, pre=100),
    Job('pulse', [8], MAX_RATE, 8, rising=True, pre=1000, samples=200_000),
]


def window_coverage(group, timed):
    rows = []
    for w in group.windows:
        edges = [(g, round(t, 1)) for g, p in group.pins.items() for t in p.times if w.start <= t <= w.end]
        if edges:
            done = sum(1 for e in edges if e in timed)
            rows.append((w.name, done, len(edges)))
    return rows


def kind(window):
    """'spi jedec_id at 4.000 ms' -> 'spi jedec_id'. Faults differ in label, so each fault is its own kind."""
    return window.name.split(' at ')[0]


def run_jobs(analyzer, groups, jobs, verbose):
    problems, timed, counted = [], {id(g): set() for g in groups}, set()
    for job in jobs:
        for attempt in range(job.repeat):
            # Identical transactions repeat through the frame: one counted copy of each kind is enough.
            kinds = {kind(w) for g in groups for w in g.windows if w.name.split()[0] in job.until}
            if job.until and kinds <= {kind(w) for g in groups for w in g.windows if w.name in counted}:
                break
            trig, rising = job.triggers[attempt % len(job.triggers)] if job.triggers else (job.trigger, job.rising)
            # Each capture takes about the same time, so without this the
            # trigger keeps landing on the same event of the frame.
            time.sleep(random.uniform(0, 0.15))
            cap = analyzer.capture(job.gpios, job.rate, job.samples, job.pre, trig, rising)
            label = f'{job.name}: {len(job.gpios)} pins at {job.rate / 1e6:g} MS/s, trigger GP{trig} ' \
                    f'{"rising" if rising else "falling"}'
            if cap is None:
                problems.append(f'{label}: no capture (no trigger within the timeout)')
                print(f'  {label}: no capture')
                continue
            for g in groups:
                if not any(p in cap.levels for p in g.pins):
                    continue
                r = compare(g, cap)
                timed[id(g)] |= r.timed
                counted |= r.counted
                status = 'ok' if not r.errors else f'{len(r.errors)} problems'
                where = f'at {r.offset / 1e6:.3f} ms' if g.windows else ''
                print(f'  {label} | {g.name} {where}: {r.edges} edges timed (worst {r.worst_ns:.0f} ns), '
                      f'{r.ppm:+.0f} ppm, {len(r.counted)} windows counted, {status}')
                for e in r.errors[:12 if verbose else 4]:
                    print(f'      {e}')
                problems += [f'{label} | {g.name}: {e}' for e in r.errors]
    return problems, timed, counted


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('presets', nargs='*', default=PRESETS + ['basic'], help='presets to check, and "basic"')
    ap.add_argument('--keep-captures', metavar='DIR', help='write the captures here and keep them')
    ap.add_argument('--analyzer', help='analyzer serial port (default: found by USB id)')
    ap.add_argument('--bench', help='test bench serial port (default: found by USB id)')
    ap.add_argument('--gp26-channel', type=int, default=23, help='analyzer channel wired to GP26 (default 23)')
    ap.add_argument('-v', '--verbose', action='store_true')
    args = ap.parse_args()
    for p in args.presets:
        if p not in PRESETS + ['basic']:
            ap.error(f'unknown preset {p}')
    if not os.path.exists(EXPORT_FRAME):
        sys.exit('build the host tools first: cmake -S tests -B build-tests && cmake --build build-tests')
    if args.keep_captures:
        os.makedirs(args.keep_captures, exist_ok=True)

    channel_of = {g: g for g in range(23)}
    channel_of[26] = args.gp26_channel
    analyzer = Analyzer(args.analyzer or find_port('LogicAnalyzer', 'logic analyzer'), channel_of,
                        args.keep_captures)
    bench = Bench(args.bench or find_port('Raspberry_Pi_Pico', 'test bench'))
    original = bench.active()

    summary = []
    try:
        for preset in args.presets:
            if preset == 'basic':
                print('\n== GP0-GP9 and GP26')
                groups, jobs = basic_groups(), BASIC_JOBS
            else:
                print(f'\n== {TITLES[preset]}')
                bench.switch(preset)
                groups, jobs = [timeline_group(preset)], JOBS[preset]
            problems, timed, counted = run_jobs(analyzer, groups, jobs, args.verbose)
            for g in groups:
                if g.windows:
                    print('  edges verified per pin, across all captures:')
                    for gpio, p in g.pins.items():
                        if p.times:
                            done = sum(1 for t in p.times if (gpio, round(t, 1)) in timed[id(g)])
                            print(f'    GP{gpio:<3} {done:5}/{len(p.times):<5} {100 * done / len(p.times):5.1f}%')
                rows = window_coverage(g, timed[id(g)])
                if rows:
                    print('  windows (edges verified across all captures):')
                    for name, done, total in rows:
                        mark = 'counted' if name in counted else ''
                        print(f'    {name:44} {done:5}/{total:<5} {mark}')
            summary.append((preset, problems))
    finally:
        if bench.active() != original:
            print(f'\nswitching back to {TITLES[original]}')
            bench.switch(original)

    print('\n== Summary')
    failed = False
    for preset, problems in summary:
        print(f'  {preset:10} {"PASS" if not problems else f"FAIL ({len(problems)} problems)"}')
        failed |= bool(problems)
    if not args.keep_captures:
        print(f'  captures in {analyzer.dir}')
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
