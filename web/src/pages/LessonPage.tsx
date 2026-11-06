import { Checklist } from '../components/Checklist';
import { PinDiagram } from '../components/PinDiagram';
import { Rich } from '../components/Rich';
import { SettingsCard } from '../components/SettingsCard';
import { ThresholdDiagram } from '../components/ThresholdDiagram';
import { ViewTabs } from '../components/ViewTabs';
import { Zoomable } from '../components/Zoomable';
import { lessons, type FactTable, type Lesson, type Section } from '../lessons';
import { signalColor, signalName } from '../model/board';
import { physicalPinForGpio } from '../model/pico';

function WiringTable({ gpios }: { gpios: number[] }) {
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
              <td>{signalName(g)}</td>
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

const trackLabel: Record<Lesson['track'], string> = {
  concepts: 'Concepts',
  learn: 'Learn',
  protocols: 'Protocols',
  verify: 'Verify your analyzer',
};

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
  return (
    <article class="lesson">
      <header>
        <div class="eyebrow">{trackLabel[lesson.track]}</div>
        <h1>{lesson.title}</h1>
        <p class="lede">{lesson.summary}</p>
      </header>
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
            <WiringTable gpios={lesson.gpios} />
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
          <h3>What you should see</h3>
          <ViewTabs key={part.title} gpios={part.settings.gpios} views={part.views} />
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

      <Pager lesson={lesson} />
    </article>
  );
}
