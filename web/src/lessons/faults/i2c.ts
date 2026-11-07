// Find the bug: I²C. A sensor that stretches the clock, and one that refuses a write. Values from faults.json.

import { formatRate, formatTime } from '../../model/format';
import { faultsData as d, faultsExample, faultsGpio } from '../../model/faults';
import { hexByte } from '../../model/protocols';
import { bytesHex, exampleViewOf, protocolWireSteps } from '../helpers';
import type { Lesson } from '../types';

const scl = faultsGpio('i2c', 'scl');
const sda = faultsGpio('i2c', 'sda');
const rate = 1_000_000;
const lengthNs = (d.frameMs + 5) * 1e6;
const startOn = { gpio: sda, edge: 'falling' as const };
const halfNs = 1e9 / d.i2c.clockHz / 2;

export const faultsI2c: Lesson = {
  id: 'faults-i2c',
  track: 'faults',
  preset: 'faults',
  title: 'I²C: a slow sensor and a refused write',
  summary: 'Clock stretching that looks like a hang, and a NAK in the middle of a write.',
  gpios: [scl, sda],
  intro: `The controller talks to the same temperature sensor at ${hexByte(d.i2c.address)} twice per frame: it reads the temperature, and it writes the configuration register. Both transactions look a little odd. Find out what the sensor is doing, and whether either one is actually a problem.`,
  parts: [
    {
      title: 'Both transactions',
      settings: {
        gpios: [scl, sda],
        sampleRateHz: rate,
        durationNs: lengthNs,
        preTriggerNs: 50e3,
        trigger: { type: 'edge', ...startOn },
        decoder: `I²C with SCL on GP${scl} and SDA on GP${sda}`,
      },
      steps: [
        ...protocolWireSteps([scl, sda]),
        `Capture ${formatTime(lengthNs)} at ${formatRate(rate)}, triggered on the falling edge of GP${sda}. Both transactions are in it.`,
        'Decode as I²C. In the read, find the place where SCL stays low much longer than usual. Measure it. Who is holding it low?',
        'In the write, look at the ACK bit after each byte. Which byte is not acknowledged?',
      ],
      views: [
        exampleViewOf(faultsExample('i2c', 'stretch'), startOn, {
          title: 'Clock stretching',
          sampleRateHz: rate,
          caption: `After the read address, SCL stays low for ${formatTime(d.i2c.stretchUs * 1e3 + halfNs)} instead of ${formatTime(halfNs)}: the sensor holds it until its data is ready. Then the read finishes normally with ${bytesHex(d.i2c.value)}.`,
        }),
        exampleViewOf(faultsExample('i2c', 'data_nak'), startOn, {
          title: 'Data refused',
          sampleRateHz: rate,
          caption: `Address ${hexByte(d.i2c.address)} ACK, register ${hexByte(d.i2c.configRegister)} ACK, data ${hexByte(d.i2c.configValue)} NAK, then STOP.`,
        }),
      ],
    },
  ],
  questions: [
    {
      q: 'Is the long low SCL a bug?',
      a: `Not by itself. Clock stretching is part of I²C: a target may hold SCL low until it is ready, and the controller must wait. Here the sensor stretches ${d.i2c.stretchUs} µs. It becomes a bug when the controller does not support stretching (some hardware I²C blocks and bit-banged drivers do not), or when a target holds SCL forever, which hangs the bus.`,
    },
    {
      q: 'What does the NAK on the data byte tell you?',
      a: `The sensor answered its address and accepted the register number, then refused ${hexByte(d.i2c.configValue)}. That is different from an address NAK (nobody there): the device is present, but rejects this write, for example because the register is read-only, the value is invalid, or the device is busy. Check the datasheet for that register.`,
    },
  ],
};
