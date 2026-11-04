import { describe, expect, it } from 'vitest';
import { captureWindow, modeFor, validateSettings } from '../model/analyzer';
import { channelForGpio } from '../model/signals';
import { lessons } from './lessons';

describe('lessons', () => {
  it('have unique ids', () => {
    const ids = lessons.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const lesson of lessons) {
    describe(lesson.id, () => {
      for (const part of lesson.parts) {
        it(`"${part.title}" has settings the analyzer accepts`, () => {
          expect(validateSettings(part.settings)).toEqual([]);
        });

        it(`"${part.title}" only enables channels that are wired`, () => {
          const wired = lesson.gpios.map(channelForGpio);
          for (const c of part.settings.channels) expect(wired).toContain(c);
        });

        it(`"${part.title}" views fit inside the capture window`, () => {
          const w = captureWindow(part.settings);
          for (const v of part.views) {
            expect(v.startNs).toBeGreaterThanOrEqual(-w.preNs - 1);
            expect(v.endNs).toBeLessThanOrEqual(w.postNs + 1);
          }
        });

        it(`"${part.title}" uses a valid channel mode`, () => {
          expect(() => modeFor(part.settings.channels)).not.toThrow();
        });
      }
    });
  }
});
