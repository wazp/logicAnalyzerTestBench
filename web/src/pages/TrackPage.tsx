import { PresetBanner } from '../components/PresetBanner';
import { Rich } from '../components/Rich';
import { useProgress } from '../components/useProgress';
import { lessons, tracks, type Lesson, type Track } from '../lessons';
import { defaultPreset, presetById, type PresetId } from '../model/presets';

/** The presets a track's lessons need, with how many need each: only lessons that wire GP10-GP22 depend on one. */
function trackPresets(members: Lesson[]): { preset: PresetId; count: number }[] {
  const counts = new Map<PresetId, number>();
  for (const l of members.filter((x) => x.gpios.some((g) => g >= 10 && g <= 22))) {
    const p = l.preset ?? defaultPreset;
    counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  return [...counts].map(([preset, count]) => ({ preset, count }));
}

/** "Signal preset: Faults" when every hands-on lesson needs it, otherwise how many lessons need which. */
function presetFact(presets: { preset: PresetId; count: number }[], handsOn: number): string {
  if (presets.length === 0) return 'Works with any signal preset';
  const name = (p: PresetId) => presetById(p).title;
  if (presets.length === 1 && presets[0].count === handsOn) return `Signal preset: ${name(presets[0].preset)}`;
  return presets
    .map(({ preset, count }) => `${count} ${count === 1 ? 'lesson needs' : 'lessons need'} the ${name(preset)} preset`)
    .join(', ');
}

export function TrackPage({ track }: { track: Track }) {
  const [done] = useProgress();
  const members = lessons.filter((l) => l.track === track.id);
  const count = members.filter((l) => done.has(l.id)).length;
  const next = members.find((l) => !done.has(l.id));
  const reading = members.filter((l) => l.parts.length === 0).length;
  const handsOn = members.length - reading;
  const presets = trackPresets(members);
  const i = tracks.indexOf(track);
  const prev = tracks[i - 1];
  const after = tracks[i + 1];
  return (
    <article class="lesson track-page">
      <header>
        <div class="eyebrow">Track {i + 1} of {tracks.length}</div>
        <h1>{track.label}</h1>
        <p class="lede">
          <Rich text={track.intro} />
        </p>
      </header>
      <ul class="track-facts">
        <li>
          {members.length} lessons
          {reading === members.length ? ', all reading only' : reading > 0 ? `, ${reading} of them reading only` : ''}
        </li>
        {handsOn > 0 && <li>{presetFact(presets, handsOn)}</li>}
        <li>
          {count} of {members.length} marked as done
        </li>
      </ul>
      {/* Only when the whole track needs one preset; a track that uses it for a few lessons leaves it to them. */}
      {presets.length === 1 && presets[0].count === handsOn && (
        <PresetBanner preset={presets[0].preset} subject="track" />
      )}
      <nav class="cta">
        {next ? (
          <a class="button" href={`#/lesson/${next.id}`}>
            {count === 0 ? 'Start' : 'Continue'} with {next.title} →
          </a>
        ) : (
          <span class="track-complete">✓ Every lesson in this track is marked as done.</span>
        )}
      </nav>
      <ul class="track-lessons">
        {members.map((l) => (
          <li key={l.id} class={done.has(l.id) ? 'done' : ''}>
            <a href={`#/lesson/${l.id}`}>{l.title}</a>
            {l.optional && <span class="nav-tag">optional</span>}
            {l.capstone && <span class="nav-tag">capstone</span>}
            {l.parts.length === 0 && <span class="nav-tag">reading</span>}
            {done.has(l.id) && (
              <span class="nav-done" aria-label="done" title="Marked as done">
                ✓
              </span>
            )}
            <p class="muted">{l.summary}</p>
          </li>
        ))}
      </ul>
      <nav class="pager">
        {prev ? <a href={`#/track/${prev.id}`}>← {prev.label}</a> : <a href="#/">← Start here</a>}
        {after && <a href={`#/track/${after.id}`}>{after.label} →</a>}
      </nav>
    </article>
  );
}
