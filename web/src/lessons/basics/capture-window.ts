// Lesson: the capture window. Every number shown is computed from signals.json (the firmware's
// own config), so the lesson stays correct when the defaults change.

import { formatTime } from '../../model/format';
import { highNs, period, wireSteps } from '../helpers';
import type { Lesson } from '../types';

export const captureWindowLesson: Lesson = {
  id: 'capture-window',
  track: 'learn',
  title: '3. The capture window',
  summary: 'Sample rate times capture length is the number of samples, and samples are what you run out of.',
  gpios: [3, 8],
  intro: `GP8 outputs a ${formatTime(highNs(8))} pulse every ${formatTime(period(8))}. To measure the pulse you need a fast sample rate, but to see several pulses you need a long capture. Every analyzer has a limit on the samples it can take: memory on analyzers that store the capture themselves, USB bandwidth on analyzers that stream to the computer.`,
  parts: [
    {
      title: 'See three pulses, each well resolved',
      intro:
        'Goal: at least 3 pulses after the trigger (a 3 ms capture) and at least 10 samples per pulse. Samples needed = sample rate × capture length.',
      settings: {
        gpios: [3, 8],
        sampleRateHz: 20_000_000,
        durationNs: 3e6,
        preTriggerNs: 100e3,
        trigger: { type: 'edge', gpio: 8, edge: 'rising' },
      },
      steps: [
        ...wireSteps([3, 8]),
        'Enter the settings and capture. Work out the samples per input: 20 MS/s × 3 ms = 60,000.',
        'Zoom into one pulse and count the samples while it is high.',
        "Now try your analyzer's highest sample rate with the same capture length. Does it still fit, or does the software shorten the capture or lower the rate?",
      ],
      views: [
        {
          title: 'Whole capture',
          startNs: -100e3,
          endNs: 3e6,
          sampleRateHz: 20_000_000,
          caption: 'Three pulses on GP8. At this zoom a 1 µs pulse is a thin line.',
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
      q: 'Your analyzer stores 100,000 samples per input. How long can you capture at 20 MS/s, and at 2 MS/s?',
      a: '5 ms at 20 MS/s, 50 ms at 2 MS/s. Halving the rate doubles the time. Many analyzers that store the capture themselves also share their memory between inputs, so enabling fewer inputs can give each one more samples.',
    },
    {
      q: 'Your analyzer streams over USB instead. What limits it?',
      a: 'The USB connection has a fixed bandwidth, shared by all enabled inputs. The capture can be as long as you like, but the highest sample rate drops as you enable more inputs, and a busy USB bus can cause dropped samples.',
    },
    {
      q: 'Why does GP3 rise together with every GP8 pulse?',
      a: 'Both run at 1 kHz from the same clock and were started together. The PWM outputs start a few clock cycles (tens of ns) before the PIO outputs, too small to see at 20 MS/s.',
    },
  ],
};
