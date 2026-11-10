// Concept: reading the timing diagrams and timing tables in datasheets, and checking a capture against
// them. The I²C limits are from the I²C-bus specification; the bench's clock comes from protocols.json.

import { formatHz, formatTime } from '../../model/format';
import { gpioOf, protocolData as p } from '../../model/protocols';
import type { Lesson } from '../types';

// I²C-bus specification, minimum times in ns for standard mode (100 kHz) and fast mode (400 kHz).
const i2cLimits: [string, string, number, number][] = [
  ['tHD;STA', 'Hold time after a (repeated) START, before the first clock low', 4000, 600],
  ['tLOW', 'Clock low time', 4700, 1300],
  ['tHIGH', 'Clock high time', 4000, 600],
  ['tSU;STA', 'Setup time before a repeated START', 4700, 600],
  ['tSU;DAT', 'Data setup time before the clock rises', 250, 100],
  ['tSU;STO', 'Setup time before a STOP', 4000, 600],
  ['tBUF', 'Bus free time between a STOP and the next START', 4700, 1300],
];
const halfNs = 1e9 / p.i2c.clockHz / 2;

export const timingDiagrams: Lesson = {
  id: 'timing-diagrams',
  track: 'concepts',
  title: 'Reading a datasheet timing diagram',
  summary: 'Setup, hold, minimum and maximum: how to read the timing section of a datasheet and check a capture against it.',
  gpios: [],
  intro:
    'Every chip datasheet has a timing section: a diagram of the signals with arrows between edges, and a table of the times those arrows stand for. It is what "right" means for that chip, and an analyzer is the tool that measures it. Once you can read one, you can check any interface against its specification, not only against a decoder\'s opinion.',
  sections: [
    {
      title: 'The diagram',
      body: [
        'A timing diagram draws each signal as a line over time. A few conventions are nearly universal:',
      ],
      bullets: [
        '**Slanted edges** are drawn on purpose: real edges take time, and measurements start and end at a stated point on them, usually 30% and 70% or 10% and 90% of the supply, or a threshold voltage.',
        '**Two crossing lines** (an X, or a hexagon shape) on a data line mean "valid data, either 0 or 1". The crossing is where the data may change.',
        '**Hatching or a gray band** means "don\'t care" or "not valid": the value may be anything there, and the receiver must not look at it.',
        '**A line in the middle** means the pin is not driven (high impedance), for example MISO while no device is selected.',
        '**Arrows with labels** between two edges point to a row of the timing table.',
      ],
    },
    {
      title: 'Setup, hold and the rest',
      body: ['Most parameters are one of a few kinds. Their names vary between manufacturers, but the ideas do not.'],
      bullets: [
        '**Setup time:** how long before a clock edge the data must already be stable. The receiver needs time to see it.',
        '**Hold time:** how long after the clock edge the data must stay stable.',
        '**Pulse width** (high time, low time): the shortest pulse a pin accepts. Shorter ones may be ignored or misread.',
        '**Clock period or frequency:** the limits of the clock itself.',
        '**Propagation or output delay:** how long after an input changes (often a clock edge) the chip\'s output changes. This one is a promise the chip makes, not a demand on you.',
      ],
    },
    {
      title: 'Minimum, typical, maximum',
      body: [
        'The table gives each parameter as a minimum, a maximum, or both, and sometimes a typical value. Design and check against the limits, never the typical value: typical is what one chip did at room temperature.',
        'Read the direction carefully. A **setup time minimum** is a demand on whoever drives the data: the capture must show at least that much. An **output delay maximum** is a promise from the chip: its output will change no later than that, so the receiver must wait at least that long. A capture that violates a demand points at the sender; one that violates a promise points at the chip (or at your measurement).',
      ],
    },
    {
      title: 'An example: I²C',
      body: [
        `The I²C specification has one table for every bus. The limits below are minimums; the measurement points are at 30% and 70% of the supply. At ${formatHz(p.i2c.clockHz)}, the bench's clock is high and low for ${formatTime(halfNs)} each, which you can check against tLOW and tHIGH in a capture of GP${gpioOf('i2c', 'scl')} and GP${gpioOf('i2c', 'sda')} from the I²C lesson.`,
      ],
      table: {
        title: 'I²C timing, minimums',
        head: ['Parameter', 'Meaning', 'Standard mode', 'Fast mode'],
        rows: i2cLimits.map(([name, meaning, std, fast]) => [`\`${name}\``, meaning, formatTime(std), formatTime(fast)]),
      },
    },
    {
      title: 'Measuring it',
      body: [
        'Pick a sample rate that resolves the smallest limit you need to check with room to spare: at least a few samples within it. To check a 250 ns setup time you want 20 MS/s or more; 100 ns needs 50 MS/s or more. Each measurement is uncertain by about one sample, so a result within one sample of the limit is not proof either way.',
        'Measure the worst case, not the first one you see: the shortest high, the smallest setup time, over many bytes. A long capture and a script over an exported file, as in the "Exporting and scripting" lesson, do this far better than scrolling.',
        'Remember that the analyzer measures at its own threshold, not at the 30% and 70% points. For slow edges, the difference can be tens or hundreds of nanoseconds. When a measurement is close to a limit, that is a question for a scope.',
      ],
    },
  ],
  parts: [],
  questions: [
    {
      q: 'An SPI flash datasheet says "data in setup time: 2 ns min" and "clock low to output valid: 7 ns max". Which one is a demand on your microcontroller?',
      a: 'The setup time: your controller drives the data in, and must have it stable at least 2 ns before the clock edge. The output valid time is the flash\'s promise: its data out will be valid no later than 7 ns after the clock falls, so your controller must not sample it earlier.',
    },
    {
      q: `Your capture of a 400 kHz I²C bus shows a clock high time of ${formatTime(560)} at 25 MS/s. Does it meet fast mode?`,
      a: `Probably not, but it is close: fast mode needs at least ${formatTime(600)}, and at 25 MS/s each measurement is uncertain by ${formatTime(40)}. Measure at a higher rate, look at several bytes for the shortest high, and keep in mind that slow rising edges make highs look shorter on an analyzer than at the 30% and 70% points.`,
    },
    {
      q: 'The datasheet lists a "typical" hold time of 5 ns and no minimum. Can you rely on 5 ns?',
      a: 'No. Typical is what a sample chip did in the lab. Without a guaranteed minimum, design as if it could be zero, and do not count on the data staying valid after the edge.',
    },
  ],
};
