// Lesson (optional): sigrok protocol decoders, stacked. Only for software that runs them. The bytes to expect
// come from protocols.json.

import { gpioOf, hexByte, protocolData as d } from '../../model/protocols';
import { bytesHex, exampleView, protocolWireSteps } from '../helpers';
import type { Lesson } from '../types';

const scl = gpioOf('i2c', 'scl');
const sda = gpioOf('i2c', 'sda');
const sck = gpioOf('spi', 'sck');
const mosi = gpioOf('spi', 'mosi');
const miso = gpioOf('spi', 'miso');
const cs = gpioOf('spi', 'cs');
const pins = [scl, sda, sck, mosi, miso, cs];

export const sigrokDecoders: Lesson = {
  id: 'sigrok-decoders',
  track: 'protocols',
  optional:
    "It needs software that runs **sigrok** protocol decoders: PulseView, sigrok-cli, and several analyzers' own apps. If yours has no sigrok decoders, skip it; nothing later depends on it.",
  title: 'Using sigrok protocol decoders',
  summary: 'Assign channels and options, stack decoders on top of each other, and read the annotation rows.',
  gpios: pins,
  intro:
    'The sigrok project maintains a large, free library of protocol decoders, used by PulseView and by several analyzer apps. Each decoder is a small script that reads the inputs you assign to it and writes annotations: rows of labeled boxes under the waveform. Their strength is stacking: one decoder turns edges into bytes, the next turns bytes into commands for a particular chip. This lesson does that on the SPI flash and the I²C sensor the bench simulates.',
  sections: [
    {
      title: 'How sigrok decoders work',
      body: [
        'A **low-level** decoder (UART, I²C, SPI, 1-Wire and many more) reads edges and outputs bits, bytes and protocol events such as START, ACK or a framing error. A **stacked** decoder reads that output instead of the inputs, and knows one chip or one higher-level protocol: an SPI flash, a temperature sensor, a game controller.',
        'Each decoder has **channels** to assign (which input is SCL, which is SDA) and **options** (baud rate, SPI mode, bit order, address format). Most mistakes from the "When the decoder shows garbage" lesson happen here.',
        'The output comes as **annotation rows**: one for bits, one for bytes, one for warnings, and so on. Hide the rows you do not need, and look for a warnings row when something seems off; it often says exactly what the decoder did not like.',
      ],
      bullets: [
        '**Low level first.** A stacked decoder only works if the one below it decodes cleanly, so check the bytes before you stack.',
        '**Names vary a little** between programs and versions. Search the decoder list for the chip family or the protocol.',
        '**Results can usually be exported** as text, handy for long captures and for comparing two runs.',
      ],
    },
  ],
  parts: [
    {
      title: 'SPI, then the flash on top',
      settings: {
        gpios: [sck, mosi, miso, cs],
        sampleRateHz: 8_000_000,
        durationNs: 40e3,
        preTriggerNs: 2e3,
        trigger: { type: 'edge', gpio: cs, edge: 'falling' },
        decoder: `SPI: clock GP${sck}, MOSI GP${mosi}, MISO GP${miso}, CS GP${cs} (active low), mode ${d.spi.mode}, MSB first, 8 bits; then an SPI flash decoder stacked on it`,
      },
      steps: [
        ...protocolWireSteps(pins),
        `Capture the four SPI pins, triggered on the falling edge of GP${cs}.`,
        `Add the SPI decoder, assign its four channels, and set mode ${d.spi.mode}, MSB first, chip select active low. You should read ${hexByte(d.spi.command)} on MOSI and ${bytesHex(d.spi.reply)} on MISO.`,
        'Now stack an SPI flash decoder on top of the SPI decoder (look for "SPI flash" or "spiflash"). What does it call the command, and what does it make of the answer?',
        'Hide the bit rows of the SPI decoder. Which rows do you still need to follow the transaction?',
      ],
      views: [
        exampleView('spi', 'jedec_id', { gpio: cs, edge: 'falling' }, {
          title: 'One transfer',
          sampleRateHz: 8_000_000,
          caption: `${hexByte(d.spi.command)} is the standard "read JEDEC ID" command; ${bytesHex(d.spi.reply)} is the manufacturer and device ID of a W25Q128-style flash.`,
        }),
      ],
    },
    {
      title: 'I²C, then the sensor on top',
      settings: {
        gpios: [scl, sda],
        sampleRateHz: 2_000_000,
        durationNs: 600e3,
        preTriggerNs: 20e3,
        trigger: { type: 'edge', gpio: sda, edge: 'falling' },
        decoder: `I²C with SCL on GP${scl} and SDA on GP${sda}; then a temperature sensor decoder stacked on it, if your software has one`,
      },
      steps: [
        `Capture GP${scl} and GP${sda}, triggered on the falling edge of GP${sda}, and add the I²C decoder.`,
        `Find the address (${hexByte(d.i2c.address)}, or ${hexByte(d.i2c.address << 1)} if your decoder shows 8-bit addresses) and the two bytes read back, ${bytesHex(d.i2c.value)}.`,
        `Look for a stacked decoder for an I²C temperature sensor at ${hexByte(d.i2c.address)} (the LM75 family uses the same register layout as this simulated sensor). Stack it, and compare its temperature with the ${d.i2c.temperatureC} °C the bench sends.`,
        'If there is no such decoder, that is normal: stacked decoders only exist for popular chips. Reading the two bytes by hand works everywhere.',
      ],
      views: [
        exampleView('i2c', 'read', { gpio: sda, edge: 'falling' }, {
          title: 'Register read',
          sampleRateHz: 2_000_000,
          caption: `Register ${hexByte(d.i2c.register)} of the sensor at ${hexByte(d.i2c.address)}, read back as ${bytesHex(d.i2c.value)}: ${d.i2c.temperatureC} °C.`,
        }),
      ],
    },
  ],
  questions: [
    {
      q: 'The stacked flash decoder shows nothing, but the SPI decoder below it shows bytes. Where do you look?',
      a: 'At the SPI decoder\'s options first: a stacked decoder trusts the bytes it gets. A wrong mode or bit order gives bytes that look fine and mean nothing, so the flash decoder finds no command it knows. Also check that chip select is assigned: many stacked decoders need the transaction boundaries it gives.',
    },
    {
      q: 'Why stack decoders instead of reading the bytes yourself?',
      a: 'For one transaction, reading by hand is fine and teaches you more. For a long capture with hundreds of transactions, a stacked decoder names every command, address and value, and you can search or export the result.',
    },
  ],
};
