// Which lessons the reader has marked as done. A per-browser convenience only: storage can be unavailable
// (private windows, blocked site data, a file:// page in some browsers), so every access is guarded and the
// guide works the same without it, just without the marks.

const kKey = 'ltb-done';

/** The storage the marks live in; a parameter so tests can pass a fake. */
export interface ProgressStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStorage(): ProgressStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** The ids of the lessons marked as done. Unknown or malformed data reads as none. */
export function loadDone(storage: ProgressStorage | null = defaultStorage()): Set<string> {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(kKey) ?? '[]');
    return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

/** Stores the marks. Saving can fail, which only means they are gone next visit. */
export function saveDone(ids: Set<string>, storage: ProgressStorage | null = defaultStorage()): void {
  try {
    storage?.setItem(kKey, JSON.stringify([...ids].sort()));
  } catch {
    // Not persisting is fine.
  }
}

/** `ids` with one lesson marked or unmarked, as a new set. */
export function withDone(ids: Set<string>, id: string, done: boolean): Set<string> {
  const next = new Set(ids);
  if (done) next.add(id);
  else next.delete(id);
  return next;
}
