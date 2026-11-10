// Real hardware: when a logic analyzer is the right tool, and when a multimeter or an oscilloscope answers the
// question better. Reading only.

import type { Lesson } from '../types';

export const whichTool: Lesson = {
  id: 'which-tool',
  track: 'hardware',
  title: 'Analyzer, scope or multimeter?',
  summary: 'What each tool can and cannot tell you, and which question to start with each.',
  gpios: [],
  intro:
    'A logic analyzer is excellent at one thing: the timing and content of many digital signals at once. Several common questions on a real board are better answered by a multimeter or an oscilloscope, and starting with the wrong tool costs time. Most debugging uses at least two of them.',
  sections: [
    {
      title: 'What each one sees',
      body: [],
      table: {
        title: 'Three tools',
        head: ['Tool', 'Sees', 'Cannot see'],
        rows: [
          [
            'Multimeter',
            'A steady voltage, resistance, continuity, current. The average of a fast signal.',
            'Anything that changes faster than a few times a second.',
          ],
          [
            'Oscilloscope',
            'The real voltage over time: levels, rise times, ringing, noise, analog signals. Usually 2 to 4 inputs.',
            'Long stretches at fine resolution, many signals at once; decoding is often limited or a paid option.',
          ],
          [
            'Logic analyzer',
            'Many signals as 0 and 1, over long captures, with exact timing and protocol decoding.',
            'Voltages, edge shapes, noise below the threshold, anything analog.',
          ],
        ],
      },
    },
    {
      title: 'Start with the multimeter when',
      body: [],
      bullets: [
        '**The board does nothing.** Measure the supply rails first. A missing 3.3 V explains a silent bus better than any capture.',
        '**You need to know the voltage** of a signal before connecting an analyzer: a line that idles at 5 V, or at 12 V, does not belong on a 3.3 V analyzer input.',
        '**You suspect a short or an open connection:** continuity mode, with the board unpowered.',
        '**You want to find ground** on an unknown board.',
      ],
    },
    {
      title: 'Use the scope when',
      body: [],
      bullets: [
        '**A decode is wrong now and then, and the timing looks fine.** The cause is often analog: slow rising edges on an open-drain bus, ringing on a fast clock, a level that only just reaches the threshold.',
        '**The analyzer shows extra edges** (glitches) and you need to know whether they are real pulses or noise near the threshold.',
        '**The signal is not digital:** audio, an analog sensor output, a supply that droops when a motor starts.',
        '**A measurement is close to a datasheet limit** and the analyzer\'s threshold is not the datasheet\'s measurement point.',
      ],
    },
    {
      title: 'Use the analyzer when',
      body: [],
      bullets: [
        '**You need to read the content** of a bus: bytes, addresses, commands.',
        '**Several signals matter together:** a chip select, a clock, data in both directions, an interrupt line.',
        '**The event is rare or the capture is long:** seconds of activity, a fault once a minute.',
        '**You need cause and effect in time:** which happened first, and how long after.',
      ],
    },
    {
      title: 'Together',
      body: [
        'A common sequence: the multimeter confirms power and voltage levels, the analyzer finds when and on which bus things go wrong, and the scope looks at the edges of the one transaction that failed. Some scopes have a few logic inputs too (a mixed-signal oscilloscope), and some analyzers have a slow analog input; both help, neither replaces the other.',
      ],
    },
  ],
  parts: [],
  questions: [
    {
      q: 'An I²C decode shows a NAK about once in a hundred reads, and the timing of the failed reads looks the same as the good ones. Which tool next?',
      a: 'The scope, on SDA and SCL. When the digital picture of a failure is identical to a success, the difference is probably analog: a slow rising edge that sometimes reaches the threshold too late, or noise at the moment the receiver samples. Trigger the scope on the NAK if it can decode, or on the analyzer\'s trigger output if it has one.',
    },
    {
      q: 'A board\'s UART console shows nothing at boot. What do you check first, and with what?',
      a: 'The multimeter: is the board powered (the rails), and what does the TX line idle at? A UART idles high: 3.3 V means the line is alive and probably just quiet or at another baud rate; 0 V can mean a wrong pin, an unpowered chip, or an inverted line. Then the analyzer, triggered on a falling edge on TX, to see whether anything is sent at all.',
    },
  ],
};
