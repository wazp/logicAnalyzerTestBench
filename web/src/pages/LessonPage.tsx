import { Checklist } from '../components/Checklist';
import { PinDiagram } from '../components/PinDiagram';
import { Rich } from '../components/Rich';
import { SettingsCard } from '../components/SettingsCard';
import { ViewTabs } from '../components/ViewTabs';
import { lessons, type Lesson } from '../lessons/lessons';
import { formatTime } from '../model/format';
import { physicalPinForGpio } from '../model/pico';
import { channelForGpio, segmentTimeline, signalByGpio } from '../model/signals';

function WiringTable({ gpios }: { gpios: number[] }) {
  return (
    <div class="table-scroll">
    <table class="wiring">
      <thead>
        <tr>
          <th>Analyzer</th>
          <th>Pico</th>
          <th>Signal</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>GND</td>
          <td>GND, pin 3, 8 or 13</td>
          <td class="muted">common ground, connect first</td>
        </tr>
        {gpios.map((g) => (
          <tr key={g}>
            <td>CH{channelForGpio(g)}</td>
            <td>
              GP{g}, pin {physicalPinForGpio(g)}
            </td>
            <td>{signalByGpio(g).name}</td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}

function PatternTable() {
  const rows = segmentTimeline(signalByGpio(9));
  return (
    <table class="pattern-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Starts at</th>
          <th>Level</th>
          <th>Width</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td>{i + 1}</td>
            <td>{formatTime(r.start)}</td>
            <td>{r.level ? 'high' : 'low'}</td>
            <td>{formatTime(r.ns)}</td>
          </tr>
        ))}
      </tbody>
    </table>
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
  return (
    <article class="lesson">
      <header>
        <div class="eyebrow">{lesson.track === 'learn' ? 'Learn' : 'Verify your analyzer'}</div>
        <h1>{lesson.title}</h1>
        <p class="lede">{lesson.summary}</p>
      </header>
      <p>
        <Rich text={lesson.intro} />
      </p>

      <section class="wiring-section">
        <h2>Wiring</h2>
        <div class="wiring-grid">
          <PinDiagram gpios={lesson.gpios} />
          <WiringTable gpios={lesson.gpios} />
        </div>
      </section>

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
          <ViewTabs key={part.title} gpios={lesson.gpios} views={part.views} />
        </section>
      ))}

      {lesson.id === 'pattern-trigger' && (
        <section>
          <h2>Expected segments on CH10</h2>
          <PatternTable />
        </section>
      )}

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
