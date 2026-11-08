// Lesson: exporting a capture and measuring it with a script. The script (uart-baud.py, shown on the page)
// estimates the UART baud rate from every pulse in a VCD export. Timings come from protocols.json.

import { formatRate, formatTime } from '../../model/format';
import { frameMs, gpioOf, protocolData as d } from '../../model/protocols';
import { protocolWireSteps } from '../helpers';
import type { Lesson } from '../types';
import script from './uart-baud.py?raw';

const tx = gpioOf('uart', 'tx');
const rate = 1_000_000;
const sampleNs = 1e9 / rate;
const lengthNs = (frameMs + 5) * 1e6;
const bitNs = d.uart.bitNs;
const lowReadNs = Math.floor(bitNs / sampleNs) * sampleNs;
const highReadNs = Math.ceil(bitNs / sampleNs) * sampleNs;

export const exportScripting: Lesson = {
  id: 'export-scripting',
  track: 'learn',
  title: '12. Exporting and scripting',
  summary: 'Export a capture as a file and let a short script measure every pulse in it.',
  gpios: [tx],
  intro:
    'Markers are fine for one measurement. For a hundred, or for checking the same thing on every capture, export the capture to a file and let a script do it. Almost all analyzer software can export, and the common formats are simple text. This lesson exports a UART capture and works out the baud rate from every bit in it, far more precisely than any single marker reading.',
  sections: [
    {
      title: 'Export formats',
      body: [
        'Look for "export" or "save as" in your software. The formats you are most likely to find:',
      ],
      bullets: [
        '**VCD** (value change dump): a standard text format from chip design. It lists each input once, then only the moments something changes. Small for quiet signals, and the same layout from every program that writes it. The script below reads it.',
        '**CSV**: one line per sample (or per change), one column per input. Easy to open in a spreadsheet, but large, and the layout differs between programs: check the first few lines before you write code for it.',
        "**The software's own format**: keeps decoders and settings, but only that software can read it. Keep it next to the export, so you can look at the capture again.",
      ],
    },
    {
      title: 'A script that measures every bit',
      body: [
        'UART pulses are always a whole number of bits long. The script takes every pulse on one signal, guesses the bit time from the shortest ones, counts how many bits each pulse holds, and divides the total time by the total number of bits. Each single pulse is only known to within one sample, but those errors average out over hundreds of pulses.',
        'Save it as `uart-baud.py` and run `python3 uart-baud.py capture.vcd NAME`, where NAME is what your software called the input in the export (often its channel name or the label you gave it). It needs only Python 3, nothing to install.',
      ],
      code: script,
    },
  ],
  parts: [
    {
      title: 'Export a UART capture',
      settings: {
        gpios: [tx],
        sampleRateHz: rate,
        durationNs: lengthNs,
        preTriggerNs: 50e3,
        trigger: { type: 'edge', gpio: tx, edge: 'falling' },
      },
      steps: [
        ...protocolWireSteps([tx]),
        `Capture GP${tx} for ${formatTime(lengthNs)} at ${formatRate(rate)}, triggered on its falling edge. That holds all ${d.uart.messageCount} messages of a frame.`,
        `Measure one bit with markers first. At ${formatRate(rate)}, a single bit reads as ${formatTime(lowReadNs)} or ${formatTime(highReadNs)}: one marker reading is only good to within a sample.`,
        'Give the input a name you will recognize, if your software lets you, then export the capture as VCD.',
        'Run the script on the file. Compare its bit time and baud rate with your marker reading.',
        'Try it on a capture at a quarter of the sample rate. How much does the result change?',
      ],
      views: [],
    },
  ],
  questions: [
    {
      q: 'What does the script find, and how close is it?',
      a: `A bit time very close to ${formatTime(bitNs)}, which is ${d.uart.baud} baud, typically within a few hundredths of a percent, although every single pulse in the file is off by up to ${formatTime(sampleNs)}. That is the point of measuring everything instead of one thing.`,
    },
    {
      q: 'Why does a lower sample rate barely change the result?',
      a: 'The error of each pulse is still at most one sample, and it is as often too long as too short. Over hundreds of pulses those errors cancel, so the average stays close. The rate only has to be high enough that the shortest pulse is clearly a pulse: a few samples per bit.',
    },
    {
      q: 'Your export is a CSV with one line per sample. Why is it so much bigger than the VCD?',
      a: `At ${formatRate(rate)}, ${formatTime(lengthNs)} is ${(rate * lengthNs) / 1e9} lines, one per sample, even where nothing happens. The VCD only writes the moments a signal changes, so a mostly idle UART line takes a few thousand lines instead.`,
    },
  ],
};
