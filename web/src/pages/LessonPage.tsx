import { Checklist } from '../components/Checklist';
import { PresetBanner } from '../components/PresetBanner';
import { MysteryContext, PresetContext } from '../components/PresetContext';
import { PinDiagram } from '../components/PinDiagram';
import { Rich } from '../components/Rich';
import { SettingsCard } from '../components/SettingsCard';
import { ThresholdDiagram } from '../components/ThresholdDiagram';
import { ViewTabs } from '../components/ViewTabs';
import { useProgress } from '../components/useProgress';
import { Zoomable } from '../components/Zoomable';
import { lessons, nextUnfinished, trackLabel, type FactTable, type Lesson, type Section } from '../lessons';
import { signalColor, signalName } from '../model/board';
import { defaultPreset, type PresetId } from '../model/presets';
import { physicalPinForGpio } from '../model/pico';

function WiringTable({ gpios, preset, mystery }: { gpios: number[]; preset: PresetId; mystery: boolean }) {
  return (
    <div class="table-scroll">
      <table class="wiring">
        <thead>
          <tr>
            <th>Pico</th>
            <th>Signal</th>
            <th>Analyzer</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Any GND pin</td>
            <td class="muted">common ground</td>
            <td>GND, connect first</td>
          </tr>
          {gpios.map((g) => (
            <tr key={g}>
              <td class="nowrap">
                <span class="ch-dot" style={{ background: signalColor(g) }} />
                GP{g}, pin {physicalPinForGpio(g)}
              </td>
              <td>{mystery ? <span class="muted">unknown: find out</span> : signalName(g, preset)}</td>
              <td class="muted">any free input</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Table({ table }: { table: FactTable }) {
  return (
    <section>
      <h2>{table.title}</h2>
      <div class="table-scroll">
        <table class="fact-table">
          <thead>
            <tr>
              {table.head.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j}>
                    <Rich text={c} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ConceptSection({ section }: { section: Section }) {
  return (
    <section class="concept-section">
      <h2>{section.title}</h2>
      {section.body.map((p) => (
        <p key={p}>
          <Rich text={p} />
        </p>
      ))}
      {section.bullets && (
        <ul>
          {section.bullets.map((b) => (
            <li key={b}>
              <Rich text={b} />
            </li>
          ))}
        </ul>
      )}
      {section.code && (
        <pre class="code-block">
          <code>{section.code}</code>
        </pre>
      )}
      {section.figure === 'thresholds' && <ThresholdDiagram />}
      {section.table && (
        <div class="table-scroll">
          <table class="fact-table">
            <thead>
              <tr>
                {section.table.head.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.table.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j}>
                      <Rich text={c} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function DoneToggle({ lesson }: { lesson: Lesson }) {
  const [done, mark] = useProgress();
  const isDone = done.has(lesson.id);
  const next = isDone ? nextUnfinished(lesson, done) : undefined;
  return (
    <div class="done-toggle">
      <button type="button" class={isDone ? 'button secondary' : 'button'} aria-pressed={isDone} onClick={() => mark(lesson.id, !isDone)}>
        {isDone ? '✓ Done' : 'Mark as done'}
      </button>
      {/* No automatic jump: readers often mark a lesson and stay to look back at it. */}
      {next && (
        <a class="button" href={`#/lesson/${next.id}`}>
          Next: {next.title} →
        </a>
      )}
      <span class="muted small">Saved in this browser only.</span>
    </div>
  );
}

function Pager({ lesson }: { lesson: Lesson }) {
  const i = lessons.indexOf(lesson);
  const prev = lessons[i - 1];
  const next = lessons[i + 1];
  return (
    <nav class="pager">
      {prev ? <a href={`#/lesson/${prev.id}`}>← {prev.title}</a> : <a href="#/">← Start here</a>}
      {next && <a href={`#/lesson/${next.id}`}>{next.title} →</a>}
    </nav>
  );
}

export function LessonPage({ lesson }: { lesson: Lesson }) {
  const preset = lesson.preset ?? defaultPreset;
  const mystery = lesson.mystery ?? false;
  const usesTimeline = lesson.gpios.some((g) => g >= 10 && g <= 22);
  return (
    <PresetContext.Provider value={preset}>
      <MysteryContext.Provider value={mystery}>
        <article class="lesson">
          <header>
            <a class="eyebrow" href={`#/track/${lesson.track}`}>
              {trackLabel(lesson.track)}
            </a>
            <h1>{lesson.title}</h1>
            <p class="lede">{lesson.summary}</p>
          </header>
          {lesson.capstone && (
            <aside class="optional-banner">
              {lesson.parts.length > 0 ? (
                <>
                  <strong>Capstone.</strong> The end of the track: no settings and no pictures, only the task. Choose
                  the sample rate, length and trigger yourself, using what the track taught. Each part has one worked
                  way to set up the capture, collapsed, and the answers are in the questions at the end.
                </>
              ) : (
                <>
                  <strong>Capstone.</strong> The end of the track: a case to work through with what the track taught.
                  Answer each question yourself before you open it.
                </>
              )}
            </aside>
          )}
          {lesson.optional && (
            <aside class="optional-banner">
              <strong>Optional lesson.</strong> <Rich text={lesson.optional} />
            </aside>
          )}
          {usesTimeline && <PresetBanner preset={preset} />}
          <p>
            <Rich text={lesson.intro} />
          </p>
  
          {lesson.sections?.map((sec) => <ConceptSection key={sec.title} section={sec} />)}
  
          {lesson.gpios.length > 0 && (
            <section class="wiring-section">
              <h2>Wiring</h2>
              <div class="wiring-grid">
                <Zoomable title="Wiring">
                  <PinDiagram gpios={lesson.gpios} />
                </Zoomable>
                <WiringTable gpios={lesson.gpios} preset={preset} mystery={mystery} />
              </div>
            </section>
          )}
  
          {lesson.parts.map((part) => (
            <section key={part.title} class="part">
              <h2>{part.title}</h2>
              {part.intro && (
                <p>
                  <Rich text={part.intro} />
                </p>
              )}
              {lesson.capstone ? (
                // A capstone leaves the settings to the reader; one worked way to do it waits behind a click.
                <>
                  <ol class="steps">
                    {part.steps.map((s) => (
                      <li key={s}>
                        <Rich text={s} />
                      </li>
                    ))}
                  </ol>
                  <details class="worked">
                    <summary>One way to capture it (open once you have tried)</summary>
                    <SettingsCard settings={part.settings} />
                    {part.views.length > 0 && (
                      <ViewTabs key={part.title} gpios={part.settings.gpios} views={part.views} />
                    )}
                  </details>
                </>
              ) : (
                <>
                  <div class="part-grid">
                    <ol class="steps">
                      {part.steps.map((s) => (
                        <li key={s}>
                          <Rich text={s} />
                        </li>
                      ))}
                    </ol>
                    <SettingsCard settings={part.settings} />
                  </div>
                  {part.views.length > 0 && (
                    <>
                      <h3>What you should see</h3>
                      <ViewTabs key={part.title} gpios={part.settings.gpios} views={part.views} />
                    </>
                  )}
                </>
              )}
            </section>
          ))}
  
          {lesson.tables?.map((t) => <Table key={t.title} table={t} />)}
  
          {lesson.checks && (
            <section>
              <h2>Checklist</h2>
              <Checklist lessonId={lesson.id} checks={lesson.checks} />
            </section>
          )}
  
          {lesson.tips && (
            <section>
              <h2>If something is off</h2>
              <ul>
                {lesson.tips.map((t) => (
                  <li key={t}>
                    <Rich text={t} />
                  </li>
                ))}
              </ul>
            </section>
          )}
  
          {lesson.questions.length > 0 && (
            <section>
              <h2>Check your understanding</h2>
              {lesson.questions.map((q) => (
                <details key={q.q} class="question">
                  <summary>{q.q}</summary>
                  <p>
                    <Rich text={q.a} />
                  </p>
                </details>
              ))}
            </section>
          )}
  
          <DoneToggle lesson={lesson} />
          <Pager lesson={lesson} />
        </article>
      </MysteryContext.Provider>
    </PresetContext.Provider>
  );
}
