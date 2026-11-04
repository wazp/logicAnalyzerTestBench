// Lesson: catching a short pulse. Every number shown is computed from signals.json (the firmware's
// own config), so the lesson stays correct when the defaults change.

import { formatTime } from '../../model/format';
import { highNs, wireSteps } from '../helpers';
import type { Lesson } from '../types';

export const rareEvent: Lesson = {
  id: 'rare-event',
  track: 'learn',
  title: '5. Catching a short pulse',
  summary: 'Trigger on a 1 µs event at a fast rate and use pre-trigger samples to see what led up to it.',
  gpios: [8, 9],
  intro:
    'Short events are where a logic analyzer shines. GP8 is high for only 0.1% of the time. With an edge trigger you can capture exactly that moment at a fast sample rate, plus whatever happened just before it.',
  parts: [
    {
      title: 'Trigger on the pulse',
      settings: {
        gpios: [8, 9],
        sampleRateHz: 24_000_000,
        durationNs: 20e3,
        preTriggerNs: 10e3,
        trigger: { type: 'edge', gpio: 8, edge: 'rising' },
      },
      steps: [
        ...wireSteps([8, 9]),
        'Capture at 24 MS/s (or faster). The trigger point is the GP8 rising edge.',
        'Measure the pulse width. Look at GP9 before and after the trigger.',
        'If your software can repeat a capture automatically on every trigger, try it: you will see the same picture each time, because the pulse and the pattern are locked together.',
      ],
      views: [
        {
          title: 'Around the trigger',
          startNs: -10e3,
          endNs: 20e3,
          sampleRateHz: 24_000_000,
          caption: 'GP8 is high for 1 µs, 24 samples at 24 MS/s. GP9 starts its 10 µs frame marker at the same moment.',
        },
      ],
    },
  ],
  questions: [
    {
      q: 'How wide is the pulse, in time and in samples?',
      a: `${formatTime(highNs(8))}: 24 samples at 24 MS/s (about 42 ns each). Your reading can be off by one sample, so anything from 23 to 25 samples is right.`,
    },
    {
      q: 'What use are the pre-trigger samples here?',
      a: 'They show what happened before the event. Here GP9 was low (it is in its idle phase), which tells you the pulse marks the start of a new pattern frame. In real debugging, pre-trigger data shows the cause of an error.',
    },
  ],
};
