// Lesson: VGA video timing. Every number comes from video.json, which the
// firmware's own C++ generates, so it always matches what the board outputs.

import { formatHz, formatRate, formatTime } from '../../model/format';
import {
  frameHz,
  frameLines,
  hsyncNs,
  lineHz,
  linePixels,
  syncWave,
  vga,
  videoExample,
  videoGpio,
  vsyncNs,
  vsyncStartNs,
} from '../../model/video';
import { exampleViewOf, scrollStep, wireSteps } from '../helpers';
import type { Lesson } from '../types';

const hsync = videoGpio('vga', 'hsync');
const vsync = videoGpio('vga', 'vsync');
const red = videoGpio('vga', 'red');
const green = videoGpio('vga', 'green');
const blue = videoGpio('vga', 'blue');
const all = [hsync, vsync, red, green, blue];

const px = vga.pixelNs;
const barPixels = vga.h.visible / vga.bars.length;
const barNs = barPixels * px;
const visibleNs = vga.h.visible * px;
const lineRate = 12_000_000;
const frameRate = 2_000_000;

// The whole-frame view, with t = 0 at the falling edge of VSYNC.
const frameStart = -2e6;
const frameEnd = 2 * vga.frameNs + 1e6;
const frameRows = (from: number, to: number) => [
  { gpio: hsync, wave: syncWave('hsync', vsyncStartNs + from, vsyncStartNs + to, vsyncStartNs) },
  { gpio: vsync, wave: syncWave('vsync', vsyncStartNs + from, vsyncStartNs + to, vsyncStartNs) },
];

const bit = (on: number) => (on ? '1' : '0');

export const vgaLesson: Lesson = {
  id: 'vga',
  track: 'video',
  preset: 'video',
  title: 'VGA video',
  summary: 'How a monitor is told where each line and frame starts, measured on a real 640x480 signal.',
  gpios: all,
  intro: `GP${hsync}-GP${blue} output a ${vga.h.visible}x${vga.v.visible} VGA picture of eight color bars. A monitor needs only five signals: two sync pulses that say when a line and a frame start, and the red, green and blue levels. Here each color is just on or off, so the picture has eight colors. A logic analyzer is the right tool for the sync timing, which is what most homemade video circuits get wrong.`,
  sections: [
    {
      title: 'How a picture is sent',
      body: [
        'The picture goes out one line at a time, left to right, top to bottom, like the beam of an old CRT monitor. Each line starts with the visible pixels. Then the colors go dark for the **front porch**, **HSYNC** pulses low to say "next line", and the **back porch** gives the monitor time before the next line starts.',
        `Frames work the same way, counted in lines: the visible lines, a front porch, a **VSYNC** pulse and a back porch. Only ${vga.h.visible} of every ${linePixels} pixel times and ${vga.v.visible} of every ${frameLines} lines carry picture.`,
        `Each pixel lasts one tick of the **pixel clock**: ${formatTime(px)} here, a ${formatHz(vga.pixelHz)} clock. The standard says 25.175 MHz; monitors lock to the sync pulses, so ${formatHz(vga.pixelHz)} works with almost any VGA monitor.`,
      ],
      table: {
        title: 'Timing on this board',
        head: ['', 'Visible', 'Front porch', 'Sync pulse', 'Back porch', 'Total'],
        rows: [
          [
            'One line, in pixels',
            `${vga.h.visible}`,
            `${vga.h.front}`,
            `${vga.h.sync}`,
            `${vga.h.back}`,
            `${linePixels} = ${formatTime(vga.lineNs)}`,
          ],
          [
            'One frame, in lines',
            `${vga.v.visible}`,
            `${vga.v.front}`,
            `${vga.v.sync}`,
            `${vga.v.back}`,
            `${frameLines} = ${formatTime(vga.frameNs)}`,
          ],
        ],
      },
    },
    {
      title: 'Connecting a real monitor (optional)',
      body: [
        'This is the one signal on the test bench meant for a real device. A VGA monitor expects about 0.7 V on each color pin into its own 75 Ω termination, so each color needs a series resistor; the sync pins take 3.3V logic directly.',
      ],
      bullets: [
        `GP${red} through a 270 Ω resistor to VGA pin 1 (red), GP${green} through 270 Ω to pin 2 (green), GP${blue} through 270 Ω to pin 3 (blue). 3.3V across 270 Ω and 75 Ω gives about 0.72 V.`,
        `GP${hsync} to VGA pin 13 (HSYNC), GP${vsync} to pin 14 (VSYNC).`,
        'Pico GND to VGA pins 5, 6, 7, 8 and 10.',
        'Only ever connect a monitor **input**. Never connect these pins to a VGA output, such as a computer or graphics card.',
      ],
    },
  ],
  parts: [
    {
      title: 'One line',
      settings: {
        gpios: all,
        sampleRateHz: lineRate,
        durationNs: 40e3,
        preTriggerNs: 5e3,
        trigger: { type: 'edge', gpio: hsync, edge: 'falling' },
      },
      steps: [
        ...wireSteps(all),
        `Capture, triggered on the falling edge of GP${hsync} (HSYNC).`,
        'Measure the time between two HSYNC falling edges (the line period) and how long HSYNC stays low.',
        'Read the colors bar by bar: red, green and blue together give each bar its color. Measure how long one bar lasts.',
        'Find where the colors go dark, and measure from there to the HSYNC pulse (the front porch) and from the end of the pulse to the next line (the back porch).',
      ],
      views: [
        exampleViewOf(videoExample('vga', 'line'), { gpio: hsync, edge: 'falling' }, {
          title: 'One line',
          sampleRateHz: lineRate,
          caption: `A line every ${formatTime(vga.lineNs)} (${formatHz(lineHz)}). HSYNC is low for ${formatTime(hsyncNs)}, ${vga.h.back} pixels (${formatTime(vga.h.back * px)}) later the eight bars start, each ${formatTime(barNs)} (${barPixels} pixels) wide, and the colors go dark ${formatTime(visibleNs)} after that.`,
        }),
      ],
    },
    {
      title: 'A whole frame',
      settings: {
        gpios: [hsync, vsync],
        sampleRateHz: frameRate,
        durationNs: frameEnd,
        preTriggerNs: -frameStart,
        trigger: { type: 'edge', gpio: vsync, edge: 'falling' },
      },
      steps: [
        `Keep GP${hsync} and GP${vsync} connected. Capture ${formatTime(frameEnd)}, triggered on the falling edge of GP${vsync} (VSYNC).`,
        'Measure the time between two VSYNC pulses (the frame period) and work out the frame rate.',
        scrollStep,
        'Zoom in on the VSYNC pulse and count the HSYNC pulses while it is low.',
      ],
      views: [
        {
          title: 'Two frames',
          startNs: frameStart,
          endNs: frameEnd,
          sampleRateHz: frameRate,
          rows: frameRows(frameStart, frameEnd),
          caption: `A frame every ${formatTime(vga.frameNs)}: ${formatHz(frameHz)}. HSYNC pulses ${frameLines} times per frame, too often to draw at this zoom.`,
        },
        {
          title: 'The VSYNC pulse',
          startNs: -150e3,
          endNs: 250e3,
          sampleRateHz: frameRate,
          rows: frameRows(-150e3, 250e3),
          caption: `VSYNC stays low for ${formatTime(vsyncNs)}: ${vga.v.sync} lines, so ${vga.v.sync} HSYNC pulses. It starts with a line, ${vga.v.front} lines after the last visible one.`,
        },
      ],
    },
  ],
  tables: [
    {
      title: 'The color bars',
      head: ['Bar', 'Red', 'Green', 'Blue', 'Starts after the line starts'],
      rows: vga.bars.map((b, i) => [b.name, bit(b.r), bit(b.g), bit(b.b), formatTime(i * barNs)]),
    },
  ],
  questions: [
    {
      q: 'Only part of each line carries picture. What is the rest for?',
      a: `${vga.h.visible} of ${linePixels} pixel times (${Math.round((100 * vga.h.visible) / linePixels)}%) are picture. The porches and the sync pulse are the time a CRT's beam needed to fly back to the left edge, and a modern monitor still uses them to find where lines start. The colors must be dark then: monitors measure the black level during blanking.`,
    },
    {
      q: `What sample rate would you need to see every single pixel?`,
      a: `One pixel is ${formatTime(px)}, so each pixel needs at least one sample every ${formatTime(px)}, ${formatRate(vga.pixelHz)}, and better two or more. That is beyond a small ${formatRate(24e6)} analyzer, which is why these bars are ${barPixels} pixels wide. To check the timing of video you rarely need individual pixels: the sync pulses and porches are much longer.`,
    },
    {
      q: `This board's pixel clock is ${formatHz(vga.pixelHz)} instead of the standard 25.175 MHz. What does that change?`,
      a: `Everything stretches by the same 0.7%: lines come at ${formatHz(lineHz)} instead of 31.469 kHz and frames at ${formatHz(frameHz)} instead of 59.94 Hz. Monitors accept a small range around the standard, so they lock on anyway. Retro computers do the same thing: their video clocks are whatever their crystal divides down to.`,
    },
    {
      q: `How many lines did you count in one frame, and how long is VSYNC low?`,
      a: `${formatTime(vga.frameNs)} / ${formatTime(vga.lineNs)} = ${frameLines} lines. VSYNC is low for ${vga.v.sync} lines (${formatTime(vsyncNs)}), starting ${formatTime(vsyncStartNs - vga.v.visible * vga.lineNs)} after the last visible line ends.`,
    },
  ],
};
