// Real hardware capstone: a case to work through, from a vague symptom to a fix, using the whole track. The
// sensor encoding and the bench's I²C settings come from protocols.json; rise times are computed. Reading only.

import { formatHz, formatTime } from '../../model/format';
import { hexByte, protocolData as d } from '../../model/protocols';
import { bytesHex } from '../helpers';
import type { Lesson } from '../types';

// The board in the story: an I²C sensor on a cable, 10 kΩ pull-ups, fast mode.
const pullupOhms = 10_000;
const fixOhms = 2_200;
const cablePf = 100; // About 100 pF per meter for ribbon or twisted wire, 1 m of it.
const pinsPf = 30; // Inputs, pads and the board traces.
const busPf = cablePf + pinsPf;
const fastHz = 400_000;
const fastMaxRiseNs = 300; // I²C fast mode, 30% to 70%.
const standardMaxRiseNs = 1000;
const riseNs = (ohms: number, pf: number) => ohms * pf * 1e-3 * Math.log(0.7 / 0.3);
const slow = riseNs(pullupOhms, busPf);
const fixed = riseNs(fixOhms, busPf);

// The sensor reports like the bench's: 12 bits, left aligned, 0.0625 °C per step, two's complement. Nobody
// driving SDA during a read gives all ones.
const allOnes = [0xff, 0xff];
const raw = ((allOnes[0] << 4) | (allOnes[1] >> 4)) - 4096;
const bogusC = raw * 0.0625;

export const hardwareCapstone: Lesson = {
  id: 'hardware-capstone',
  track: 'hardware',
  capstone: true,
  title: 'Capstone: the sensor that lies when the fan runs',
  summary: 'A real-world case from first symptom to fix: safety, where to connect, what the analyzer shows, and what it cannot.',
  gpios: [],
  intro: `A small controller reads a temperature sensor over I²C at ${formatHz(fastHz)} and switches a fan. The sensor sits at the end of a 1 m cable, with ${pullupOhms / 1000} kΩ pull-ups on the controller board. Most readings are fine. Now and then the controller logs ${bogusC} °C, and every few minutes a read fails outright, more often while the fan runs. The fan runs from a 12 V supply; the controller from 3.3 V. Work through the questions in order, and answer each before you open it.`,
  sections: [
    {
      title: 'The case',
      body: [
        `The sensor works like the one on the test bench: the controller writes register \`${hexByte(d.i2c.register)}\`, then reads two bytes, a 12-bit temperature in steps of 0.0625 °C. The controller board has a header with GND, 3V3, SDA and SCL. The fan is driven by a transistor on the same board, from the 12 V supply.`,
        'You have a logic analyzer, a multimeter, and a scope you can borrow for an hour.',
      ],
    },
  ],
  parts: [],
  questions: [
    {
      q: '1. Before connecting anything: what do you check?',
      a: 'Grounds and voltages. Measure with the multimeter that SDA and SCL idle at 3.3 V, not 12 V, and find GND on the header. Check how the boards are powered: if the 12 V supply and your computer share no ground, connect the analyzer ground first, to the controller\'s GND, before any signal. Keep clips away from the 12 V fan wiring.',
    },
    {
      q: '2. Where do you connect the analyzer, and to what?',
      a: 'GND, SDA and SCL at the controller\'s header, plus one more input on something that shows when the fan switches: the fan transistor\'s control signal, if you can find it in the schematic or on the board. That one extra wire will tell you whether failures line up with the fan.',
    },
    {
      q: `3. Where does "${bogusC} °C" come from?`,
      a: `It is what the bytes \`${bytesHex(allOnes)}\` mean: the 12-bit value \`0xFFF\` is ${raw} in two's complement, times 0.0625 is ${bogusC} °C. All ones on an open-drain bus means nobody pulled SDA low during the read: the pull-up did all the "talking". So the sensor did not answer those bits at all, or the controller sampled before the line had settled. Either way, it is a bus problem, not a sensor reading.`,
    },
    {
      q: '4. You capture a few hundred reads. The good reads and the failed reads look the same, except that the failed ones end in a NAK or read all ones. What do you look at next?',
      a: 'The edges, with the scope: when the digital picture of a failure matches a success, the cause is usually analog. On the scope, measure how long SDA and SCL take to rise, and look for spikes on them when the fan switches on or off.',
    },
    {
      q: '5. The scope shows rising edges of about a microsecond. Is that a problem?',
      a: `Yes. The rise time from 30% to 70% is about R × C × 0.85: with ${pullupOhms / 1000} kΩ and roughly ${busPf} pF (${cablePf} pF of cable and ${pinsPf} pF of pins and traces), that is ${formatTime(slow)}. Fast mode allows ${formatTime(fastMaxRiseNs)}; even standard mode allows only ${formatTime(standardMaxRiseNs)}. The receiver reads SDA while it is still rising, and some reads catch it below the threshold. The analyzer could not show this: it only records when its own threshold is crossed.`,
    },
    {
      q: '6. What is the fix, and how do you check it?',
      a: `Stronger pull-ups (${fixOhms / 1000} kΩ gives ${formatTime(fixed)}, inside fast mode), a lower clock (standard mode, ${formatHz(100_000)}), a shorter or lower-capacitance cable, or a bus buffer for long cables. Change one thing at a time, then capture again for as long as it took to see a failure before, several times over, with the fan switching. "It worked once" proves nothing for a fault that came every few minutes.`,
    },
    {
      q: '7. The failures got rarer, but one still comes exactly when the fan switches on. Now what?',
      a: 'Look at the scope on SDA, SCL and GND at the moment the fan turns on, triggered on the fan control signal. A spike on the clock line or a jump in ground there is coupled noise from the fan current, which shares ground with the controller. Fixes are in the hardware: a flyback diode across the fan, separate ground returns for the fan current, a small capacitor at the fan, routing the cable away from the fan wires. The analyzer\'s part was showing that every remaining failure lines up with one event.',
    },
  ],
};
