// Lesson: what is this signal? The method for an unknown signal, practiced on pins whose names the page
// hides. Every number in the answers is computed from signals.json and protocols.json (the firmware's own
// config).

import { formatHz, formatRate, formatTime } from '../../model/format';
import { frameMs, gpioOf, protocolData as d } from '../../model/protocols';
import { bounceTiming } from '../../model/signals';
import { highNs, period, sig, wireSteps } from '../helpers';
import type { Lesson, Part } from '../types';

const tx = gpioOf('uart', 'tx');
const sck = gpioOf('spi', 'sck');
const dq = gpioOf('onewire', 'dq');
const button = 26;
const pins = [0, 5, 8, tx, sck, dq, button];

// Every step records the same number of samples and trades sample rate for length, 10x per step.
const samples = 24_000;
const rates = [24_000_000, 2_000_000, 200_000, 20_000];
const lengthNs = (rate: number) => (samples / rate) * 1e9;

const step = (i: number, title: string, intro: string, steps: string[]): Part => ({
  title,
  intro,
  settings: { gpios: pins, sampleRateHz: rates[i], durationNs: lengthNs(rates[i]), preTriggerNs: 0, trigger: { type: 'none' } },
  steps,
  views: [],
});

const msGap = (starts: number[]) => formatTime((starts[1] - starts[0]) * 1e6);
const uartMessageNs = d.uart.firstMessage.length * 10 * d.uart.bitNs;
const spiClocks = 8 * (1 + d.spi.reply.length);
const spiBurstNs = (spiClocks / d.spi.clockHz) * 1e9;
const bounce = bounceTiming(sig(button));

export const mysterySignal: Lesson = {
  id: 'mystery-signal',
  track: 'learn',
  mystery: true,
  title: '9. What is this signal?',
  summary: 'A method for a signal you know nothing about, tried on seven pins whose signals this page will not tell you.',
  gpios: pins,
  intro:
    'Every other lesson gives you the settings. On a real board you often start with a pin and no idea what is on it: a clock, a bus, a reset line, or nothing at all. Guessing settings until something shows up wastes time, and worse, a wrong guess can show you a convincing picture of a signal that is not there. This lesson teaches a method, then lets you use it on seven pins. The page hides what they carry; try not to look it up until you have an answer.',
  sections: [
    {
      title: 'Start fast, then slow down',
      body: [
        'The sample rate sets the shortest thing you can see. The length sets the rarest thing you can catch. Your analyzer can only take so many samples, so you cannot have both: rate times length is fixed. Finding an unknown signal means trading one for the other, in order.',
        '**Start at the fastest rate.** A fast capture can miss things that happen rarely, but it never invents anything: every edge it shows is real, and the timing is accurate. A slow capture can lie without warning. A fast signal sampled too slowly can look flat, or like a completely different, slower signal (see lesson 2). Starting slow gives you a picture you have no reason to doubt and every reason to.',
      ],
      bullets: [
        `**1. Fast and short.** Your highest rate (${formatRate(rates[0])} here), as long as the samples allow. Edges? Measure the shortest pulse. For a trustworthy shape the rate should be at least 4 times, better 10 times, faster than one divided by that pulse width.`,
        '**2. Flat? Slow down 10x and go 10x longer,** with the same number of samples. Repeat until something moves. Each step looks at a longer stretch of time, so rare or slow activity starts to show up.',
        '**3. Once something moves, check it at a faster rate again.** A slow capture tells you that and when something happens, not what. Activity that appears at a slow rate can be a fast signal folded down to a slow-looking one.',
        '**4. Still flat? Trigger and wait.** Set an edge trigger on the pin (try both edges) with no time limit. A capture that shows nothing only says nothing happened during that capture. A trigger that waits for minutes and never fires is much stronger evidence that the line is stuck.',
        '**5. Read the shape.** A steady period is a clock or PWM. An idle level with bursts is a bus: the idle level and the shortest pulse narrow it down. Two lines whose bursts start together are probably clock and data. Then trigger on the start of a burst and zoom in.',
      ],
    },
  ],
  parts: [
    step(
      0,
      `Step 1: fast and short`,
      `${formatRate(rates[0])} for ${formatTime(lengthNs(rates[0]))}, no trigger. Every step records ${samples.toLocaleString('en-US')} samples per input; only the trade between rate and length changes.`,
      [
        ...wireSteps(pins),
        'Capture without a trigger: the analyzer records from the moment you start.',
        'For each pin, write down: flat high, flat low, or moving. For the moving ones, measure the shortest high and the shortest low pulse, and the period if it repeats.',
        'Capture a few more times. Does any flat pin move now and then?',
      ],
    ),
    step(
      1,
      `Step 2: 10x slower, 10x longer`,
      `${formatRate(rates[1])} for ${formatTime(lengthNs(rates[1]))}.`,
      [
        'Capture again, a few times. Which pins that were flat in step 1 move now?',
        'For each new find, how long does the activity last, and how often does it come back?',
        'Check the pins you measured in step 1. One sample is now 12 times longer: do they still look the same?',
      ],
    ),
    step(
      2,
      `Step 3: 10x slower again`,
      `${formatRate(rates[2])} for ${formatTime(lengthNs(rates[2]))}.`,
      [
        'Capture a few times. Look for activity in bursts: how often does each pin come back, and is it always at the same spacing?',
        'Look at the pins you found in steps 1 and 2. Which still look right? Which vanished, or turned into something slower? The rule of thumb from step 1 tells you which ones you can still trust at this rate.',
      ],
    ),
    step(
      3,
      `Step 4: slow and long`,
      `${formatRate(rates[3])} for ${formatTime(lengthNs(rates[3]))}.`,
      [
        'Capture. The slowest signals finally show a whole period or two. Measure them.',
        'Which pins look flat here although you saw them move at a faster rate? That is what starting slow would have shown you.',
        'Anything still flat after all four steps: set an edge trigger on it, both edges in turn, and wait (step 4 of the method).',
        'Write down your answer for every pin, then open the answers below.',
      ],
    ),
  ],
  questions: [
    {
      q: `GP0: what is it, and which step found it?`,
      a: `A ${formatHz(sig(0).actualHz)} square wave: ${formatTime(highNs(0))} high, ${formatTime(period(0) - highNs(0))} low. Steps 1 and 2 almost always show it flat, at whatever level it happens to be. Step 4 is the first that is long enough to always contain an edge. A pin that looks stuck can just be slow.`,
    },
    {
      q: `GP5: what is it, and which step found it?`,
      a: `A ${formatHz(sig(5).actualHz)} square wave, ${formatTime(highNs(5))} high and ${formatTime(period(5) - highNs(5))} low. Step 1 shows it right away. At ${formatRate(rates[2])} there are only 2 samples per period, so it can look right, flat, or slowly drifting. At ${formatRate(rates[3])} the rate is an exact fraction of the signal, so every sample lands at the same point of the wave and it usually looks flat: a running clock that looks dead.`,
    },
    {
      q: `GP8: what is it, and which step found it?`,
      a: `A ${formatTime(highNs(8))} high pulse every ${formatTime(period(8))}. Step 1 always catches one (the capture is exactly one period long), ${Math.round((highNs(8) * rates[0]) / 1e9)} samples wide. At ${formatRate(rates[1])} it is ${Math.round((highNs(8) * rates[1]) / 1e9)} samples wide. In steps 3 and 4 one sample is longer than the pulse, so the pulses mostly vanish, or show as single samples that look random.`,
    },
    {
      q: `GP${tx}: what is it, and which step found it?`,
      a: `UART at ${d.uart.baud} baud: bursts of about ${formatTime(uartMessageNs)} every ${msGap(d.uart.messageStartsMs)}, idle **high**. Step 1 usually misses the bursts. Step 2 catches one some of the time, step 3 always (it is ${frameMs} ms, the length of the whole repeating sequence). The shortest pulse is one bit, ${formatTime(d.uart.bitNs)}, and one divided by that is the baud rate. Idle high plus bursts plus a fixed shortest pulse is the signature of UART: go to the UART lesson to read it.`,
    },
    {
      q: `GP${sck}: what is it, and which step found it?`,
      a: `An SPI clock: bursts of ${spiClocks} pulses at ${formatHz(d.spi.clockHz)} (${formatTime(spiBurstNs)}) every ${msGap(d.spi.startsMs)}, idle **low**. Step 1 rarely catches a burst. Step 2 does, but at only 2 samples per clock period it can look like a short, ragged blip rather than a clock. In steps 3 and 4 the sample rate is an exact fraction of the clock, so the bursts mostly vanish. This is why step 3 of the method matters: once you know when the bursts come, trigger on one at ${formatRate(rates[0])} and count the pulses.`,
    },
    {
      q: `GP${dq}: what is it, and which step found it?`,
      a: `1-Wire: idle **high**, two bursts ${formatTime((d.onewire.readAtMs - d.onewire.convertAtMs) * 1e6)} apart in every ${frameMs} ms, each starting with a ${formatTime(d.onewire.resetLowUs * 1e3)} low reset pulse. Steps 1 and 2 usually see it flat. Step 3 always catches both bursts. A single wide low pulse followed by a burst of short low pulses of a few different widths is the shape of 1-Wire.`,
    },
    {
      q: `GP${button}: what is it, and which step found it?`,
      a: `The bouncing push button: pressed every ${formatTime(bounce.periodNs)} and held for about ${formatTime(bounce.heldNs)}, idle **high**, low while pressed. Step 3 catches an edge about half the time, step 4 always. The bounce itself is a few short pulses on each edge; to see it, trigger on a falling edge at a fast rate, as in the switch bounce lesson.`,
    },
    {
      q: 'Why not start at a slow rate with a long capture? It shows more at once.',
      a: `Because a slow capture cannot tell you when it is wrong. In step 4, GP5 and the bursts on GP${sck} look flat, and nothing on screen says so. A fast capture can only fail by missing something, which you notice: the line is flat, so you slow down. Start where the picture is guaranteed true, and only then trade detail for time.`,
    },
  ],
};
