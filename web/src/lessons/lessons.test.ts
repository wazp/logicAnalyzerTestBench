import { describe, expect, it } from 'vitest';
import { captureWindow, minimumAnalyzer, validateSettings } from '../model/capture';
import { waveLevelAt } from '../model/wave';
import { lessons } from './index';

describe('lessons', () => {
  it('have unique ids', () => {
    const ids = lessons.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('cover every protocol', () => {
    const ids = lessons.filter((l) => l.track === 'protocols').map((l) => l.id);
    expect(ids).toEqual(['uart', 'i2c', 'spi', 'ws2812', 'onewire', 'ir-remote', 'quadrature']);
  });

  for (const lesson of lessons) {
    describe(lesson.id, () => {
      it('never needs more inputs than a small analyzer has', () => {
        for (const part of lesson.parts) expect(part.settings.gpios.length).toBeLessThanOrEqual(minimumAnalyzer.inputs);
      });

      it('never mentions analyzer channel numbers', () => {
        const text = JSON.stringify(lesson);
        expect(text).not.toMatch(/\bCH\d/);
      });

      for (const part of lesson.parts) {
        it(`"${part.title}" has settings a small analyzer can follow`, () => {
          expect(validateSettings(part.settings)).toEqual([]);
        });

        it(`"${part.title}" only records pins the lesson wires`, () => {
          for (const g of part.settings.gpios) expect(lesson.gpios).toContain(g);
        });

        it(`"${part.title}" views fit inside the capture window`, () => {
          const w = captureWindow(part.settings);
          for (const v of part.views) {
            expect(v.startNs).toBeGreaterThanOrEqual(-w.preNs - 1);
            expect(v.endNs).toBeLessThanOrEqual(w.postNs + 1);
          }
        });

        it(`"${part.title}" views start their trigger edge at t = 0`, () => {
          const t = part.settings.trigger;
          if (t.type !== 'edge') return;
          for (const v of part.views) {
            const row = v.rows?.find((r) => r.gpio === t.gpio);
            if (!row) continue;
            expect(waveLevelAt(row.wave, -1)).toBe(t.edge === 'rising' ? 0 : 1);
            expect(waveLevelAt(row.wave, 0)).toBe(t.edge === 'rising' ? 1 : 0);
          }
        });
      }
    });
  }
});
