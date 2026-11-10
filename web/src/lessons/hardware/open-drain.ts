// Real hardware: open-drain buses, pull-up resistors and the slow rising edges they make, which the test
// bench (push-pull) does not show. Rise times are computed from R and C. Reading only.

import { formatHz, formatTime } from '../../model/format';
import { gpioOf, protocolData } from '../../model/protocols';
import type { Lesson } from '../types';

// Rise time from 30% to 70% of the supply through a resistor charging the bus capacitance:
// t = R * C * ln(0.7 / 0.3), the definition the I²C specification uses.
const riseNs = (ohms: number, pf: number) => ohms * pf * 1e-3 * Math.log(0.7 / 0.3);

// Maximum rise time per I²C speed mode, from the I²C-bus specification.
const modes = [
  { name: 'Standard mode (100 kHz)', maxNs: 1000 },
  { name: 'Fast mode (400 kHz)', maxNs: 300 },
  { name: 'Fast mode plus (1 MHz)', maxNs: 120 },
];
const resistors = [10_000, 4_700, 2_200, 1_000];
const caps = [50, 200, 400];
const ohms = (r: number) => (r >= 1000 ? `${r / 1000} kΩ` : `${r} Ω`);
const fastest = (ns: number) => modes.filter((m) => ns <= m.maxNs).map((m) => m.name.split(' (')[0]).pop() ?? 'too slow for any';

export const openDrain: Lesson = {
  id: 'open-drain',
  track: 'hardware',
  title: 'Open-drain buses and pull-ups',
  summary: 'Why I²C and 1-Wire need pull-up resistors, what slow rising edges look like, and what changes from the test bench.',
  gpios: [],
  intro: `On the test bench, the I²C pins (GP${gpioOf('i2c', 'scl')} and GP${gpioOf('i2c', 'sda')}) and the 1-Wire pin (GP${gpioOf('onewire', 'dq')}) are driven both ways by the Pico, so their edges are sharp in both directions. On a real board these buses are open-drain: chips can only pull the line low, and a resistor pulls it back up. That one difference explains most of what looks odd when you capture a real I²C or 1-Wire bus.`,
  sections: [
    {
      title: 'Push-pull and open-drain',
      body: [
        'A **push-pull** output has a transistor to the supply and one to ground, and always drives the line one way or the other. UART, SPI and most chip outputs are push-pull. Two push-pull outputs on one wire fight when they disagree.',
        'An **open-drain** (or open-collector) output only has the transistor to ground. It can pull the line low or let go. A **pull-up resistor** brings the line high when nobody pulls it low. Any number of chips can share the wire safely: if any of them pulls low, the line is low. I²C uses this for ACKs, clock stretching and several controllers on one bus; 1-Wire uses it for the presence pulse and for every bit the device sends back.',
      ],
    },
    {
      title: 'Slow rising edges',
      body: [
        'A chip pulls the line low through a transistor, so falling edges are fast. Rising edges come from the resistor charging the capacitance of the wires, the pins and your probe, so they follow a curve whose speed depends on R × C. The I²C specification limits the time from 30% to 70% of the supply, which is R × C × ln(7/3), about 0.85 × R × C.',
        'In a capture, a slow rising edge crosses the analyzer\'s threshold late. Highs look shorter and lows longer than they really are, by the same amount on every bit. On an I²C bus with weak pull-ups, a 50% duty clock can look like 40% high.',
      ],
      table: {
        title: 'Rise time (30% to 70%) for common pull-ups',
        head: ['Pull-up', ...caps.map((c) => `${c} pF bus`)],
        rows: resistors.map((r) => [ohms(r), ...caps.map((c) => `${formatTime(riseNs(r, c))} (${fastest(riseNs(r, c))})`)]),
      },
    },
    {
      title: 'Choosing and checking pull-ups',
      body: [
        `The table shows the fastest mode each combination allows: ${modes.map((m) => `${m.name.split(' (')[0].toLowerCase()} allows ${formatTime(m.maxNs)}`).join(', ')}. A short bus on one board is around 50 pF; a few modules on wires can reach 200 pF; the specification allows at most 400 pF.`,
        'Smaller resistors make faster edges but more current when the line is low, and a chip can only sink so much while still reaching a valid low. That is why 4.7 kΩ and 2.2 kΩ are the usual values, and why a stronger pull-up is not always better.',
        'Breakout modules often include their own pull-ups. Three modules with 10 kΩ each on one bus make about 3.3 kΩ in parallel, which is fine; ten modules with 4.7 kΩ each make 470 Ω, which some chips cannot pull low enough.',
      ],
    },
    {
      title: 'What goes wrong, and how it looks',
      body: [],
      table: {
        title: 'Open-drain trouble in a capture',
        head: ['What you see', 'Likely cause'],
        rows: [
          ['The line is low all the time, or never rises', 'No pull-up at all, or a chip holding it low (a stuck bus after a reset in the middle of a byte)'],
          ['The line wanders, toggles at random, or follows a neighbor', 'No pull-up: the line is floating'],
          ['Highs shorter than lows on every bit, glitches at the rising edges', 'Pull-up too weak for the bus capacitance, or the probe adds too much'],
          ['A low that is not quite low (only a scope shows it), or a chip that cannot ACK', 'Pull-ups too strong in total, too many in parallel'],
          ['Data changes while the clock is high', 'Often a real bug, but first rule out slow edges making the clock look earlier or later than it is'],
        ],
      },
    },
    {
      title: 'Back to the test bench',
      body: [
        `The bench simulates both sides of the bus and drives every edge sharp, which is why its ${formatHz(protocolData.i2c.clockHz)} I²C clock has a clean 50% duty cycle. Never connect these pins to a real bus: a push-pull output driving high fights any chip that pulls low. On real hardware, expect the softer rising edges described here, and judge timing at the falling edges, which are sharp.`,
      ],
    },
  ],
  parts: [],
  questions: [
    {
      q: 'An I²C clock that should be 50% duty shows 42% high and 58% low on your analyzer. Is the controller misconfigured?',
      a: 'Probably not. Slow rising edges cross the threshold late, which shortens every high by the same amount. Measure the clock period between falling edges, which are sharp: if the frequency is right, the pull-ups are on the weak side for the bus. A lower threshold setting, if your analyzer has one, moves the highs back toward 50%.',
    },
    {
      q: `Using the table: a fast mode bus (400 kHz) with about 200 pF of wiring. Is 4.7 kΩ enough?`,
      a: `No. 4.7 kΩ with 200 pF gives about ${formatTime(riseNs(4700, 200))}, above the ${formatTime(300)} fast mode allows, and even ${ohms(2200)} gives ${formatTime(riseNs(2200, 200))}. It takes about ${ohms(1000)} (${formatTime(riseNs(1000, 200))}), so first try to shorten the wiring; if you do go that low, check that every chip can sink the extra current.`,
    },
    {
      q: 'A 1-Wire bus shows a reset pulse, but no presence pulse, although the sensor is connected. What is the first thing to check?',
      a: 'The pull-up. Without it the device cannot be powered (1-Wire devices often take their power from the data line) and the line never returns high for the device to answer. A typical value is 4.7 kΩ to the supply.',
    },
  ],
};
