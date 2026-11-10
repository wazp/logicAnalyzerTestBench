// Real hardware: a repeatable way to debug with an analyzer, from the expected behavior to the one
// change that fixes it. Reading only.

import type { Lesson } from '../types';

export const debugMethod: Lesson = {
  id: 'debug-method',
  track: 'hardware',
  title: 'A method for debugging with an analyzer',
  summary: 'Know what right looks like, capture the good case, trigger on the symptom, compare, and change one thing at a time.',
  gpios: [],
  intro:
    'An analyzer shows you exactly what happened, which is only useful if you know what should have happened and can find the moment it went wrong. Beginners often capture everything and scroll, hoping the problem jumps out. A plain method works much better, and it is the same whether the bug is in wiring, timing or firmware.',
  sections: [
    {
      title: '1. Write down what right looks like',
      body: [
        'Before capturing, write down what you expect to see: which bytes, in which order, at what speed, with what gaps. The chip\'s datasheet (its timing diagrams and command tables) and your own code tell you. Without this, every capture looks plausible.',
        'Be specific: "the sensor answers with two bytes, and the temperature register should read about 25 °C" is checkable; "the sensor should work" is not.',
      ],
    },
    {
      title: '2. Capture a good case first',
      body: [
        'If anything works (an older firmware, another board, the first reading before it fails), capture it first. A good capture is the best reference there is: it shows the real timing, the real gaps and the real order, including the parts the datasheet does not mention. Save it with a note of what it is.',
      ],
    },
    {
      title: '3. Trigger on the symptom',
      body: [
        'Find a signal that marks the failure and trigger on it, with enough capture before the trigger to see the cause. Good markers: a NAK on I²C, an error message on a serial console, a reset line, a chip-select that stays low too long, an interrupt that never comes.',
        'If nothing marks the failure, make a marker: have your firmware toggle a spare pin when it detects the error, and trigger on that pin. The next lesson, "Timing your own code with a spare pin", shows how. This one trick turns a bug that happens once an hour into a capture you can look at.',
      ],
    },
    {
      title: '4. Compare, then explain the difference',
      body: [
        'Put the good and bad captures side by side and find the first point where they differ. The first difference is the one that matters; everything after it may just be a consequence.',
        'Then explain the difference before changing anything. "The bad case starts the read 20 µs after the write instead of 200 µs, and the datasheet asks for 100 µs" is an explanation. "It looks different" is not yet.',
      ],
    },
    {
      title: '5. Change one thing, then capture again',
      body: [
        'Change one thing based on your explanation, and capture again with the same settings. If the capture now matches the good case and the symptom is gone, you found it. If the symptom is gone but the capture still differs, you found a workaround, not the cause. Changing several things at once makes it impossible to know which one mattered.',
      ],
    },
    {
      title: 'Habits that save hours',
      body: [],
      bullets: [
        '**Read by hand before trusting a decoder.** Check one byte against the waveform; "When the decoder shows garbage" explains how decoders can be wrong.',
        '**Check the obvious first:** ground, power, the right pins, the right threshold, a sample rate at least four times the fastest signal. The "Common gotchas" lesson lists the rest.',
        '**Measure, don\'t assume.** "The clock is 1 MHz" is a setting in your code; the capture tells you what the pin actually does.',
        '**Save every interesting capture,** named with what it shows and the date. Export the ones you will want to process with a script.',
        '**Keep a log** of what you tried and what you saw. When a bug takes days, the log is how you avoid testing the same idea twice.',
      ],
    },
  ],
  parts: [],
  questions: [
    {
      q: 'A sensor works for minutes, then returns garbage until the board is reset. How do you capture the moment it goes wrong?',
      a: 'Make the firmware detect the garbage (an impossible value, a bad checksum) and toggle a spare pin when it does. Trigger on that pin with a long pre-trigger part, so the capture shows the last good reads and the first bad one. Then compare the last good transaction with the first bad one.',
    },
    {
      q: 'Your good and bad captures differ in three places. Which one do you investigate?',
      a: 'The first one, in time. A single early fault (a missed ACK, a byte out of sync) usually causes the later differences, which disappear when the first one is fixed.',
    },
    {
      q: 'You changed the I²C speed, the pull-ups and a delay in your code, and now it works. What did you learn?',
      a: 'That one or more of the three mattered, but not which. Undo them one at a time (or apply them one at a time) with a capture after each, so you know the cause and do not keep changes that only hide it.',
    },
  ],
};
