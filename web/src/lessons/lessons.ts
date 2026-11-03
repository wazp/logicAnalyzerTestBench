// Lesson content. Every number shown to the user (frequencies, widths,
// expected measurements) is computed from signals.json rather than typed in,
// so the lessons stay correct when the firmware defaults change.
//
// Text supports two inline markers: `code` and **bold**.

import type { CaptureSettings } from '../model/analyzer';
import { formatHz, formatPercent, formatTime } from '../model/format';
import { channelForGpio, periodNs, signalByGpio } from '../model/signals';

/** A waveform view: a time window, optionally sampled like the analyzer would. */
export interface View {
  title: string;
  startNs: number;
  endNs: number;
  /** Draw what an analyzer at this rate records. Omit for the ideal signal. */
  sampleRateHz?: number;
  /** Let the reader switch between these sample rates. */
  sampleRateOptions?: number[];
  caption: string;
}

/** One capture: the settings to enter, the steps, and what it should look like. */
export interface Part {
  title: string;
  intro?: string;
  settings: CaptureSettings;
  steps: string[];
  views: View[];
}

export interface Question {
  q: string;
  a: string;
}

/** A pass/fail item for the verify track. */
export interface Check {
  id: string;
  gpio: number;
  measure: string;
  expected: string;
}

export interface Lesson {
  id: string;
  track: 'learn' | 'verify';
  title: string;
  summary: string;
  /** GPIOs to wire up. Channels follow the CH = GP + 1 rule. */
  gpios: number[];
  intro: string;
  parts: Part[];
  questions: Question[];
  checks?: Check[];
  tips?: string[];
}

const ch = channelForGpio;
const sig = signalByGpio;
const highNs = (gpio: number) => sig(gpio).segments[0].ns;
const period = (gpio: number) => periodNs(sig(gpio));

const wireSteps = (gpios: number[]) => [
  'Set the analyzer **VREF** switch to **3.3V**.',
  'Connect analyzer **GND** to a Pico **GND** pin first (pin 3, 8 or 13).',
  `Connect ${gpios.map((g) => `**CH${ch(g)}** to **GP${g}**`).join(', ')}.`,
];

const firstCapture: Lesson = {
  id: 'first-capture',
  track: 'learn',
  title: '1. Your first capture',
  summary: 'Four square waves, an edge trigger, and finding your way around a capture.',
  gpios: [0, 1, 2, 3],
  intro:
    'GP0 to GP3 output 1 Hz, 10 Hz, 100 Hz and 1 kHz square waves. Each is ten times faster than the previous one, which makes it easy to see how the sample rate and the capture length decide what you can see.',
  parts: [
    {
      title: 'Capture two seconds',
      settings: {
        channels: [1, 2, 3, 4],
        sampleRateHz: 10_000,
        preSamples: 2_000,
        postSamples: 20_000,
        trigger: { type: 'edge', channel: 1, edge: 'rising' },
      },
      steps: [
        ...wireSteps([0, 1, 2, 3]),
        'In the app, enable channels 1 to 4 and enter the settings on the right.',
        'Start the capture. It waits up to a second for the next rising edge on CH1, then records 2 seconds.',
        'Zoom out to see the whole capture, then zoom into the first 20 ms around the trigger.',
      ],
      views: [
        {
          title: 'Whole capture',
          startNs: -200e6,
          endNs: 2e9,
          sampleRateHz: 10_000,
          caption: 'CH4 (1 kHz) toggles too fast to draw at this zoom level. In the app it looks like a solid block.',
        },
        {
          title: 'First 20 ms',
          startNs: -2e6,
          endNs: 20e6,
          sampleRateHz: 10_000,
          caption: 'Zoomed in: CH4 now shows its 1 kHz square wave, 10 samples per period.',
        },
      ],
    },
  ],
  questions: [
    {
      q: 'How many CH2 periods fit in one CH1 period?',
      a: `Ten. CH1 is ${formatHz(sig(0).actualHz)} and CH2 is ${formatHz(sig(1).actualHz)}.`,
    },
    {
      q: 'Why do all four channels rise exactly at the trigger point?',
      a: 'The firmware starts all PIO outputs on the same clock cycle, and every period is a whole multiple of the faster ones. So every 1 Hz rising edge is also a rising edge of the other three.',
    },
    {
      q: 'At 10 kS/s, how precisely can you place an edge on CH4?',
      a: 'Only to within one sample, 100 µs. That is 10% of a 1 kHz period, so measuring CH4 duty cycle here is rough. Later lessons use faster rates for that.',
    },
  ],
};

const aliasing: Lesson = {
  id: 'aliasing',
  track: 'learn',
  title: '2. Sample rate and aliasing',
  summary: 'Capture 100 kHz too slowly and watch it lie to you.',
  gpios: [4, 5],
  intro:
    'An analyzer only sees the level at each sample. If it samples too slowly, a fast signal can look like a completely different, slower one. This is called aliasing. GP5 is 100 kHz, GP4 (10 kHz) is a reference you can trust at every rate used here.',
  parts: [
    {
      title: 'Capture GP5 at different rates',
      settings: {
        channels: [5, 6],
        sampleRateHz: 150_000,
        preSamples: 100,
        postSamples: 2_000,
        trigger: { type: 'edge', channel: 5, edge: 'rising' },
      },
      steps: [
        ...wireSteps([4, 5]),
        'Capture at **150 kS/s**. Count the CH6 rising edges within one CH5 period.',
        'Repeat at **200 kS/s**, **400 kS/s**, **1 MS/s** and **10 MS/s**, and compare.',
      ],
      views: [
        {
          title: 'One CH5 period',
          startNs: -10e3,
          endNs: 200e3,
          sampleRateHz: 150_000,
          sampleRateOptions: [150_000, 200_000, 400_000, 1_000_000, 10_000_000],
          caption: `Pick a sample rate. The real CH6 signal has ${Math.round(period(4) / period(5))} periods per CH5 period.`,
        },
      ],
    },
  ],
  questions: [
    {
      q: 'What frequency does CH6 appear to have at 150 kS/s?',
      a: 'About 50 kHz. A 100 kHz signal sampled at 150 kS/s folds down to |150 - 100| = 50 kHz. Nothing on screen tells you it is wrong, which is why aliasing is dangerous.',
    },
    {
      q: 'At 200 kS/s (exactly twice the signal) it looks right. Is that enough?',
      a: 'Barely. You get one sample per half period, so the frequency is right but you know nothing about where the edges are or what the duty cycle is. Since the two boards have separate crystals, the picture can also slowly drift.',
    },
    {
      q: 'What rule of thumb should you use?',
      a: 'Sample at least 4 times faster than the fastest signal for a trustworthy shape, and 10 times or more if you want to measure timing. 1 MS/s or more for CH6.',
    },
  ],
};

const window_: Lesson = {
  id: 'capture-window',
  track: 'learn',
  title: '3. The capture window',
  summary: 'Sample rate times sample count: why you cannot have both a fast rate and a long capture.',
  gpios: [3, 8],
  intro: `GP8 outputs a ${formatTime(highNs(8))} pulse every ${formatTime(period(8))}. To measure the pulse you need a fast sample rate, but to see several pulses you need a long capture. The analyzer has a fixed number of samples, so the two pull against each other.`,
  parts: [
    {
      title: 'See three pulses, each well resolved',
      intro:
        'Goal: at least 3 pulses after the trigger (a 3 ms window) and at least 10 samples per pulse. Window = post-trigger samples / sample rate.',
      settings: {
        channels: [4, 9],
        sampleRateHz: 20_000_000,
        preSamples: 2_000,
        postSamples: 60_000,
        trigger: { type: 'edge', channel: 9, edge: 'rising' },
      },
      steps: [
        ...wireSteps([3, 8]),
        'Enter the settings and capture. Look at the summary: 60,000 samples at 20 MS/s is 3 ms.',
        'Zoom into one pulse and count the samples while it is high.',
        'Now try 100 MS/s with the same sample count. How many pulses do you get?',
      ],
      views: [
        {
          title: 'Whole capture',
          startNs: -100e3,
          endNs: 3e6,
          sampleRateHz: 20_000_000,
          caption: 'Three pulses on CH9. At this zoom a 1 µs pulse is a thin line.',
        },
        {
          title: 'One pulse',
          startNs: -2e3,
          endNs: 4e3,
          sampleRateHz: 20_000_000,
          caption: 'At 20 MS/s the pulse is 20 samples wide, each sample 50 ns.',
        },
      ],
    },
  ],
  questions: [
    {
      q: 'Using CH9 changed the maximum sample count. Why?',
      a: 'The analyzer shares its buffer across channels. Any channel above 8 switches it to 16-channel mode, which halves the samples per channel (65,533 post-trigger instead of 131,069).',
    },
    {
      q: 'What window do you get at 100 MS/s with 60,000 samples?',
      a: '600 µs. That is less than one pulse period, so you only ever see the trigger pulse.',
    },
    {
      q: 'Why does CH4 rise together with every CH9 pulse?',
      a: 'Both run at 1 kHz from the same clock and were started together. The PWM outputs start a few clock cycles (tens of ns) before the PIO outputs, too small to see at 20 MS/s.',
    },
  ],
};

const duty: Lesson = {
  id: 'duty-cycle',
  track: 'learn',
  title: '4. Measuring duty cycle',
  summary: 'Two PWM outputs at 25% and 75%, and how to measure them precisely.',
  gpios: [6, 7],
  intro: `GP6 and GP7 are the two channels of one PWM slice, so they share the ${formatHz(sig(6).actualHz)} frequency but have different duty cycles. Use the app's measurement tools (cursors or the timing readout) on these.`,
  parts: [
    {
      title: 'Capture and measure',
      settings: {
        channels: [7, 8],
        sampleRateHz: 1_000_000,
        preSamples: 500,
        postSamples: 5_000,
        trigger: { type: 'edge', channel: 7, edge: 'rising' },
      },
      steps: [
        ...wireSteps([6, 7]),
        'Capture, then measure the high time and the period on both channels.',
        'Duty cycle = high time / period.',
      ],
      views: [
        {
          title: 'Three periods',
          startNs: -500e3,
          endNs: 3e6,
          sampleRateHz: 1_000_000,
          caption: `CH7 is high for ${formatTime(highNs(6))}, CH8 for ${formatTime(highNs(7))}, both per ${formatTime(period(6))}.`,
        },
      ],
    },
  ],
  questions: [
    {
      q: 'What did you measure for each channel?',
      a: `CH7: ${formatTime(highNs(6))} high, ${formatPercent(sig(6).dutyPercent)}. CH8: ${formatTime(highNs(7))} high, ${formatPercent(sig(7).dutyPercent)}. Period ${formatTime(period(6))} on both.`,
    },
    {
      q: 'How precise is your measurement at 1 MS/s?',
      a: 'Each edge is uncertain by up to 1 µs, so a high time is good to about ±1 µs, about ±0.1% of the period. Faster sampling makes it more precise.',
    },
    {
      q: 'Why do both channels always rise at the same moment?',
      a: 'They share one PWM counter. Both outputs go high when it wraps to zero and go low at their own compare level.',
    },
  ],
};

const rareEvent: Lesson = {
  id: 'rare-event',
  track: 'learn',
  title: '5. Catching a short pulse',
  summary: 'Trigger on a 1 µs event at full speed and use pre-trigger samples to see what led up to it.',
  gpios: [8, 9],
  intro:
    'Short events are where a logic analyzer shines. GP8 is high for only 0.1% of the time. With an edge trigger you can capture exactly that moment at the full 100 MS/s, plus whatever happened just before it.',
  parts: [
    {
      title: 'Trigger on the pulse',
      settings: {
        channels: [9, 10],
        sampleRateHz: 100_000_000,
        preSamples: 1_000,
        postSamples: 2_000,
        trigger: { type: 'edge', channel: 9, edge: 'rising' },
      },
      steps: [
        ...wireSteps([8, 9]),
        'Capture at 100 MS/s. The trigger point is the CH9 rising edge.',
        'Measure the pulse width. Look at CH10 before and after the trigger.',
        'Optional: set a **burst** count of 5 to capture five consecutive pulses in one go. (How the app lays out burst captures may differ between versions.)',
      ],
      views: [
        {
          title: 'Around the trigger',
          startNs: -10e3,
          endNs: 20e3,
          sampleRateHz: 100_000_000,
          caption: 'CH9 is high for 1 µs (100 samples). CH10 starts its 10 µs frame marker at the same moment.',
        },
      ],
    },
  ],
  questions: [
    {
      q: 'How wide is the pulse, in time and in samples?',
      a: `${formatTime(highNs(8))}, 100 samples at 100 MS/s (10 ns each).`,
    },
    {
      q: 'What use are the pre-trigger samples here?',
      a: 'They show what happened before the event. Here CH10 was low (it is in its idle phase), which tells you the pulse marks the start of a new pattern frame. In real debugging, pre-trigger data shows the cause of an error.',
    },
  ],
};

const patternFrame = sig(9).segments;
const patternTrigger: Lesson = {
  id: 'pattern-trigger',
  track: 'learn',
  title: '6. Pattern triggers',
  summary: 'Use a combination of channels to trigger on the exact start of a frame, then measure every segment.',
  gpios: [3, 8, 9],
  intro: `GP9 repeats an irregular ${formatTime(period(9))} pattern with ${patternFrame.filter((s) => s.level === 1).length} pulses of different widths. An edge trigger on it fires on whichever rising edge comes first after you press capture. A pattern trigger lets you pick the moment you actually want.`,
  parts: [
    {
      title: 'First, an edge trigger on CH10',
      settings: {
        channels: [4, 9, 10],
        sampleRateHz: 10_000_000,
        preSamples: 200,
        postSamples: 12_000,
        trigger: { type: 'edge', channel: 10, edge: 'rising' },
      },
      steps: [
        ...wireSteps([3, 8, 9]),
        'Capture a few times with an edge trigger on CH10. Notice the trigger lands on a different pulse each time.',
      ],
      views: [
        {
          title: 'One frame',
          startNs: -20e3,
          endNs: 1.1e6,
          sampleRateHz: 10_000_000,
          caption: 'This is the frame as seen from its start. Your edge-triggered captures will be shifted to whichever pulse came first.',
        },
      ],
    },
    {
      title: 'Then, a pattern trigger',
      intro:
        'CH9 (the 1 µs pulse) and CH10 are both high only during the first microsecond of each frame. Triggering on "CH9 high AND CH10 high" lands on the frame start every time.',
      settings: {
        channels: [4, 9, 10],
        sampleRateHz: 10_000_000,
        preSamples: 200,
        postSamples: 12_000,
        trigger: { type: 'pattern', firstChannel: 9, pattern: '11' },
      },
      steps: [
        'Switch to a **pattern** trigger: first channel 9, pattern `11`. Check in the app whether the pattern is written left to right from the first channel.',
        'Capture a few times. Every capture now starts at the 10 µs frame marker.',
        'Measure each segment and compare with the table below.',
        'The project wiki says pattern triggers need GPIO0 and GPIO1 bridged on the analyzer. If the trigger never fires, check that first.',
      ],
      views: [
        {
          title: 'Frame start',
          startNs: -5e3,
          endNs: 110e3,
          sampleRateHz: 10_000_000,
          caption: 'The first 110 µs of the frame, where all the activity is.',
        },
      ],
    },
  ],
  questions: [
    {
      q: 'Name another way to trigger reliably on the frame start.',
      a: 'An edge trigger on CH4 (GP3, 1 kHz). It was started on the same clock cycle as the pattern and has the same 1 ms period, so its rising edge always marks the frame start. Using a related signal as the trigger is a common trick, for example a chip select line.',
    },
    {
      q: 'Why would a pattern of only CH10 high ("1" on channel 10) not work as well?',
      a: 'CH10 is high during seven different pulses per frame, so a pattern of just that is no better than an edge trigger.',
    },
  ],
};

const sanity: Lesson = {
  id: 'sanity-check',
  track: 'verify',
  title: 'Sanity check: CH1 to CH10',
  summary: 'Confirm that the first ten channels of your analyzer record correct levels and timing.',
  gpios: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  intro:
    'A quick health check for a hand-built analyzer. Every channel gets a different, known signal, so a dead, stuck, swapped or bridged channel stands out. The slow signals need a long, slow capture and the fast ones a short, fast capture, so this takes two captures.',
  parts: [
    {
      title: 'Capture A: slow signals',
      settings: {
        channels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        sampleRateHz: 20_000,
        preSamples: 1_000,
        postSamples: 50_000,
        trigger: { type: 'edge', channel: 1, edge: 'rising' },
      },
      steps: [
        ...wireSteps([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]),
        'Capture 2.5 s and check CH1, CH2 and CH3 against the table. Ignore the other channels in this capture.',
      ],
      views: [
        {
          title: 'Capture A',
          startNs: -50e6,
          endNs: 2.5e9,
          sampleRateHz: 20_000,
          caption:
            'Only CH1 to CH3 matter here. CH9 and CH10 may look flat or show random blips: their pulses are shorter than one 50 µs sample, so most are missed. That is expected, not a broken channel. Check them in capture B.',
        },
      ],
    },
    {
      title: 'Capture B: fast signals',
      settings: {
        channels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        sampleRateHz: 10_000_000,
        preSamples: 1_000,
        postSamples: 60_000,
        trigger: { type: 'edge', channel: 4, edge: 'rising' },
      },
      steps: [
        'Capture 6 ms triggered on CH4 and check CH4 to CH10 against the table.',
        'Also check that all rising edges at the trigger point line up across CH4 to CH10.',
      ],
      views: [
        {
          title: 'Capture B, first 120 µs',
          startNs: -10e3,
          endNs: 120e3,
          sampleRateHz: 10_000_000,
          caption: 'Every channel except the slow ones changes in this window.',
        },
      ],
    },
  ],
  checks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((gpio) => {
    const s = sig(gpio);
    const isPattern = s.kind === 'pattern';
    return {
      id: `ch${ch(gpio)}`,
      gpio,
      measure: isPattern ? 'frame length and first pulse' : s.kind === 'pulse' ? 'period and pulse width' : 'frequency and duty cycle',
      expected: isPattern
        ? `${formatTime(periodNs(s))} frame, starts with a ${formatTime(s.segments[0].ns)} high pulse`
        : s.kind === 'pulse'
          ? `${formatTime(periodNs(s))} period, ${formatTime(s.segments[0].ns)} high`
          : `${formatHz(s.actualHz)}, ${formatPercent(s.dutyPercent)} duty`,
    };
  }),
  tips: [
    '**Flat line** on a channel: probe not connected, broken solder joint, or a dead input buffer.',
    '**Two channels identical**: a solder bridge between them, or two probes on the same pin.',
    '**Right signal, wrong channel**: swapped probe leads or a routing mistake. The frequencies tell you which signal you got.',
    '**Glitches or extra edges**: check VREF is 3.3V and the ground lead is connected.',
    'Expect each measurement to be off by up to one sample period (50 µs in capture A, 100 ns in capture B).',
  ],
  questions: [],
};

export const lessons: Lesson[] = [firstCapture, aliasing, window_, duty, rareEvent, patternTrigger, sanity];

export function lessonById(id: string): Lesson | undefined {
  return lessons.find((l) => l.id === id);
}
