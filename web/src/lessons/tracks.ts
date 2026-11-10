// The guide's tracks, in order. Each has a landing page (#/track/<id>) that introduces it and lists its lessons.

import type { TrackId } from './types';

export interface Track {
  id: TrackId;
  /** The name lesson pages and the track page show. */
  label: string;
  /** A shorter name for the sidebar, where the full one would wrap. */
  short?: string;
  /** What the track teaches and what it needs, for its landing page. */
  intro: string;
}

export const tracks: Track[] = [
  {
    id: 'concepts',
    label: 'Concepts',
    intro:
      'How a logic analyzer works and the words it uses, before or alongside your first captures: sampling, thresholds, triggers, memory, and the numbers you read off a capture. Come back to these whenever a capture surprises you.',
  },
  {
    id: 'learn',
    label: 'Learn',
    intro:
      'Capturing, triggering and measuring, mostly on the square waves and pulses on GP0-GP9 and the bouncing button on GP26, which play the same signals in every preset. A few later lessons use the protocol buses as examples.',
  },
  {
    id: 'protocols',
    label: 'Protocols',
    intro:
      'The buses you meet on real boards, one at a time: what each looks like, how to set up the capture, and how to read the bytes by hand. On GP10-GP22 with the Protocols preset, which the board plays unless you choose another.',
  },
  {
    id: 'decoders',
    label: 'Decoders',
    intro:
      'Letting the software read the bytes for you: what decoders do and which ones your software may have, stacking them, and what wrong settings look like, so you can tell a bad decode from a bad bus. Uses the Protocols preset.',
  },
  {
    id: 'video',
    label: 'Video and input',
    intro:
      'Signals that are more than a stream of bytes: the timing of a VGA picture, an NES controller and a PS/2 keyboard. Needs the Video and input preset.',
  },
  {
    id: 'faults',
    label: 'Find the bug',
    intro:
      'Real debugging starts from something broken. Each lesson shows a symptom on a bus with a realistic mistake, next to a good transaction, and you find the cause. Needs the Faults preset.',
  },
  {
    id: 'verify',
    label: 'Verify your analyzer',
    short: 'Verify',
    intro:
      'Checking the analyzer itself: that every input works, how accurate its clock is, the skew between inputs and how fast it really goes. Most checks need the Verify preset.',
  },
  {
    id: 'hardware',
    label: 'On real hardware',
    intro:
      'Taking the analyzer to circuits other than the bench: probing safely, connecting to a real board, pull-ups and voltage levels, finding signals on an unknown board, and a method for debugging. Reading only, no bench needed.',
  },
];

export function trackById(id: string): Track | undefined {
  return tracks.find((t) => t.id === id);
}

export function trackLabel(id: TrackId): string {
  return trackById(id)?.label ?? id;
}
