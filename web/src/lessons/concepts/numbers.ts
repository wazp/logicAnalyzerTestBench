// Concept: reading the numbers in a capture: binary and hex, bit order, ASCII, multi-byte values and
// signed readings. Examples come from the bench's own protocol data.

import { hexByte, protocolData as p, visibleText } from '../../model/protocols';
import { bits, bytesHex, lsbFirst } from '../helpers';
import type { Lesson } from '../types';

const letter = p.uart.firstMessage.charCodeAt(0);
const letterChar = p.uart.firstMessage[0];

// The bench's sensor answers like a TMP102: a 12-bit two's complement value, left aligned in two bytes,
// in steps of 0.0625 °C.
const [tHigh, tLow] = p.i2c.value;
const raw12 = (tHigh << 4) | (tLow >> 4);
const stepC = 0.0625;
const tempC = raw12 * stepC;
const negC = -10;
const negRaw12 = (negC / stepC) & 0xfff;
const negBytes = [negRaw12 >> 4, (negRaw12 & 0xf) << 4];

// The SPI flash's JEDEC ID: manufacturer, memory type, and capacity as a power of two in bytes.
const [maker, memType, capacity] = p.spi.reply;
const sizeBytes = 2 ** capacity;

const word = 0x1234;
const hex16 = (n: number) => `0x${n.toString(16).toUpperCase().padStart(4, '0')}`;

export const numbers: Lesson = {
  id: 'numbers',
  track: 'concepts',
  title: 'Bits, bytes and hex',
  summary: 'Binary and hex, which bit comes first, ASCII text, values that span several bytes, and negative numbers.',
  gpios: [],
  intro:
    'Every protocol lesson ends with reading bytes off a waveform, and every decoder shows its results as numbers. This lesson is the arithmetic behind that: how to turn a row of highs and lows into a byte, and a few bytes into a temperature, a letter or a memory size. The examples are the real values the test bench sends.',
  sections: [
    {
      title: 'Binary and hex',
      body: [
        'A byte is 8 bits. Written in binary it is hard to read, so we use hexadecimal: each group of 4 bits becomes one hex digit, 0 to 9 then A to F. A byte is always exactly two hex digits, written with a `0x` prefix.',
        `For example, the first character the bench sends on its UART is "${letterChar}": binary \`${bits(letter)}\`, split into \`${bits(letter).slice(0, 4)}\` and \`${bits(letter).slice(4)}\`, which is \`${hexByte(letter)}\`.`,
      ],
      table: {
        title: 'The 16 hex digits',
        head: ['Bits', 'Hex', 'Bits', 'Hex'],
        rows: Array.from({ length: 8 }, (_, i) => [
          i.toString(2).padStart(4, '0'),
          i.toString(16).toUpperCase(),
          (i + 8).toString(2).padStart(4, '0'),
          (i + 8).toString(16).toUpperCase(),
        ]),
      },
    },
    {
      title: 'Which bit comes first',
      body: [
        'A serial protocol sends one bit at a time, and each protocol decides whether the most significant bit (MSB, the leftmost) or the least significant bit (LSB) goes first.',
        `UART sends the LSB first. "${letterChar}" (\`${hexByte(letter)}\`, \`${bits(letter)}\`) appears on the wire, after the start bit, as \`${lsbFirst(letter)}\`. Reading it left to right as if it were MSB first gives \`${hexByte(parseInt(lsbFirst(letter), 2))}\`, a different byte: the most common hand-decoding mistake. I²C and SPI send the MSB first, so their bits read in the order you see them (SPI devices can be set to LSB first, which a decoder needs to be told). WS2812 LEDs and 1-Wire also differ: WS2812 is MSB first, 1-Wire is LSB first.`,
      ],
    },
    {
      title: 'Text is bytes too',
      body: [
        `Text over UART is ASCII: one byte per character. Worth recognizing by sight: digits are \`0x30\` to \`0x39\`, capital letters start at \`0x41\` ("A"), lowercase at \`0x61\` ("a"), a space is \`0x20\`. Line endings are \`0x0D\` (carriage return, written \\r) and \`0x0A\` (line feed, \\n). The bench's message ends in both: "${visibleText(p.uart.firstMessage)}".`,
      ],
    },
    {
      title: 'Values bigger than a byte',
      body: [
        `Numbers above 255 take several bytes, and the order is a convention of each device. **Big-endian** sends the most significant byte first: ${hex16(word)} goes out as \`${bytesHex([word >> 8, word & 0xff])}\`. **Little-endian** sends it last: \`${bytesHex([word & 0xff, word >> 8])}\`. Sensors and network protocols are mostly big-endian; many processors store numbers little-endian, so a dump of memory often looks reversed. The datasheet's register table settles it.`,
        `Some values do not use whole bytes. The bench's temperature sensor answers \`${bytesHex(p.i2c.value)}\`: a 12-bit value in the top 12 of the 16 bits. Shift the two bytes right by 4 to get ${raw12} (\`0x${raw12.toString(16).toUpperCase()}\`), and multiply by its step of ${stepC} °C: ${tempC} °C.`,
        `The SPI flash's ID, \`${bytesHex(p.spi.reply)}\`, is three separate fields: \`${hexByte(maker)}\` is the manufacturer, \`${hexByte(memType)}\` the memory type, and \`${hexByte(capacity)}\` (${capacity}) the size as a power of two: 2^${capacity} bytes, ${sizeBytes / 2 ** 20} MB.`,
      ],
    },
    {
      title: 'Negative numbers',
      body: [
        `A sensor that reports temperatures below zero uses **two's complement**: if the top bit is set, the value is negative, and you subtract 2^n (n is the number of bits). At ${negC} °C the same sensor answers \`${bytesHex(negBytes)}\`. The 12-bit value is ${negRaw12} (\`0x${negRaw12.toString(16).toUpperCase()}\`); its top bit is set, so it is ${negRaw12} - 4096 = ${negRaw12 - 4096}, times ${stepC}: ${(negRaw12 - 4096) * stepC} °C.`,
        'A decoder shows the raw bytes; the sign is your job, or a stacked decoder\'s that knows the device. Reading such a value as unsigned gives a temperature far too high, which is a quick way to spot the mistake.',
      ],
    },
  ],
  parts: [],
  questions: [
    {
      q: `On a UART line you read the 8 data bits, in the order they arrive, as \`${lsbFirst(0x4f)}\`. Which character is it?`,
      a: `UART sends the LSB first, so reverse the bits: \`${bits(0x4f)}\`, which is \`${hexByte(0x4f)}\`, the letter "${String.fromCharCode(0x4f)}".`,
    },
    {
      q: `The temperature sensor answers \`${bytesHex([0x1b, 0x80])}\`. What temperature is that?`,
      a: `Shift right by 4: \`0x${(((0x1b << 4) | (0x80 >> 4)) >>> 0).toString(16).toUpperCase()}\`, which is ${(0x1b << 4) | (0x80 >> 4)}. Times ${stepC}: ${((0x1b << 4) | (0x80 >> 4)) * stepC} °C. The top bit is clear, so it is positive.`,
    },
    {
      q: 'A device documents a 16-bit counter as little-endian. The bytes on the bus are `0x10 0x27`. What is the count?',
      a: 'Little-endian puts the low byte first, so the value is `0x2710`, which is 10000.',
    },
  ],
};
