import { describe, expect, it } from 'vitest';
import { signalName } from '../model/board';
import { captureWindow, minimumAnalyzer, validateSettings } from '../model/capture';
import { presetPins } from '../model/presets';
import { waveLevelAt } from '../model/wave';
import { lessons, nextLesson, nextUnfinished, searchLessons, tracks } from './index';

describe('lessons', () => {
  it('have unique ids', () => {
    const ids = lessons.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('cover every protocol, one lesson each, before any lesson across protocols', () => {
    const ids = lessons.filter((l) => l.track === 'protocols' && l.parts.length > 0).map((l) => l.id);
    expect(ids.slice(0, 7)).toEqual(['uart', 'i2c', 'spi', 'ws2812', 'onewire', 'ir-remote', 'quadrature']);
  });

  it('never rely on an optional lesson', () => {
    for (const opt of lessons.filter((l) => l.optional)) {
      for (const other of lessons.filter((l) => l !== opt)) {
        const text = JSON.stringify(other);
        expect(text).not.toContain(`lesson/${opt.id}`);
        expect(text).not.toContain(opt.title);
      }
    }
  });

  it('put every video and faults preset lesson in its own track', () => {
    for (const l of lessons) expect(l.track === 'video').toBe(l.preset === 'video');
    for (const l of lessons) expect(l.track === 'faults').toBe(l.preset === 'faults');
    expect(lessons.filter((l) => l.track === 'video').map((l) => l.id)).toEqual(['vga', 'nes-controller', 'ps2-keyboard']);
  });

  it('keep the real hardware track reading only, since it uses no bench signals', () => {
    for (const l of lessons.filter((x) => x.track === 'hardware')) expect(l.parts).toEqual([]);
  });

  it('start with the concepts track', () => {
    expect(lessons.slice(0, 5).map((l) => l.track)).toEqual(Array(5).fill('concepts'));
  });

  it('keep each track together, in the order of the track list', () => {
    const order = lessons.map((l) => l.track).filter((t, i, all) => i === 0 || all[i - 1] !== t);
    expect(order).toEqual(tracks.map((t) => t.id));
  });

  it('end a track with its capstone, which has answers to check against', () => {
    for (const l of lessons.filter((x) => x.capstone)) {
      const track = lessons.filter((x) => x.track === l.track);
      expect(track[track.length - 1]).toBe(l);
      expect(l.questions.length).toBeGreaterThan(0);
    }
  });

  it('introduce decoders before showing what wrong settings do', () => {
    expect(lessons.filter((l) => l.track === 'decoders').map((l) => l.id)).toEqual([
      'decoders',
      'protocol-triggers',
      'sigrok-decoders',
      'decoder-garbage',
    ]);
  });

  it('continue at the first lesson not marked as done', () => {
    expect(nextLesson(new Set())).toBe(lessons[0]);
    expect(nextLesson(new Set([lessons[0].id, lessons[2].id]))).toBe(lessons[1]);
    expect(nextLesson(new Set(lessons.map((l) => l.id)))).toBeUndefined();
  });

  it('search titles, summaries and track names, every word, ignoring case', () => {
    expect(searchLessons('  ')).toEqual([]);
    expect(searchLessons('UART').map((l) => l.id)).toContain('uart');
    expect(searchLessons('i2c').map((l) => l.id)).toContain('i2c');
    expect(searchLessons('decoders garbage').map((l) => l.id)).toEqual(['decoder-garbage']);
    const faults = lessons.filter((l) => l.track === 'faults');
    expect(searchLessons('find the bug')).toEqual(expect.arrayContaining(faults));
    expect(searchLessons('zzzz')).toEqual([]);
  });

  it('offer the next unfinished lesson after one, wrapping to earlier ones', () => {
    const [a, b, c] = lessons;
    const last = lessons[lessons.length - 1];
    expect(nextUnfinished(a, new Set([a.id]))).toBe(b);
    expect(nextUnfinished(a, new Set([a.id, b.id]))).toBe(c);
    const allButB = new Set(lessons.filter((l) => l !== b).map((l) => l.id));
    expect(nextUnfinished(last, allButB)).toBe(b);
    expect(nextUnfinished(a, new Set(lessons.map((l) => l.id)))).toBeUndefined();
  });

  for (const lesson of lessons) {
    describe(lesson.id, () => {
      it('teaches something: explanation sections or a hands-on part', () => {
        expect((lesson.sections?.length ?? 0) + lesson.parts.length).toBeGreaterThan(0);
      });

      it('wires pins only when it has a hands-on part', () => {
        if (lesson.parts.length === 0) expect(lesson.gpios).toEqual([]);
        else expect(lesson.gpios.length).toBeGreaterThan(0);
      });

      it('only wires pins its preset drives', () => {
        const preset = lesson.preset ?? 'protocols';
        const timeline = presetPins(preset).map((p) => p.gpio);
        for (const g of lesson.gpios) {
          if (g >= 10 && g <= 22) expect(timeline).toContain(g);
          expect(() => signalName(g, preset)).not.toThrow();
        }
      });

      it('never needs more inputs than a small analyzer has', () => {
        for (const part of lesson.parts) expect(part.settings.gpios.length).toBeLessThanOrEqual(minimumAnalyzer.inputs);
      });

      it('shows no waveforms when the pins are a mystery', () => {
        if (lesson.mystery) for (const part of lesson.parts) expect(part.views).toEqual([]);
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

        it(`"${part.title}" views only draw pins the lesson wires`, () => {
          for (const v of part.views) for (const r of v.rows ?? []) expect(lesson.gpios).toContain(r.gpio);
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
