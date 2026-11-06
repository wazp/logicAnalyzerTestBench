// Concept: trigger types and modes, and how to choose a good trigger.

import { formatTime } from '../../model/format';
import { andList, highNs, markerTriggerShare, patternPulses, period, wireSteps } from '../helpers';
import type { Lesson } from '../types';

// The pulse width window: wider than every other GP9 pulse below the marker, narrower than every one above it.
const [marker, ...otherPulses] = patternPulses();
const longerThanNs = 8e3;
const shorterThanNs = 15e3;

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
        'Every analyzer has edge triggers. Which other types you get depends on the analyzer and its software. On many streaming analyzers the computer, not the analyzer, checks the trigger condition as the samples arrive and keeps only the samples around it. From your side it works the same.',
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
        `GP9 repeats a ${formatTime(period(9))} pattern that starts with a ${formatTime(marker)} pulse. Its other pulses are ${andList([...new Set(otherPulses)].sort((a, b) => a - b).map(formatTime))} wide, so "high for longer than ${formatTime(longerThanNs)} but shorter than ${formatTime(shorterThanNs)}" matches only the frame marker.`,
      settings: {
        gpios: [8, 9],
        sampleRateHz: 10_000_000,
        durationNs: 120e3,
        preTriggerNs: 20e3,
        trigger: { type: 'pulse', gpio: 9, level: 1, longerThanNs, shorterThanNs },
      },
      steps: [
        ...wireSteps([8, 9]),
        `Set a pulse width trigger on GP9: high, longer than ${formatTime(longerThanNs)} and shorter than ${formatTime(shorterThanNs)}. Capture a few times: every capture lands on the frame marker.`,
        `Many analyzers fire a pulse width trigger when the pulse **ends**: with a "shorter than" limit, only then is the width known. Your trigger mark may sit at the end of the ${formatTime(marker)} pulse rather than its start.`,
        `No pulse width trigger? Trigger on the rising edge of GP8 instead: its ${formatTime(highNs(8))} pulse starts with the frame marker.`,
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
      q: 'Why not just use an edge trigger on GP9?',
      a: `It usually works, which is the trap. An edge trigger fires on the first rising edge after you arm it. About ${Math.round(markerTriggerShare() * 10)} times in 10 that is the frame marker, because it follows the long quiet stretch, but arm it during the busy start of the frame and it fires on whichever of the ${patternPulses().length} pulses comes next. The pulse width trigger lands on the marker every time.`,
    },
    {
      q: 'When would you choose single mode over repeat mode?',
      a: 'For rare or one-off events: single mode stops after the first trigger, so the capture you wanted is not overwritten by the next one.',
    },
  ],
};
