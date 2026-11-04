// Lesson: smarter triggers. Every number shown is computed from signals.json (the firmware's
// own config), so the lesson stays correct when the defaults change.

import { formatTime } from '../../model/format';
import { segmentTimeline } from '../../model/signals';
import { period, sig, wireSteps } from '../helpers';
import type { Lesson } from '../types';

const patternFrame = sig(9).segments;
export const patternTrigger: Lesson = {
  id: 'pattern-trigger',
  track: 'learn',
  title: '6. Smarter triggers',
  summary: 'Trigger on the exact start of a frame, with a pattern trigger or with a related signal.',
  gpios: [3, 8, 9],
  intro: `GP9 repeats an irregular ${formatTime(period(9))} pattern with ${patternFrame.filter((s) => s.level === 1).length} pulses of different widths. An edge trigger on it fires on whichever rising edge comes first after you press capture. This lesson shows two ways to pick the moment you actually want.`,
  parts: [
    {
      title: 'First, an edge trigger on GP9',
      settings: {
        gpios: [3, 8, 9],
        sampleRateHz: 10_000_000,
        durationNs: 1.2e6,
        preTriggerNs: 20e3,
        trigger: { type: 'edge', gpio: 9, edge: 'rising' },
      },
      steps: [
        ...wireSteps([3, 8, 9]),
        'Capture a few times with an edge trigger on GP9. Notice the trigger lands on a different pulse each time.',
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
      title: 'Then, a pattern trigger (if your analyzer has one)',
      intro:
        'GP8 (the 1 µs pulse) and GP9 are both high only during the first microsecond of each frame. A trigger on "GP8 high AND GP9 high" lands on the frame start every time. Analyzers call this a pattern, condition or word trigger; not every analyzer has one.',
      settings: {
        gpios: [3, 8, 9],
        sampleRateHz: 10_000_000,
        durationNs: 1.2e6,
        preTriggerNs: 20e3,
        trigger: {
          type: 'pattern',
          levels: [
            { gpio: 8, level: 1 },
            { gpio: 9, level: 1 },
          ],
        },
      },
      steps: [
        'Set a pattern trigger: GP8 high and GP9 high, every other input "don\'t care".',
        'No pattern trigger? Use a **rising edge on GP3** instead. GP3 runs at 1 kHz, was started on the same clock cycle as the pattern and has the same 1 ms period, so its rising edge always marks the frame start.',
        'Capture a few times. Every capture now starts at the 10 µs frame marker.',
        'Measure each segment and compare with the table below.',
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
  tables: [
    {
      title: 'Expected segments on GP9',
      head: ['#', 'Starts at', 'Level', 'Width'],
      rows: segmentTimeline(sig(9)).map((r, i) => [String(i + 1), formatTime(r.start), r.level ? 'high' : 'low', formatTime(r.ns)]),
    },
  ],
  questions: [
    {
      q: 'Why is triggering on a related signal (like GP3 here) such a common trick?',
      a: 'Real systems are full of them: a chip select framing an SPI transfer, a frame sync on an audio bus, a reset line. Triggering on the signal that marks the start of what you care about is simpler and more reliable than a clever trigger on the data itself.',
    },
    {
      q: 'Why would a pattern of only "GP9 high" not work as well?',
      a: 'GP9 is high during seven different pulses per frame, so that pattern is no better than an edge trigger.',
    },
  ],
};
