// All lessons, in guide order. The order is a teaching decision, so it is
// written out here rather than discovered from the files.
//
// To add a lesson: create one file exporting a `Lesson` in concepts/,
// basics/, protocols/, decoders/, video/, faults/, verify/ or hardware/ (shared building blocks are in helpers.ts, the shapes
// in types.ts), then add it to this list. The tests in lessons.test.ts check
// every lesson listed here.

import { aliasing } from './basics/aliasing';
import { captureWindowLesson } from './basics/capture-window';
import { dutyCycle } from './basics/duty-cycle';
import { exportScripting } from './basics/export-scripting';
import { findOneEvent } from './basics/find-one-event';
import { firstCapture } from './basics/first-capture';
import { isItAlive } from './basics/is-it-alive';
import { mysterySignal } from './basics/mystery-signal';
import { patternTrigger } from './basics/pattern-trigger';
import { rareEvent } from './basics/rare-event';
import { switchBounce } from './basics/switch-bounce';
import { timingBetween } from './basics/timing-between';
import { faultsGlitch } from './faults/glitch';
import { faultsI2c } from './faults/i2c';
import { faultsOnewire } from './faults/onewire';
import { faultsSpi } from './faults/spi';
import { faultsUart } from './faults/uart';
import { faultsWs2812 } from './faults/ws2812';
import { decoderGarbage } from './decoders/decoder-garbage';
import { decoders } from './decoders/decoders';
import { sigrokDecoders } from './decoders/sigrok-decoders';
import { gotchas } from './concepts/gotchas';
import { numbers } from './concepts/numbers';
import { timingDiagrams } from './concepts/timing-diagrams';
import { connecting } from './hardware/connecting';
import { debugMethod } from './hardware/debug-method';
import { mixedVoltages } from './hardware/mixed-voltages';
import { openDrain } from './hardware/open-drain';
import { safeProbing } from './hardware/safe-probing';
import { timeYourCode } from './hardware/time-your-code';
import { unknownBoard } from './hardware/unknown-board';
import { howItWorks } from './concepts/how-it-works';
import { limits } from './concepts/limits';
import { memoryDepth } from './concepts/memory-depth';
import { triggers } from './concepts/triggers';
import { vocabulary } from './concepts/vocabulary';
import { voltageLevels } from './concepts/voltage-levels';
import { atAGlance } from './protocols/at-a-glance';
import { i2c } from './protocols/i2c';
import { irRemote } from './protocols/ir-remote';
import { onewire } from './protocols/onewire';
import { quadrature } from './protocols/quadrature';
import { spi } from './protocols/spi';
import { uart } from './protocols/uart';
import { ws2812 } from './protocols/ws2812';
import type { Lesson, TrackId } from './types';
import { clockAccuracy } from './verify/clock-accuracy';
import { counterCheck } from './verify/counter';
import { sanityCheck } from './verify/sanity-check';
import { speedTest } from './verify/speed-test';
import { nesController } from './video/nes';
import { ps2Keyboard } from './video/ps2';
import { vgaLesson } from './video/vga';

export type { Check, FactTable, Figure, Lesson, Part, Question, Section, TrackId, View } from './types';

export const lessons: Lesson[] = [
  // Concepts: how analyzers work, for any analyzer.
  howItWorks,
  voltageLevels,
  vocabulary,
  numbers,
  triggers,
  timingDiagrams,
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
  findOneEvent,
  exportScripting,
  // Protocols, on GP10-GP22.
  atAGlance,
  uart,
  i2c,
  spi,
  ws2812,
  onewire,
  irRemote,
  quadrature,
  // Decoders: what they do, using them, and what wrong settings look like. On GP10-GP17.
  decoders,
  sigrokDecoders,
  decoderGarbage,
  // Video and input, on GP10-GP19 with the "Video and input" preset.
  vgaLesson,
  nesController,
  ps2Keyboard,
  // Find the bug, on GP10-GP20 with the "Faults" preset.
  faultsUart,
  faultsI2c,
  faultsSpi,
  faultsWs2812,
  faultsOnewire,
  faultsGlitch,
  // Verify your analyzer.
  sanityCheck,
  clockAccuracy,
  counterCheck,
  speedTest,
  // On real hardware: probing circuits other than the bench. Reading only.
  safeProbing,
  connecting,
  openDrain,
  mixedVoltages,
  unknownBoard,
  debugMethod,
  timeYourCode,
];

/** The tracks in guide order, with the name lesson pages show, and a shorter one for the sidebar where needed. */
export const tracks: { id: TrackId; label: string; short?: string }[] = [
  { id: 'concepts', label: 'Concepts' },
  { id: 'learn', label: 'Learn' },
  { id: 'protocols', label: 'Protocols' },
  { id: 'decoders', label: 'Decoders' },
  { id: 'video', label: 'Video and input' },
  { id: 'faults', label: 'Find the bug' },
  { id: 'verify', label: 'Verify your analyzer', short: 'Verify' },
  { id: 'hardware', label: 'On real hardware' },
];

export function trackLabel(id: TrackId): string {
  return tracks.find((t) => t.id === id)?.label ?? id;
}

/** The first lesson in guide order not marked as done: where the reader continues. */
export function nextLesson(done: Set<string>): Lesson | undefined {
  return lessons.find((l) => !done.has(l.id));
}

export function lessonById(id: string): Lesson | undefined {
  return lessons.find((l) => l.id === id);
}
