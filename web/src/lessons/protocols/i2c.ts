// Lesson: I²C. Bytes, timings and decoded values come from protocols.json, which
// the firmware's own C++ generates, so they always match what the board sends.

import { formatHz } from '../../model/format';
import { frameMs, gpioOf, hexByte, protocolData as d } from '../../model/protocols';
import { bytesHex, exampleView, protocolWireSteps } from '../helpers';
import type { Lesson } from '../types';

const scl = gpioOf('i2c', 'scl');
const sda = gpioOf('i2c', 'sda');
const i2cAddr = d.i2c.address;

export const i2c: Lesson = {
  id: 'i2c',
  track: 'protocols',
  title: 'I²C',
  summary: 'Two wires, many devices: start and stop, addresses, ACK and NAK, and reading a register.',
  gpios: [scl, sda],
  intro: `A simulated temperature sensor sits at address ${hexByte(i2cAddr)}. Every ${d.i2c.readStartsMs[1] - d.i2c.readStartsMs[0]} ms the controller reads its temperature register: it writes the register number, then reads two bytes. Once per ${frameMs} ms it also calls ${hexByte(d.i2c.missingAddress)}, where nobody answers. SCL is the clock (${formatHz(d.i2c.clockHz)}); SDA carries the data, which only changes while SCL is low.`,
  parts: [
    {
      title: 'Read a transaction',
      settings: {
        gpios: [scl, sda],
        sampleRateHz: 2_000_000,
        durationNs: 600e3,
        preTriggerNs: 20e3,
        trigger: { type: 'edge', gpio: sda, edge: 'falling' },
        decoder: `I²C with SCL on GP${scl} and SDA on GP${sda}`,
      },
      steps: [
        ...protocolWireSteps([scl, sda]),
        `Capture, triggered on the falling edge of GP${sda}. If the capture starts in the middle of a transaction, capture again.`,
        'Find the START: SDA falls while SCL is high. Every other SDA change happens while SCL is low.',
        'Read the first 9 clocks by hand: 7 address bits, the read/write bit, then the ACK (SDA pulled low by the device).',
        'Find the repeated START in the middle and the STOP at the end (SDA rises while SCL is high).',
        'Add the I²C decoder and check your reading. What temperature does the sensor report?',
      ],
      views: [
        exampleView('i2c', 'read', { gpio: sda, edge: 'falling' }, {
          title: 'Register read',
          sampleRateHz: 2_000_000,
          caption: `Write ${hexByte(i2cAddr)} + register ${hexByte(d.i2c.register)}, repeated START, read ${hexByte(i2cAddr)} + two bytes, STOP.`,
        }),
      ],
    },
    {
      title: 'Find the device that is not there',
      intro: `Somewhere in every ${frameMs} ms the controller calls address ${hexByte(d.i2c.missingAddress)}. Nobody pulls SDA low in the ACK slot, so the controller gives up.`,
      settings: {
        gpios: [scl, sda],
        sampleRateHz: 1_000_000,
        durationNs: (frameMs + 5) * 1e6,
        preTriggerNs: 50e3,
        trigger: { type: 'edge', gpio: sda, edge: 'falling' },
        decoder: `I²C with SCL on GP${scl} and SDA on GP${sda}`,
      },
      steps: [
        `Capture ${frameMs + 5} ms so one whole cycle of traffic fits.`,
        "Scroll through the transactions with the decoder on. One of them is much shorter than the rest: that's the NAK.",
      ],
      views: [
        exampleView('i2c', 'nak', { gpio: sda, edge: 'falling' }, {
          title: 'The NAK',
          sampleRateHz: 1_000_000,
          caption: `Address ${hexByte(d.i2c.missingAddress)}, write. SDA stays high in the 9th clock: NAK, then STOP.`,
        }),
      ],
    },
  ],
  tables: [
    {
      title: 'The register read, byte by byte',
      head: ['Byte', 'Value', 'Meaning', 'Sent by'],
      rows: [
        ['Address + W', hexByte((i2cAddr << 1) | 0), `device ${hexByte(i2cAddr)}, write`, 'controller'],
        ['Register', hexByte(d.i2c.register), 'temperature register', 'controller'],
        ['Address + R', hexByte((i2cAddr << 1) | 1), `device ${hexByte(i2cAddr)}, read`, 'controller'],
        ['Data 1', hexByte(d.i2c.value[0]), 'temperature, high byte', 'sensor'],
        ['Data 2', hexByte(d.i2c.value[1]), 'temperature, low byte', 'sensor'],
      ],
    },
  ],
  questions: [
    {
      q: `Why is the first byte ${hexByte(i2cAddr << 1)} and not ${hexByte(i2cAddr)}?`,
      a: `The 7-bit address ${hexByte(i2cAddr)} is shifted left one place and the read/write bit goes in the lowest bit. Datasheets and decoders mix both forms, so a "wrong address" is often just this shift.`,
    },
    {
      q: 'What temperature did the sensor report?',
      a: `${bytesHex(d.i2c.value)}: the top 12 bits are the temperature in steps of 0.0625 °C. ${hexByte(d.i2c.value[0])}${d.i2c.value[1].toString(16).padStart(2, '0')} >> 4 = ${(d.i2c.value[0] * 256 + d.i2c.value[1]) >> 4}, × 0.0625 = ${d.i2c.temperatureC} °C.`,
    },
    {
      q: 'Who drives SDA during an ACK?',
      a: 'The receiver of the byte. After the address and register bytes the sensor ACKs; after each data byte the controller ACKs to ask for more, and NAKs the last one to say it is done.',
    },
  ],
};
