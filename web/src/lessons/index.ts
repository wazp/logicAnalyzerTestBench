// All lessons, in guide order. The order is a teaching decision, so it is
// written out here rather than discovered from the files.
//
// To add a lesson: create one file exporting a `Lesson` in basics/,
// protocols/ or verify/ (shared building blocks are in helpers.ts, the shapes
// in types.ts), then add it to this list. The tests in lessons.test.ts check
// every lesson listed here.

import { aliasing } from './basics/aliasing';
import { captureWindowLesson } from './basics/capture-window';
import { dutyCycle } from './basics/duty-cycle';
import { firstCapture } from './basics/first-capture';
import { patternTrigger } from './basics/pattern-trigger';
import { rareEvent } from './basics/rare-event';
import { i2c } from './protocols/i2c';
import { irRemote } from './protocols/ir-remote';
import { onewire } from './protocols/onewire';
import { quadrature } from './protocols/quadrature';
import { spi } from './protocols/spi';
import { uart } from './protocols/uart';
import { ws2812 } from './protocols/ws2812';
import type { Lesson } from './types';
import { sanityCheck } from './verify/sanity-check';

export type { Check, FactTable, Lesson, Part, Question, View } from './types';

export const lessons: Lesson[] = [
  // Learn: the basics, on GP0-GP9.
  firstCapture,
  aliasing,
  captureWindowLesson,
  dutyCycle,
  rareEvent,
  patternTrigger,
  // Protocols, on GP10-GP22.
  uart,
  i2c,
  spi,
  ws2812,
  onewire,
  irRemote,
  quadrature,
  // Verify your analyzer.
  sanityCheck,
];

export function lessonById(id: string): Lesson | undefined {
  return lessons.find((l) => l.id === id);
}
