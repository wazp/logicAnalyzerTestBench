// Lesson: finding one event in a long recording. The I²C NAK (once per frame among the register reads) and
// one numbered UART message, all placed from protocols.json, so every time and count matches the firmware.

import { formatRate, formatTime } from '../../model/format';
import { example, frameMs, gpioOf, hexByte, protocolData as d, visibleText } from '../../model/protocols';
import { exampleView, protocolWireSteps, scrollStep } from '../helpers';
import type { Lesson } from '../types';

const scl = gpioOf('i2c', 'scl');
const sda = gpioOf('i2c', 'sda');
const tx = gpioOf('uart', 'tx');
const pins = [scl, sda, tx];

const readsPerFrame = d.i2c.readStartsMs.length;
const readNs = example('i2c', 'read').durationNs;
const nakNs = example('i2c', 'nak').durationNs;
const lengthNs = (frameMs + 5) * 1e6;
const rate = 1_000_000;

const target = 3;
const targetText = `${d.uart.messageText}${target}`;
const messageGapMs = d.uart.messageStartsMs[1] - d.uart.messageStartsMs[0];

export const findOneEvent: Lesson = {
  id: 'find-one-event',
  track: 'learn',
  title: '11. Finding one event in a long recording',
  summary: 'Spot the one transaction that is different among many: by shape, with the decoder, and with a trigger.',
  gpios: pins,
  intro:
    'A long recording is easy to make and hard to read. The event you care about, one failed transfer, one wrong value, is a few hundred microseconds somewhere in a second of traffic that all looks the same at a glance. This lesson practices three ways to find it, on events the bench plays once in every frame.',
  sections: [
    {
      title: 'Three ways to find it',
      body: [],
      bullets: [
        '**By shape.** Zoom out until a whole stretch fits, and look for the burst that is longer, shorter or spaced differently from the rest. Fast, and works on any analyzer.',
        '**With the decoder.** Most software lists what the decoder found, as a table or as text you can search. Look for the error, the address or the value, and jump to it.',
        '**With a trigger.** Once you know what makes the event different, trigger on exactly that, so the next capture starts right at it. Some analyzers can even trigger on a decoded value, such as one UART character.',
      ],
    },
  ],
  parts: [
    {
      title: 'The one NAK',
      intro: `In every ${frameMs} ms, the I²C controller reads the sensor at ${hexByte(d.i2c.address)} ${readsPerFrame} times, and once calls ${hexByte(d.i2c.missingAddress)}, where nobody answers.`,
      settings: {
        gpios: [scl, sda],
        sampleRateHz: rate,
        durationNs: lengthNs,
        preTriggerNs: 50e3,
        trigger: { type: 'edge', gpio: sda, edge: 'falling' },
        decoder: `I²C with SCL on GP${scl} and SDA on GP${sda}`,
      },
      steps: [
        ...protocolWireSteps(pins),
        `Capture ${formatTime(lengthNs)} at ${formatRate(rate)}, triggered on the falling edge of GP${sda}. That covers a whole frame, so the NAK is in it somewhere.`,
        `**By shape:** zoom out until you see all the bursts. The reads each last about ${formatTime(readNs)}. Which burst is much shorter?`,
        `**With the decoder:** decode as I²C and look through its results for a NAK, or for address ${hexByte(d.i2c.missingAddress)}. Does it land on the same burst?`,
        scrollStep,
        'Capture a few more times. The NAK moves around in the capture, because the trigger lands on a different read each time. How could you make the capture start at the NAK every time?',
      ],
      views: [
        exampleView('i2c', 'nak', { gpio: sda, edge: 'falling' }, {
          title: 'The NAK, once found',
          sampleRateHz: rate,
          caption: `The call to ${hexByte(d.i2c.missingAddress)}: one address byte, SDA high in the 9th clock (NAK), then STOP. The whole burst lasts about ${formatTime(nakNs)}.`,
        }),
      ],
    },
    {
      title: `Message #${target}`,
      intro: `GP${tx} sends ${d.uart.messageCount} numbered messages per frame, ${messageGapMs} ms apart: \`${visibleText(d.uart.messageText)}1\` to \`${visibleText(d.uart.messageText)}${d.uart.messageCount}\`. They all look the same until you decode them.`,
      settings: {
        gpios: [tx],
        sampleRateHz: rate,
        durationNs: lengthNs,
        preTriggerNs: 50e3,
        trigger: { type: 'edge', gpio: tx, edge: 'falling' },
        decoder: `UART on GP${tx}: ${d.uart.baud} baud, 8N1`,
      },
      steps: [
        `Capture GP${tx} for ${formatTime(lengthNs)}, triggered on its falling edge, and decode it as UART.`,
        `Find \`${visibleText(targetText)}\`. By shape, all ${d.uart.messageCount} messages look identical; only the decoder tells them apart. Search its results, or read the last digit of each message.`,
        `Measure from the start of message #${target} to the start of the next one.`,
        'If your analyzer can trigger on a serial character, set it to trigger on the character after the `#`, with the value of the digit. Does the capture now start at the same message every time?',
      ],
      views: [],
    },
  ],
  questions: [
    {
      q: 'How do you make the capture start at the NAK every time?',
      a: `Find what only the NAK has. With an I²C trigger, if your analyzer has one: address ${hexByte(d.i2c.missingAddress)}, or a NAK. Without one: the NAK burst is the only short one (about ${formatTime(nakNs)} against ${formatTime(readNs)}), so a trigger on an idle stretch that follows a short burst would work on analyzers with sequence triggers. Failing all that, record a whole frame and search, as you did.`,
    },
    {
      q: `How far apart are the messages, and why does that help?`,
      a: `${messageGapMs} ms, every time. Once you have found one message, the others are at fixed offsets: a regular schedule turns "search" into "jump". Real firmware is often just as regular, which is worth knowing when you hunt for its one odd event.`,
    },
  ],
};
