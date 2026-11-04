// Concept: the words nearly every analyzer app uses, and their synonyms.

import type { Lesson } from '../types';

export const vocabulary: Lesson = {
  id: 'vocabulary',
  track: 'concepts',
  title: 'The words analyzers use',
  summary: 'A glossary of the terms you will meet in almost every analyzer app, with the other names they go by.',
  gpios: [],
  intro:
    'Every analyzer and every app names things a little differently, but the ideas are the same everywhere. Once you know the idea, you can find it in any software.',
  sections: [
    {
      title: 'Capturing',
      body: [],
      table: {
        title: 'Capturing',
        head: ['Term', 'What it means', 'Also called'],
        rows: [
          ['**Input**', 'One signal the analyzer records.', 'channel, probe, line, D0/D1...'],
          ['**Sample rate**', 'How many times per second each input is read.', 'sampling frequency, S/s, MS/s, MHz'],
          ['**Sample depth**', 'How many samples fit in one capture.', 'memory depth, buffer size, samples'],
          ['**Capture length**', 'How long a capture lasts: sample depth / sample rate.', 'capture window, duration, record length'],
          ['**Threshold**', 'The voltage that separates a 0 from a 1.', 'logic level, VREF, input voltage setting'],
          ['**Streaming**', 'Sending samples to the computer while capturing, instead of storing them first.', 'USB streaming, continuous mode'],
          ['**Compression**', 'Storing only the moments a signal changes, to fit longer captures.', 'RLE (run-length encoding)'],
          ['**Group**', 'Several inputs shown together as one value.', 'bus, channel group'],
        ],
      },
    },
    {
      title: 'Triggering',
      body: [],
      table: {
        title: 'Triggering',
        head: ['Term', 'What it means', 'Also called'],
        rows: [
          ['**Trigger**', 'The condition that marks the moment you care about.', 'trigger condition, event'],
          ['**Pre-trigger**', 'Samples kept from before the trigger.', 'pre-trigger buffer, trigger position'],
          ['**Post-trigger**', 'Samples recorded after the trigger.', 'post-trigger samples'],
          ['**Edge trigger**', 'Fires when one input rises or falls.', 'rising/falling/any edge'],
          ['**Pattern trigger**', 'Fires when several inputs match a set of levels at once.', 'level, condition, word trigger'],
          ['**Pulse width trigger**', 'Fires on a pulse longer or shorter than a set time.', 'width, duration, glitch trigger'],
          ['**Single / repeat**', 'Capture once, or again on every trigger.', 'single shot, normal, continuous, run/stop'],
        ],
      },
    },
    {
      title: 'Reading a capture',
      body: [],
      table: {
        title: 'Reading a capture',
        head: ['Term', 'What it means', 'Also called'],
        rows: [
          ['**Decoder**', 'Turns raw bits into bytes, addresses and messages for a protocol.', 'protocol analyzer, annotation'],
          ['**Cursor**', 'A movable line for measuring time between two points.', 'marker, timing marker'],
          ['**Delta**', 'The time between two cursors, or between two edges.', 'Δt, interval'],
          ['**Glitch**', 'A pulse much shorter than expected, usually noise or a slow edge.', 'spike, runt'],
          ['**Glitch filter**', 'Ignores pulses shorter than a set time.', 'noise filter, debounce'],
          ['**Export**', 'Saving the capture for other tools.', 'CSV, VCD, binary, .sr'],
          ['**State mode**', 'Sampling on an external clock from the circuit instead of the analyzer clock.', 'synchronous mode, external clock'],
          ['**MSO**', 'An instrument that combines an oscilloscope and a logic analyzer.', 'mixed signal oscilloscope'],
        ],
      },
    },
  ],
  parts: [],
  questions: [
    {
      q: 'Your app has "memory depth 1M" and a sample rate of 10 MHz. How long can a capture be?',
      a: '1,000,000 samples / 10,000,000 samples per second = 100 ms. "MHz" and "MS/s" mean the same thing here.',
    },
    {
      q: 'Your analyzer\'s inputs are called D0 to D7, but this guide talks about GP10 and GP11. How do you keep track?',
      a: 'Most apps let you rename inputs. Name them after the Pico pin you connected (GP10, GP11), and the capture matches the guide whatever the hardware calls them.',
    },
  ],
};
