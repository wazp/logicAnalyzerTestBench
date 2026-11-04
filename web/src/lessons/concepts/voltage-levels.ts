// Concept: logic levels, thresholds, VREF, input limits and ground.

import { wireSteps } from '../helpers';
import type { Lesson } from '../types';

export const voltageLevels: Lesson = {
  id: 'voltage-levels',
  track: 'concepts',
  title: 'Voltage levels and thresholds',
  summary: '1.8V, 3.3V and 5V logic, what a threshold or VREF setting does, and how not to damage anything.',
  gpios: [3],
  intro:
    'Before an analyzer can record a one or a zero, it has to decide where the line between them is. Get that wrong and a perfectly good signal looks dead, or full of glitches. Get the input voltage wrong and you can damage the analyzer.',
  sections: [
    {
      title: 'Logic levels',
      body: [
        'A chip does not switch at exactly half its supply voltage. Every logic family defines two limits: an input above **VIH** is guaranteed to read high, one below **VIL** is guaranteed to read low. Between them is an undefined zone where the input may read either, and may switch back and forth.',
        'Typical values are below. The datasheet of the chip you probe is the authority.',
      ],
      table: {
        title: 'Typical input thresholds',
        head: ['Logic', 'Supply', 'High above (VIH)', 'Low below (VIL)'],
        rows: [
          ['5V TTL', '5 V', '2.0 V', '0.8 V'],
          ['5V CMOS', '5 V', '3.5 V', '1.5 V'],
          ['3.3V (LVCMOS, LVTTL)', '3.3 V', '2.0 V', '0.8 V'],
          ['1.8V CMOS', '1.8 V', '1.17 V', '0.63 V'],
        ],
      },
    },
    {
      title: 'Thresholds and glitches',
      body: [
        'An analyzer compares each input with a single threshold voltage. Put it in the middle of the undefined zone of the logic you probe: about 1.5 V for 3.3V and 5V TTL, about 0.9 V for 1.8V logic.',
      ],
      figure: 'thresholds',
      bullets: [
        'Slow edges (long wires, weak pull-up resistors, heavily loaded lines) spend time near the threshold, where a little noise produces extra edges.',
        'Some analyzers add **hysteresis** (two thresholds, one for rising and one for falling) or a **glitch filter** that ignores pulses shorter than a set time. Both hide the problem rather than fix it, so use them knowingly.',
      ],
    },
    {
      title: 'Threshold settings and VREF',
      body: ['Analyzers handle the threshold in one of three ways. Check which one yours uses:'],
      bullets: [
        '**Selectable logic level**: you pick 1.8V, 3.3V or 5V logic and the threshold follows.',
        '**Adjustable threshold or VREF**: you set the voltage yourself, or feed a reference voltage from the circuit into a VREF input. Handy for unusual levels like 1.2 V or 2.5 V.',
        '**Fixed threshold**: many low-cost analyzers switch at a fixed point around 1.4 to 1.6 V. That suits 3.3V and 5V signals, but not 1.8V logic, whose high level is barely above it.',
      ],
    },
    {
      title: 'Maximum input voltage',
      body: [
        'The threshold is not the limit. Every analyzer has a **maximum input voltage**, often 5 V on low-cost models, sometimes less. Check yours before you probe anything above 3.3 V.',
      ],
      bullets: [
        'Some analyzers are only 5V tolerant while powered, or only 3.3V tolerant. When in doubt, use a resistor divider or a level shifter.',
        'RS-232 serial ports swing to ±12 V or more, and are inverted. Never connect a logic analyzer to them directly; probe the logic side of the RS-232 transceiver chip instead.',
        "The analyzer's ground is your computer's USB ground. In a mains-powered circuit, connecting it to anything that is not that circuit's ground can cause a short. Use an isolated setup or a battery-powered laptop when in doubt.",
      ],
    },
    {
      title: 'Ground first, always',
      body: [
        "Every input is measured against the analyzer's ground. Without a ground connection the inputs float and show random edges, or a faint copy of a neighboring signal. Connect ground before the signal probes, as close as possible to the signals you measure. With fast signals, use more than one ground lead.",
      ],
    },
  ],
  parts: [
    {
      title: "Explore your analyzer's threshold",
      intro:
        "The Pico outputs 3.3V logic: about 0 V low and 3.3 V high. Use GP3, a plain 1 kHz square wave, to see how your analyzer's threshold setting changes what it records.",
      settings: {
        gpios: [3],
        sampleRateHz: 1_000_000,
        durationNs: 5e6,
        preTriggerNs: 0.5e6,
        trigger: { type: 'edge', gpio: 3, edge: 'rising' },
      },
      steps: [
        ...wireSteps([3]),
        'Capture with your normal 3.3V setting. You should see a clean 1 kHz square wave.',
        "If your analyzer's threshold is adjustable: raise it above 3.3 V (or pick 5V CMOS logic if it offers that). GP3 never reaches it and reads low all the time. That is exactly what happens when a 3.3V chip drives a 5V CMOS input.",
        'Set it back to 3.3V logic. If your analyzer has no threshold setting, read the manual to find out where it switches and how much voltage the inputs can take.',
      ],
      views: [
        {
          title: 'With the right threshold',
          startNs: -0.5e6,
          endNs: 3e6,
          sampleRateHz: 1_000_000,
          caption: 'A clean 1 kHz square wave. With a threshold above 3.3 V this line would stay low.',
        },
      ],
    },
  ],
  questions: [
    {
      q: 'A 3.3V chip drives an input on a 5V board. Will it read correctly?',
      a: 'If the input is 5V TTL style (VIH 2.0 V): yes, 3.3 V is well above it. If it is 5V CMOS (VIH 3.5 V): not reliably, 3.3 V is below the guaranteed high level. This is why level shifters exist.',
    },
    {
      q: 'Why can an input with nothing but a floating probe still show something that looks like a signal?',
      a: 'An unconnected input picks up nearby signals through stray capacitance, and without ground nothing defines its voltage. Floating inputs and missing grounds are the most common cause of "ghost" signals.',
    },
    {
      q: 'You want to probe 1.8V logic with an analyzer that has a fixed threshold around 1.5 V. What could go wrong?',
      a: 'A 1.8V high level is only 0.3 V above the threshold, so slow edges and noise easily cause glitches, and a slightly weak high may be missed. Use an analyzer with a 1.8V setting or an adjustable threshold.',
    },
  ],
};
