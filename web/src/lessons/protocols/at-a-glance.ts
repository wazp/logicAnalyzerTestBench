// Protocols track: a side-by-side reference of the protocols on the bench and the common ones that are not,
// for recognizing a bus and choosing analyzer settings. Bench speeds come from protocols.json. Reading only.

import { formatHz, formatTime } from '../../model/format';
import { protocolData as p } from '../../model/protocols';
import type { Lesson } from '../types';

const baud = (b: number) => `${b} baud`;

export const atAGlance: Lesson = {
  id: 'protocols-at-a-glance',
  track: 'protocols',
  title: 'Protocols at a glance',
  summary: 'Wires, clocks, speeds, idle levels and how to recognize each common protocol in a capture, in one table.',
  gpios: [],
  intro:
    'The lessons that follow take one protocol at a time. This page puts them side by side, together with common protocols the bench does not play, so you can recognize a bus you meet on a real board and know what your analyzer and decoder will need. Come back to it as a reference.',
  sections: [
    {
      title: 'On the test bench',
      body: ['The speeds are what the bench uses; the typical range is what you meet in practice.'],
      table: {
        title: 'Protocols on the bench',
        head: ['Protocol', 'Wires', 'Clock', 'Bench speed', 'Typical range', 'In a capture'],
        rows: [
          ['UART', 'TX, RX (one per direction)', 'None: both sides agree on a baud rate', baud(p.uart.baud), '9600 to about 1 Mbaud', 'Idle high, bytes start with a low start bit, bits of equal width'],
          ['I²C', 'SCL, SDA', 'SCL, from the controller', formatHz(p.i2c.clockHz), '100 kHz, 400 kHz, 1 MHz', 'Both idle high, START is SDA falling while SCL is high, 9 clocks per byte'],
          ['SPI', 'SCK, MOSI, MISO, CS', 'SCK, from the controller', formatHz(p.spi.clockHz), '1 to 50 MHz and up', 'CS low frames a transfer, data changes on one clock edge, sampled on the other'],
          ['WS2812', 'One data wire', 'None: timing is in the pulse width', `${formatHz(1e9 / p.ws2812.bitNs)} bit rate`, 'Fixed', 'Short and long high pulses, 24 bits per LED, a long low gap to latch'],
          ['1-Wire', 'One data wire plus ground', 'None: time slots', 'Standard speed', 'Standard or overdrive', `A ${formatTime(p.onewire.resetLowUs * 1000)} reset low, a presence pulse, then fixed time slots`],
          ['IR remote (NEC)', 'One wire from the receiver', 'None: pulse distance', 'Fixed by the format', 'Fixed', `A ${formatTime(p.ir.leaderUs * 1000)} leader, then gaps of two lengths for 0 and 1`],
          ['Quadrature', 'A, B', 'None', `${formatHz(1e6 / p.quadrature.stepUs)} steps`, 'Up to a few MHz', 'Two square waves a quarter period apart; the order gives the direction'],
        ],
      },
    },
    {
      title: 'Common ones the bench does not play',
      body: [
        'Several common buses are differential or use voltages outside logic levels on the cable. You do not probe the cable with a logic analyzer; you probe the logic side of the transceiver chip, between the transceiver and the microcontroller, where the signal is ordinary logic.',
      ],
      table: {
        title: 'Recognizing other protocols',
        head: ['Protocol', 'Where to probe', 'In a capture'],
        rows: [
          ['RS-232', 'The logic side of the level converter (TX and RX pins of the chip)', 'Exactly UART; the cable itself swings to plus and minus several volts, which can damage an analyzer'],
          ['RS-485, DMX', 'The logic side of the transceiver (RO, DI, and DE for direction)', 'UART bytes; DE goes high while this node sends. DMX starts each frame with a long break'],
          ['CAN', 'The CAN RX and TX pins between the controller and the transceiver', 'Idle high, frames with bit stuffing (never more than 5 equal bits in a row), an ACK slot near the end'],
          ['I²S (audio)', 'BCLK, WS (LRCLK), SD; sometimes MCLK', 'A continuous clock, WS toggling once per sample (left and right), data MSB first'],
          ['SWD (ARM debug)', 'SWCLK, SWDIO', 'Bursts while a debugger is connected, nothing otherwise'],
          ['USB', 'Not with a logic analyzer', 'Full speed (12 Mbit/s) can be captured in principle, but needs differential handling and a USB-specific decoder. A USB protocol analyzer or software capture is the usual tool'],
        ],
      },
    },
    {
      title: 'What a decoder needs to know',
      body: ['When you set up a decoder, these are the settings to find before you start. Wrong ones are the most common reason a decoder shows garbage.'],
      table: {
        title: 'Decoder settings',
        head: ['Protocol', 'Settings'],
        rows: [
          ['UART', 'Baud rate, data bits, parity, stop bits, idle level (inverted or not), bit order'],
          ['I²C', 'Which input is SCL and which SDA; addresses shown as 7-bit or 8-bit'],
          ['SPI', 'Clock polarity and phase (the mode), chip select polarity, bit order, word size'],
          ['CAN', 'Bit rate, and the sample point if the decoder asks'],
          ['I²S', 'Which edge to sample on, word size, whether data starts one clock after WS changes'],
        ],
      },
    },
  ],
  parts: [],
  questions: [
    {
      q: 'Two lines on a board both idle high. One toggles steadily in bursts, the other changes only while the first is low. Which protocol is it likely to be?',
      a: 'I²C: SCL is the steady clock in bursts, and SDA changes only while SCL is low, except for START and STOP. Count 9 clock pulses per byte (8 data bits and an ACK) to confirm.',
    },
    {
      q: 'You want to read the messages on a car\'s CAN bus. Where do you connect the analyzer?',
      a: 'Not to the CAN wires themselves, which are differential, but to the RX pin of a CAN transceiver, for example on a small board that has one between the bus and its microcontroller. That pin carries the bus traffic as ordinary logic. Use a transceiver in listen-only mode if it has one, so you never send on the bus.',
    },
  ],
};
