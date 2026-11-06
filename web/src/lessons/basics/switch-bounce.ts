// Lesson: switch bounce, on the GP26 button. Every number shown is computed from signals.json (the firmware's own
// config), so the lesson stays correct when the defaults change.

import { formatTime } from '../../model/format';
import { bounceTiming } from '../../model/signals';
import { sig, wireSteps } from '../helpers';
import type { Lesson } from '../types';

const button = 26;
const b = bounceTiming(sig(button));
const pressEdges = b.pressFalling;
const countedPresses = b.pressFalling + b.releaseFalling;
const slowRate = 10_000;
// The press starts with a low segment, so the first rising edge ends it.
const firstRiseNs = sig(button).segments[0].ns;

export const switchBounce: Lesson = {
  id: 'switch-bounce',
  track: 'learn',
  title: '8. Switch bounce',
  summary: 'Why one button press can count as several, and how to choose a debounce time.',
  gpios: [button],
  intro: `GP${button} behaves like a push button with a pull-up resistor: high when released, low while pressed. It is pressed every ${formatTime(b.periodNs)} and held for ${formatTime(b.heldNs)}. Like a real button, its metal contacts bounce when they close and open, so the line flips back and forth a few times before it settles.`,
  sections: [
    {
      title: 'What bounce is',
      body: [
        'When two metal contacts meet, they hit, spring apart and hit again, several times, within a fraction of a millisecond to a few milliseconds. Every one of those touches is a real edge. A person never notices, but a microcontroller is fast enough to see every one, so a counter counts several presses, or a menu skips ahead.',
        'Software fixes it with a **debounce**: after the first edge, ignore the pin until it has stayed the same for a while. A logic analyzer is how you find out how long that while has to be.',
      ],
    },
  ],
  parts: [
    {
      title: 'Catch one press',
      settings: {
        gpios: [button],
        sampleRateHz: 2_000_000,
        durationNs: 1e6,
        preTriggerNs: 100e3,
        trigger: { type: 'edge', gpio: button, edge: 'falling' },
      },
      steps: [
        ...wireSteps([button]),
        `Capture, triggered on the falling edge of GP${button}. The trigger fires on the very first touch of the contacts.`,
        'Count the falling edges until the line stays low, and measure how long that takes from the trigger.',
        'Find the longest stretch in the middle of the bounce where the line is back high.',
      ],
      views: [
        {
          title: 'One press',
          startNs: -100e3,
          endNs: 1e6,
          sampleRateHz: 2_000_000,
          sampleRateOptions: [2_000_000, 100_000, slowRate],
          caption: `${pressEdges} falling edges, settled ${formatTime(b.pressBounceNs)} after the first. The shortest spikes are ${formatTime(b.shortestNs)}: try the slower rates and watch them disappear.`,
        },
      ],
    },
    {
      title: 'Press and release',
      settings: {
        gpios: [button],
        sampleRateHz: slowRate,
        durationNs: 300e6,
        preTriggerNs: 10e6,
        trigger: { type: 'edge', gpio: button, edge: 'falling' },
      },
      steps: [
        `Capture ${formatTime(300e6)} at 10 kS/s, with the same trigger.`,
        `Find the release, ${formatTime(b.releaseStartNs)} after the trigger, and zoom in on it.`,
      ],
      views: [
        {
          title: 'Whole capture',
          startNs: -10e6,
          endNs: 300e6,
          sampleRateHz: slowRate,
          caption: `Pressed at the trigger, released ${formatTime(b.releaseStartNs)} later. At this zoom the bounce is far too short to see.`,
        },
        {
          title: 'The release',
          startNs: b.releaseStartNs - 50e3,
          endNs: b.releaseStartNs + 300e3,
          sampleRateHz: slowRate,
          sampleRateOptions: [slowRate, 2_000_000],
          caption: `At 10 kS/s most of the release falls between samples. Pick 2 MS/s to see what a fast capture shows: ${b.releaseRising} rising and ${b.releaseFalling} falling edges in ${formatTime(b.releaseBounceNs)}.`,
        },
      ],
    },
  ],
  questions: [
    {
      q: 'A program counts falling edges on this pin. How many presses does it count for one press and release?',
      a: `${countedPresses}: ${pressEdges} falling edges while the contacts close, and ${b.releaseFalling} more while they open. A falling edge in the release bounce is a falling edge like any other.`,
    },
    {
      q: 'What is the shortest debounce time that works for this button?',
      a: `It must be longer than the longest stretch the contacts look open in the middle of a press, ${formatTime(b.longestFalseReleaseNs)}, or the debounce ends too early. The whole bounce is over after ${formatTime(b.pressBounceNs)}, so 1 ms would do here. Real buttons vary and get worse as they wear, so 10 to 20 ms is the usual choice.`,
    },
    {
      q: 'At 10 kS/s the bounce nearly vanished. Is a slow sample rate a debounce?',
      a: `In a way: reading a button slowly (polling every few milliseconds) is a real and simple debounce method. But a capture at 10 kS/s can still land a sample on a bounce, and a microcontroller with an interrupt on the pin sees every edge, however short. To find the bounce, sample fast enough that the ${formatTime(b.shortestNs)} spikes span a few samples: 1 MS/s or more.`,
    },
    {
      q: 'You want to capture the release instead. Why does a trigger on a rising edge not work?',
      a: `The first rising edge comes ${formatTime(firstRiseNs)} into the press bounce, long before the release. Trigger on the falling edge and capture long enough (as in the second capture), or, if your analyzer has a pulse width trigger, trigger on a low pulse longer than 1 ms: only the held press matches, and many analyzers fire at its end, the moment of release.`,
    },
  ],
};
