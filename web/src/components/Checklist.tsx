import { useEffect, useState } from 'preact/hooks';
import type { Check } from '../lessons';
import { signalColor, signalName } from '../model/board';

type Result = 'pass' | 'fail' | undefined;

// Results are a per-browser convenience only. Storage can be unavailable
// (private windows, blocked site data), so every access is guarded.
function load(key: string): Record<string, Result> {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '{}');
  } catch {
    return {};
  }
}

function save(key: string, value: Record<string, Result>) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Not persisting is fine.
  }
}

/** Pass/fail table for the verify track. */
export function Checklist({ lessonId, checks }: { lessonId: string; checks: Check[] }) {
  const key = `ltb-checks-${lessonId}`;
  const [results, setResults] = useState<Record<string, Result>>(() => load(key));
  useEffect(() => save(key, results), [key, results]);

  const set = (id: string, r: Result) => setResults({ ...results, [id]: results[id] === r ? undefined : r });
  const passed = checks.filter((c) => results[c.id] === 'pass').length;
  const failed = checks.filter((c) => results[c.id] === 'fail').length;

  return (
    <div class="checklist">
      <table>
        <thead>
          <tr>
            <th>Signal</th>
            <th>Measure</th>
            <th>Expected</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((c) => {
            return (
              <tr key={c.id} class={results[c.id] ?? ''}>
                <td>
                  <span class="ch-dot" style={{ background: signalColor(c.gpio) }} />
                  GP{c.gpio} <span class="muted">{signalName(c.gpio)}</span>
                </td>
                <td>{c.measure}</td>
                <td>{c.expected}</td>
                <td class="result-buttons">
                  <button class={results[c.id] === 'pass' ? 'pass active' : 'pass'} onClick={() => set(c.id, 'pass')}>
                    Pass
                  </button>
                  <button class={results[c.id] === 'fail' ? 'fail active' : 'fail'} onClick={() => set(c.id, 'fail')}>
                    Fail
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div class="checklist-summary">
        {passed} of {checks.length} passed{failed > 0 ? `, ${failed} failed` : ''}
        {passed + failed > 0 && (
          <button class="link-button" onClick={() => setResults({})}>
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
