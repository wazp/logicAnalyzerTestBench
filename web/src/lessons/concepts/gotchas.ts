// Concept: the mistakes almost everyone makes, by symptom.

import type { Lesson } from '../types';

export const gotchas: Lesson = {
  id: 'gotchas',
  track: 'concepts',
  title: 'Common gotchas',
  summary: 'Weird captures and what usually causes them, organized by what you see.',
  gpios: [],
  intro:
    'Most confusing captures come from a short list of causes, and nearly all of them are in the setup rather than the circuit. Look up what you see, and check the setup before you blame the hardware.',
  sections: [
    {
      title: 'A checklist before every capture',
      body: [],
      bullets: [
        '**Ground** is connected, close to the signals.',
        'The **threshold** or logic level matches the circuit (1.8V, 3.3V or 5V).',
        'The **sample rate** is at least 4 times the fastest signal, 10 times if you measure timing.',
        'The **capture** is long enough to include the whole event.',
        'The **trigger** is on a signal that marks the start of what you want.',
        'The **decoder settings** match the protocol: speed, bits, parity, bit order, mode.',
      ],
    },
    {
      title: 'By symptom',
      body: [],
      table: {
        title: 'By symptom',
        head: ['What you see', 'Likely cause', 'Try'],
        rows: [
          ['Random edges, or a faint copy of a neighboring signal', 'No ground connection, or the probe is not on the pin', 'Connect ground first; check each probe'],
          ['Short extra pulses around edges', 'Slow edges or noise near the threshold; long or tangled leads', 'Shorter leads, an extra ground lead, the right threshold, a glitch filter as a last resort'],
          ['A signal never goes high', 'Threshold above the signal\'s high level, or the wrong logic level setting', 'Pick the logic level of the circuit'],
          ['A frequency looks wrong, or changes with the sample rate', 'Aliasing: the sample rate is too low', 'Sample 4 to 10 times faster (see the aliasing lesson)'],
          ['Short pulses are missing or come and go', 'The pulse is shorter than one sample period', 'Raise the sample rate'],
          ['The decoder shows garbage or framing errors', 'Wrong decoder settings: baud rate, data bits, parity, bit order, SPI mode, or an inverted signal', 'Measure one bit by hand, then match the settings'],
          ['The decoder shows nothing at all', 'The decoder is assigned to the wrong inputs, or the capture starts mid-transaction', 'Check which input is which; trigger on the start (CS, a start bit)'],
          ['An I²C or 1-Wire line is stuck low or rises very slowly', 'Missing or too weak pull-up resistor (these buses are open drain)', 'Add a pull-up, or use a smaller resistor'],
          ['Two inputs show exactly the same thing', 'Both probes on one pin, or a short between pins', 'Check the wiring'],
          ['The capture stops early or has gaps', 'A streaming analyzer ran out of USB bandwidth', 'Fewer inputs, a lower sample rate, or a USB port without a hub'],
          ['Everything looks inverted', 'An active-low signal, or an inverting receiver (IR receivers, RS-232)', 'Invert the input or the decoder setting'],
        ],
      },
    },
  ],
  parts: [],
  questions: [
    {
      q: 'A UART decoder shows garbage. What is the fastest way to find the right baud rate?',
      a: 'Measure the narrowest pulse in a character: that is one bit. 1 / bit time is the baud rate; pick the nearest standard value. The UART lesson walks through it.',
    },
    {
      q: 'An I²C bus works on the bench but your capture shows slow, rounded rising edges. Is the analyzer wrong?',
      a: 'No: open-drain buses rise through the pull-up resistor, and a large resistor or a long bus makes that slow. The analyzer only shows when the edge crosses its threshold; an oscilloscope shows the shape.',
    },
  ],
};
