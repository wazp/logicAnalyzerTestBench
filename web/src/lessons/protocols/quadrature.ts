// Lesson: quadrature encoder. Bytes, timings and decoded values come from protocols.json, which
// the firmware's own C++ generates, so they always match what the board sends.

import { frameMs, gpioOf, protocolData as d } from '../../model/protocols';
import { exampleView, protocolWireSteps } from '../helpers';
import type { Lesson } from '../types';

const qa = gpioOf('quadrature', 'a');
const qb = gpioOf('quadrature', 'b');

export const quadrature: Lesson = {
  id: 'quadrature',
  track: 'protocols',
  title: 'Quadrature encoder',
  summary: 'Two signals a quarter period apart tell direction and position.',
  gpios: [qa, qb],
  intro: `GP${qa} and GP${qb} are the A and B outputs of a rotary encoder (like a volume knob, or the encoder on a motor). It turns ${d.quadrature.steps} steps one way, then ${d.quadrature.steps} back. Each output is a square wave, but they are shifted a quarter period apart: which one changes first tells the direction.`,
  parts: [
    {
      title: 'Catch it changing direction',
      settings: {
        gpios: [qa, qb],
        sampleRateHz: 100_000,
        durationNs: 130e6,
        preTriggerNs: 5e6,
        trigger: { type: 'edge', gpio: qa, edge: 'rising' },
        decoder: 'Quadrature or rotary encoder decoder, if your software has one',
      },
      steps: [
        ...protocolWireSteps([qa, qb]),
        `Capture 130 ms, triggered on the rising edge of GP${qa}. The encoder changes direction every ${(d.quadrature.steps * d.quadrature.stepUs) / 1000} ms (twice in every ${frameMs} ms of traffic), so the capture always contains a turnaround.`,
        `Find a stretch where GP${qa} rises while GP${qb} is low. That is one direction ("A leads B").`,
        `Find where it turns around: from then on GP${qb} changes first.`,
        'Count the edges on both lines between two turnarounds. Each edge is one step.',
      ],
      views: [
        exampleView('quadrature', 'turnaround', { gpio: qa, edge: 'rising' }, {
          title: 'Turning around',
          sampleRateHz: 100_000,
          caption: `Left of the turnaround A leads B, right of it B leads A. One step every ${d.quadrature.stepUs} µs.`,
        }),
      ],
    },
  ],
  questions: [
    {
      q: 'How many steps does the encoder move each way?',
      a: `${d.quadrature.steps}: count every edge on A and on B. A full cycle of both lines is 4 steps, so that is ${d.quadrature.steps / 4} full cycles.`,
    },
    {
      q: 'Why not just count pulses on one line?',
      a: 'One line tells you that it moved, not which way. The second line, a quarter period later, gives the direction, and counting both lines gives four times the resolution.',
    },
  ],
};
