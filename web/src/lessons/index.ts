// All lessons, in guide order. The order is a teaching decision, so it is
// written out here rather than discovered from the files.
//
// To add a lesson: create one file exporting a `Lesson` in concepts/,
// basics/, protocols/, video/ or verify/ (shared building blocks are in helpers.ts, the shapes
// in types.ts), then add it to this list. The tests in lessons.test.ts check
// every lesson listed here.

import { aliasing } from './basics/aliasing';
import { captureWindowLesson } from './basics/capture-window';
import { dutyCycle } from './basics/duty-cycle';
import { firstCapture } from './basics/first-capture';
import { isItAlive } from './basics/is-it-alive';
import { mysterySignal } from './basics/mystery-signal';
import { patternTrigger } from './basics/pattern-trigger';
import { rareEvent } from './basics/rare-event';
import { switchBounce } from './basics/switch-bounce';
import { timingBetween } from './basics/timing-between';
import { gotchas } from './concepts/gotchas';
import { howItWorks } from './concepts/how-it-works';
import { limits } from './concepts/limits';
import { memoryDepth } from './concepts/memory-depth';
import { triggers } from './concepts/triggers';
import { vocabulary } from './concepts/vocabulary';
import { voltageLevels } from './concepts/voltage-levels';
import { i2c } from './protocols/i2c';
import { irRemote } from './protocols/ir-remote';
import { onewire } from './protocols/onewire';
import { quadrature } from './protocols/quadrature';
import { spi } from './protocols/spi';
import { uart } from './protocols/uart';
import { ws2812 } from './protocols/ws2812';
import type { Lesson } from './types';
import { clockAccuracy } from './verify/clock-accuracy';
import { sanityCheck } from './verify/sanity-check';
import { nesController } from './video/nes';
import { ps2Keyboard } from './video/ps2';
import { vgaLesson } from './video/vga';

export type { Check, FactTable, Figure, Lesson, Part, Question, Section, View } from './types';

export const lessons: Lesson[] = [
  // Concepts: how analyzers work, for any analyzer.
  howItWorks,
  voltageLevels,
  vocabulary,
  triggers,
  gotchas,
  limits,
  memoryDepth,
  // Learn: the basics, on GP0-GP9 and the GP26 button.
  firstCapture,
  aliasing,
  captureWindowLesson,
  dutyCycle,
  rareEvent,
  patternTrigger,
  isItAlive,
  switchBounce,
  mysterySignal,
  timingBetween,
  // Protocols, on GP10-GP22.
  uart,
  i2c,
  spi,
  ws2812,
  onewire,
  irRemote,
  quadrature,
  // Video and input, on GP10-GP19 with the "Video and input" preset.
  vgaLesson,
  nesController,
  ps2Keyboard,
  // Verify your analyzer.
  sanityCheck,
  clockAccuracy,
];

export function lessonById(id: string): Lesson | undefined {
  return lessons.find((l) => l.id === id);
}
