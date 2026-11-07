import { useEffect, useState } from 'preact/hooks';
import { loadDone, saveDone, withDone } from '../model/progress';

// Tells every mounted user (the sidebar and the lesson page) that the marks changed.
const kEvent = 'ltb-progress';

// The marks for this page, shared by every component. Kept here too so they last for the visit even when the
// browser will not store them.
let current: Set<string> | null = null;

/** The lessons marked as done, and a way to mark one. Stays in step across components and tabs. */
export function useProgress(): [Set<string>, (id: string, done: boolean) => void] {
  current ??= loadDone();
  const [done, setDoneState] = useState<Set<string>>(current);
  useEffect(() => {
    const show = () => setDoneState(new Set(current));
    const fromOtherTab = () => {
      current = loadDone();
      show();
    };
    window.addEventListener(kEvent, show);
    window.addEventListener('storage', fromOtherTab);
    return () => {
      window.removeEventListener(kEvent, show);
      window.removeEventListener('storage', fromOtherTab);
    };
  }, []);
  const mark = (id: string, value: boolean) => {
    current = withDone(current ?? loadDone(), id, value);
    saveDone(current);
    window.dispatchEvent(new Event(kEvent));
  };
  return [done, mark];
}
