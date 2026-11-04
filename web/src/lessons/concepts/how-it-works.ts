// Concept: what a logic analyzer does, and what it cannot see.

import { wireSteps } from '../helpers';
import type { Lesson } from '../types';

export const howItWorks: Lesson = {
  id: 'how-it-works',
  track: 'concepts',
  title: 'How a logic analyzer works',
  summary: 'Samples, thresholds and bits: what an analyzer records, and what it throws away.',
  gpios: [5],
  intro:
    'A logic analyzer watches many signals at once, but asks only one question about each: is it above or below the threshold right now? Understanding that one question explains most of what you will see on screen.',
  sections: [
    {
      title: 'Ones and zeros, sampled',
      body: [
        'The analyzer asks its question at a fixed rate, the **sample rate**, and stores one bit per input per sample. At 10 MS/s that is ten million questions per second for every input.',
        'Everything else is lost: the exact voltage, how fast an edge rises, ringing, and noise that stays on one side of the threshold. In return you get many inputs, long captures, and decoders that turn the bits into bytes and messages.',
      ],
    },
    {
      title: 'Logic analyzer or oscilloscope?',
      body: [
        'They answer different questions. Use the analyzer to find **what** happened and **when**; use an oscilloscope to see **why** a signal is bad.',
      ],
      table: {
        title: 'Logic analyzer or oscilloscope',
        head: ['', 'Logic analyzer', 'Oscilloscope'],
        rows: [
          ['Shows', 'high or low', 'the actual voltage over time'],
          ['Inputs', '8 to 32 or more, cheap', 'usually 2 to 4'],
          ['Capture length', 'milliseconds to minutes', 'usually much shorter'],
          ['Good for', 'protocols, timing between many signals, rare events', 'voltage levels, slow or ringing edges, noise, analog signals'],
        ],
      },
    },
    {
      title: 'Where the samples go',
      body: [
        '**Buffered** analyzers store the capture in their own memory and send it to the computer afterwards. They can sample very fast, but the memory limits the length: samples per input = sample rate × capture length.',
        '**Streaming** analyzers send samples to the computer over USB while capturing. The length is almost unlimited, but the USB bandwidth caps the sample rate, and the cap drops as you enable more inputs.',
        'Some analyzers **compress** the data, storing only the changes. Slow signals then use very little memory, busy ones a lot. Check what yours does: it decides how long you can capture.',
      ],
    },
    {
      title: 'What the sample rate buys you',
      body: [
        'An edge can only be seen at a sample, so every edge you measure can be off by up to one sample period: 1 µs at 1 MS/s, about 42 ns at 24 MS/s. A pulse shorter than one sample period can be missed entirely.',
      ],
      bullets: [
        'For a trustworthy shape, sample at least **4 times** faster than the fastest signal.',
        'For timing measurements, sample **10 times** faster or more.',
        'For short pulses, make sure the shortest pulse spans several samples.',
      ],
    },
    {
      title: 'Timing mode and state mode',
      body: [
        'Everything in this guide uses **timing mode**: the analyzer samples on its own clock. Some analyzers also have a **state** (or synchronous) mode, where they sample on the edges of a clock signal from the circuit. That shows bus values exactly as the circuit sees them, but tells you nothing about timing between clock edges.',
      ],
    },
  ],
  parts: [
    {
      title: 'See the samples',
      settings: {
        gpios: [5],
        sampleRateHz: 1_000_000,
        durationNs: 100e3,
        preTriggerNs: 10e3,
        trigger: { type: 'edge', gpio: 5, edge: 'rising' },
      },
      steps: [
        ...wireSteps([5]),
        'Capture GP5 (100 kHz) at 1 MS/s and zoom in until you can see individual samples. Many apps show them as dots or a grid when zoomed in far enough.',
        'Measure the high time of a few periods. It should be 5 µs, but you will read 4 or 6 µs at times: each edge can land anywhere within a sample.',
        'Repeat at a higher sample rate and watch the error shrink.',
      ],
      views: [
        {
          title: 'GP5 sampled',
          startNs: -5e3,
          endNs: 30e3,
          sampleRateHz: 1_000_000,
          sampleRateOptions: [1_000_000, 4_000_000, 10_000_000, 24_000_000],
          caption: 'Each dot is one sample. The analyzer draws the edge at the first sample that sees the new level.',
        },
      ],
    },
  ],
  questions: [
    {
      q: 'A signal has ringing that dips below the threshold right after its rising edge. What does the analyzer show?',
      a: 'A short extra low pulse (a glitch) right after the edge, if a sample happens to land in the dip, and nothing at all if not. The analyzer cannot tell you it was ringing; an oscilloscope can.',
    },
    {
      q: 'You need to capture 2 seconds at 10 MS/s on 4 inputs. How many samples is that?',
      a: '20 million samples per input, 80 million in total. A buffered analyzer without compression needs that much memory; a streaming one needs to move 40 MS/s of input data over USB.',
    },
  ],
};
