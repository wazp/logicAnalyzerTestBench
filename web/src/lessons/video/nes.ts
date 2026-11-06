// Lesson: reading an NES controller. Buttons and timings come from video.json,
// which the firmware's own C++ generates.

import { formatHz, formatTime } from '../../model/format';
import { frameHz, nesPressed, vga, videoData, videoExample, videoGpio } from '../../model/video';
import { andList, exampleViewOf, placedRows, wireSteps } from '../helpers';
import type { Lesson } from '../types';

const latch = videoGpio('nes', 'latch');
const clock = videoGpio('nes', 'clock');
const data = videoGpio('nes', 'data');
const pins = [latch, clock, data];
const n = videoData.nes;
const read1 = videoExample('nes', 'read1');
const read2 = videoExample('nes', 'read2');
const latchRise = { gpio: latch, edge: 'rising' } as const;
const readGapNs = (n.readStartsMs[1] - n.readStartsMs[0]) * 1e6;
const pressed = n.buttons.map((b) => andList(nesPressed(b)));
// The data line during one read: A at the latch, then one button per rising clock edge. Low = pressed.
const wireBits = (buttons: number) =>
  n.buttonNames.map((_, i) => ((buttons >> i) & 1 ? '0' : '1')).join(' ');

const readRate = 4_000_000;
const longRate = 1_000_000;
const longNs = 3 * readGapNs;

export const nesController: Lesson = {
  id: 'nes-controller',
  track: 'video',
  preset: 'video',
  title: 'NES controller',
  summary: 'Read which buttons are pressed from three wires, the way a game console does it.',
  gpios: pins,
  intro: `GP${latch}-GP${data} play a console reading an NES controller, once per video frame (${formatHz(frameHz)}), the way games do. The controller is a single shift register chip: the console tells it to grab the buttons, then clocks them out one at a time on one data wire. Many other controllers and input boards work the same way.`,
  sections: [
    {
      title: 'How a read works',
      body: [
        `**LATCH** goes high for ${formatTime(n.latchUs * 1e3)}: the controller loads all eight buttons into its shift register, and the first one (A) appears on **DATA** right away.`,
        `Then **CLOCK**, normally high, pulses low eight times, one pulse every ${formatTime(n.clockPeriodUs * 1e3)}. Each rising edge shifts the next button onto DATA, in a fixed order: ${n.buttonNames.join(', ')}.`,
        'DATA is **low when a button is pressed**: the buttons connect the inputs to ground. After the last button the chip shifts in its own grounded input, so DATA stays low until the next read.',
        `The console reads it in the first line after the picture, while the screen is blank, so a game sees new buttons exactly once per frame.`,
      ],
    },
  ],
  parts: [
    {
      title: 'One read',
      settings: {
        gpios: pins,
        sampleRateHz: readRate,
        durationNs: 150e3,
        preTriggerNs: 20e3,
        trigger: { type: 'edge', gpio: latch, edge: 'rising' },
      },
      steps: [
        ...wireSteps(pins),
        `Capture, triggered on the rising edge of GP${latch} (LATCH).`,
        `Write down DATA just before the first CLOCK pulse: that is A. Then write down DATA after each rising CLOCK edge: B, Select, Start, Up, Down, Left, Right.`,
        'Low means pressed. Which buttons are held down?',
        `Capture again a few times. The board alternates between two reads, so you will see one or the other.`,
      ],
      views: [
        exampleViewOf(read1, latchRise, {
          title: 'One read',
          sampleRateHz: readRate,
          caption: `DATA reads ${wireBits(n.buttons[0])} (A first): ${pressed[0]} pressed.`,
        }),
        exampleViewOf(read2, latchRise, {
          title: 'The other read',
          sampleRateHz: readRate,
          caption: `DATA reads ${wireBits(n.buttons[1])}: ${pressed[1]} pressed.`,
        }),
      ],
    },
    {
      title: 'Once per frame',
      settings: {
        gpios: pins,
        sampleRateHz: longRate,
        durationNs: longNs,
        preTriggerNs: 1e6,
        trigger: { type: 'edge', gpio: latch, edge: 'rising' },
      },
      steps: [
        `Capture ${formatTime(longNs)}, with the same trigger.`,
        'Measure the time between two LATCH pulses and compare it with the frame rate of the VGA lesson.',
      ],
      views: [
        {
          title: 'Three reads',
          startNs: -1e6,
          endNs: longNs,
          sampleRateHz: longRate,
          rows: placedRows(
            [
              { e: read1, atNs: 0 },
              { e: read2, atNs: readGapNs },
              { e: read1, atNs: 2 * readGapNs },
            ],
            latchRise,
          ),
          caption: `A read every ${formatTime(readGapNs)}, once per video frame. Each read takes about ${formatTime(120e3)}; the controller is idle the rest of the time.`,
        },
      ],
    },
  ],
  tables: [
    {
      title: 'The two reads',
      head: ['Read', ...n.buttonNames, 'Pressed'],
      rows: n.buttons.map((b, i) => [`${i + 1}`, ...wireBits(b).split(' '), pressed[i]]),
    },
  ],
  questions: [
    {
      q: 'Why is a pressed button low instead of high?',
      a: 'Each button connects an input of the shift register to ground, with a resistor pulling it high otherwise. That needs only one wire per button and no power through the switch, so most simple button circuits are active low. Always check which way round a signal is before reading it.',
    },
    {
      q: 'A game reads the controller a 9th time in the same read. What does it get on an original controller?',
      a: 'DATA stays low after the 8th clock, because the chip shifts in its grounded serial input. Low means "pressed", so every extra bit reads as pressed. You can see it in your capture: DATA ends low after every read.',
    },
    {
      q: 'On which CLOCK edge should the console read DATA?',
      a: 'DATA changes on the rising edge, so the console reads it while CLOCK is low or just before the next rising edge, when it is stable. Reading right at the rising edge would race the change. When you set up a decoder for a shift register, pick the edge where the data is stable, not the one where it changes.',
    },
    {
      q: 'Why read in the blank lines after the picture, not in the middle of it?',
      a: `Games update everything once per frame during vertical blanking, when the picture is not being drawn, so changes never show up half way down the screen. Reading the buttons then gives the game fresh input right before it computes the next frame. Here the read starts with line ${n.readLine}, the first one after the ${vga.v.visible} visible lines (counting from 0).`,
    },
  ],
};
