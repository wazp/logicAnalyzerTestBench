// Concept: trigger types and modes, and how to choose a good trigger.

import { wireSteps } from '../helpers';
import type { Lesson } from '../types';

export const triggers: Lesson = {
  id: 'triggers',
  track: 'concepts',
  title: 'Triggers',
  summary: 'Edge, pattern, pulse width and protocol triggers, the modes they run in, and how to pick a good one.',
  gpios: [8, 9],
  intro:
    'Without a trigger, the analyzer records from the moment you press start, and the moment you care about is somewhere in a long capture, if it is there at all. A trigger tells the analyzer what to wait for.',
  sections: [
    {
      title: 'What a trigger does',
      body: [
        'Once armed, the analyzer watches the inputs and keeps the samples around the moment the trigger condition is met. **Pre-trigger** samples show what led up to it, **post-trigger** samples what came after. Most software shows the trigger point as t = 0 or with a marker.',
      ],
    },
    {
      title: 'Trigger types',
      body: [
        'Every analyzer has edge triggers. Which other types you get depends on the analyzer and its software. Some streaming analyzers only search the data after the capture; it works the same way, it just cannot save memory.',
      ],
      table: {
        title: 'Trigger types',
        head: ['Type', 'Fires when', 'Good for'],
        rows: [
          ['**Edge**', 'one input rises or falls', 'a chip select, a start bit, a reset, a clock'],
          ['**Pattern**', 'several inputs match high, low or "don\'t care" at once', 'a bus state, two signals together'],
          ['**Pulse width**', 'a pulse is longer or shorter than a time you set', 'glitches, a frame marker, a too-short reset'],
          ['**Protocol**', 'a decoder sees a byte, address or message', 'the I²C write to one address, one UART character'],
          ['**Sequence**', 'condition A happens, then condition B', 'rare combinations of events'],
        ],
      },
    },
    {
      title: 'Trigger modes',
      body: ['Separately from what to trigger on, you choose how often to capture:'],
      table: {
        title: 'Trigger modes',
        head: ['Mode', 'What happens'],
        rows: [
          ['**Single**', 'Waits for one trigger, captures once, stops. Best for rare events.'],
          ['**Normal / repeat**', 'Captures on every trigger and updates the screen. Best for watching something change.'],
          ['**Auto**', 'Like normal, but captures anyway after a timeout, so you see something even without a trigger.'],
          ['**Immediate**', 'No trigger: starts recording right away.'],
        ],
      },
    },
    {
      title: 'Choosing a good trigger',
      body: [],
      bullets: [
        'Trigger on the signal that marks the **start** of what you care about (a chip select, a frame sync, a reset), not on busy data lines.',
        'Keep plenty of pre-trigger samples when hunting a cause: the interesting part is often just before the symptom.',
        'If a capture starts in the middle of a transaction, the line was already busy when you armed the trigger. Capture again, or trigger on an idle-to-active change like CS falling.',
        'A trigger that never fires is information too: the event you expect is not happening.',
      ],
    },
  ],
  parts: [
    {
      title: 'Catch the frame marker by its width',
      intro:
        'GP9 repeats a 1 ms pattern that starts with a 10 µs pulse. Its other pulses are 1, 3 and 20 µs wide, so "high for longer than 8 µs but shorter than 15 µs" matches only the frame marker.',
      settings: {
        gpios: [8, 9],
        sampleRateHz: 10_000_000,
        durationNs: 120e3,
        preTriggerNs: 20e3,
        trigger: { type: 'pulse', gpio: 9, level: 1, longerThanNs: 8e3, shorterThanNs: 15e3 },
      },
      steps: [
        ...wireSteps([8, 9]),
        'Set a pulse width trigger on GP9: high, longer than 8 µs and shorter than 15 µs. Capture a few times: every capture lands on the frame marker.',
        'Most analyzers fire a pulse width trigger when the pulse **ends**, because only then is its width known. Your trigger mark may sit at the end of the 10 µs pulse rather than its start.',
        'No pulse width trigger? Trigger on the rising edge of GP8 instead: its 1 µs pulse starts at the same moment as the frame marker.',
      ],
      views: [
        {
          title: 'Frame start',
          startNs: -20e3,
          endNs: 110e3,
          sampleRateHz: 10_000_000,
          caption: 'Shown with t = 0 at the start of the frame marker. GP8 pulses at the same moment, which is why it works as a fallback trigger.',
        },
      ],
    },
  ],
  questions: [
    {
      q: 'Why would an edge trigger on GP9 not work for this?',
      a: 'GP9 rises seven times per frame. An edge trigger fires on whichever rising edge comes first after you arm it, so each capture starts at a different pulse.',
    },
    {
      q: 'When would you choose single mode over repeat mode?',
      a: 'For rare or one-off events: single mode stops after the first trigger, so the capture you wanted is not overwritten by the next one.',
    },
  ],
};
