import { describe, expect, it } from 'vitest';
import { loadDone, saveDone, withDone, type ProgressStorage } from './progress';

function memory(initial: Record<string, string> = {}): ProgressStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

describe('lesson progress', () => {
  it('marks without changing the original set', () => {
    const ids = new Set(['uart']);
    expect([...withDone(ids, 'i2c', true)].sort()).toEqual(['i2c', 'uart']);
    expect([...ids]).toEqual(['uart']);
  });

  it('starts with nothing done', () => {
    expect(loadDone(memory()).size).toBe(0);
  });

  it('marks and unmarks lessons, and keeps them', () => {
    const s = memory();
    let ids = withDone(withDone(new Set(), 'uart', true), 'i2c', true);
    saveDone(ids, s);
    expect([...loadDone(s)].sort()).toEqual(['i2c', 'uart']);
    ids = withDone(ids, 'uart', false);
    saveDone(ids, s);
    expect([...loadDone(s)]).toEqual(['i2c']);
  });

  it('reads malformed data as nothing done', () => {
    expect(loadDone(memory({ 'ltb-done': 'not json' })).size).toBe(0);
    expect(loadDone(memory({ 'ltb-done': '{"uart":true}' })).size).toBe(0);
    expect([...loadDone(memory({ 'ltb-done': '["uart", 3, null]' }))]).toEqual(['uart']);
  });

  it('works without storage', () => {
    expect(loadDone(null).size).toBe(0);
    expect(() => saveDone(new Set(['uart']), null)).not.toThrow();
  });

  it('survives storage that throws', () => {
    const broken: ProgressStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadDone(broken).size).toBe(0);
    expect(() => saveDone(new Set(['uart']), broken)).not.toThrow();
  });
});
