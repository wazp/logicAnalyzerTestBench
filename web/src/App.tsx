import { useEffect, useState } from 'preact/hooks';
import { useProgress } from './components/useProgress';
import { lessonById, lessons, nextLesson, tracks, type Lesson, type TrackId } from './lessons';
import { getStatus } from './model/device';
import { HomePage } from './pages/HomePage';
import { LessonPage } from './pages/LessonPage';
import { PresetPage } from './pages/PresetPage';
import { WifiPage } from './pages/WifiPage';

// Hash routing (#/lesson/<id>) keeps this a single static file that works
// from the Pico's web server, a local file, or any static host.
function useRoute(): string {
  const [hash, setHash] = useState(() => location.hash);
  useEffect(() => {
    const onChange = () => {
      setHash(location.hash);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash.replace(/^#/, '') || '/';
}

// The track to show open: the current lesson's, or on any other page the one the reader continues in.
function focusTrack(lesson: Lesson | undefined, done: Set<string>): TrackId | undefined {
  return (lesson ?? nextLesson(done))?.track;
}

function Nav({ route, open, lesson }: { route: string; open: boolean; lesson: Lesson | undefined }) {
  const [done] = useProgress();
  // Tracks are collapsible. The reader can open and close any of them, and every navigation (a bookmark, a
  // link, the Continue link) opens the track of the page it lands on, so the current lesson is always visible.
  const [expanded, setExpanded] = useState<Set<TrackId>>(() => {
    const t = focusTrack(lesson, done);
    return new Set(t ? [t] : []);
  });
  useEffect(() => {
    const t = focusTrack(lesson, done);
    if (t) setExpanded((prev) => (prev.has(t) ? prev : new Set(prev).add(t)));
    // Only on navigation: marking a lesson done must not open the next track under the reader.
  }, [route]);
  const toggle = (t: TrackId) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(t)) next.add(t);
      return next;
    });
  const next = done.size > 0 ? nextLesson(done) : undefined;
  const link = (href: string, label: string, lesson?: Lesson) => (
    <a href={`#${href}`} class={route === href ? 'active' : ''} aria-current={route === href ? 'page' : undefined}>
      {label}
      {lesson?.optional && <span class="nav-tag">optional</span>}
      {lesson && done.has(lesson.id) && (
        <span class="nav-done" aria-label="done" title="Marked as done">
          ✓
        </span>
      )}
    </a>
  );
  return (
    <nav id="sidebar" class={open ? 'sidebar open' : 'sidebar'}>
      <a class="brand" href="#/">
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M1 12h3V4h4v8h3V4h4" />
        </svg>
        Test Bench
      </a>
      {link('/', 'Start here')}
      {next && (
        <a class="nav-continue" href={`#/lesson/${next.id}`}>
          <span class="nav-continue-label">Continue</span>
          {next.title}
        </a>
      )}
      {tracks.map(({ id, label }) => {
        const members = lessons.filter((l) => l.track === id);
        const count = members.filter((l) => done.has(l.id)).length;
        const isOpen = expanded.has(id);
        return (
          <div class="nav-track" key={id}>
            <button
              type="button"
              class={isOpen ? 'nav-group open' : 'nav-group'}
              aria-expanded={isOpen}
              aria-controls={`nav-${id}`}
              onClick={() => toggle(id)}
            >
              <span class="nav-chevron" aria-hidden="true" />
              {label}
              <span class="nav-count" title={`${count} of ${members.length} marked as done`}>
                {count}/{members.length}
              </span>
            </button>
            <div id={`nav-${id}`} class="nav-lessons" hidden={!isOpen}>
              {members.map((l) => link(`/lesson/${l.id}`, l.title, l))}
            </div>
          </div>
        );
      })}
      <div class="nav-group nav-heading">Settings</div>
      {link('/wifi', 'Wi-Fi')}
      {link('/preset', 'Signal preset')}
    </nav>
  );
}

// Narrow screens only: the sidebar becomes a drawer behind a hamburger
// button. On wide screens the button and backdrop are hidden by CSS.
function useDrawer(route: string) {
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [route]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    document.body.classList.add('drawer-open');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('drawer-open');
    };
  }, [open]);
  return [open, setOpen] as const;
}

// On the test bench's own hotspot (mode "setup") the visitor has just joined
// it, usually from a phone's sign-in prompt, so open the Wi-Fi page instead of
// the home page. Only once per tab, and only when no page was asked for, so
// "Start here" stays reachable.
const kWifiRedirectKey = 'ltb-wifi-redirected';

function useHotspotRedirect() {
  useEffect(() => {
    const atHome = () => location.hash === '' || location.hash === '#/';
    let done = false;
    try {
      done = sessionStorage.getItem(kWifiRedirectKey) === '1';
    } catch {
      // Storage blocked: redirect anyway, at worst once per load.
    }
    if (done || !atHome()) return;
    getStatus().then((status) => {
      if (status?.mode !== 'setup' || !atHome()) return;
      try {
        sessionStorage.setItem(kWifiRedirectKey, '1');
      } catch {
        // See above.
      }
      location.replace('#/wifi');
    });
  }, []);
}

export function App() {
  const route = useRoute();
  useHotspotRedirect();
  const [drawerOpen, setDrawerOpen] = useDrawer(route);
  const match = route.match(/^\/lesson\/(.+)$/);
  const lesson = match ? lessonById(match[1]) : undefined;
  return (
    <div class="layout">
      <header class="topbar">
        <button
          type="button"
          class={drawerOpen ? 'hamburger open' : 'hamburger'}
          aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={drawerOpen}
          aria-controls="sidebar"
          onClick={() => setDrawerOpen(!drawerOpen)}
        >
          <span />
          <span />
          <span />
        </button>
        <a class="brand" href="#/">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M1 12h3V4h4v8h3V4h4" />
          </svg>
          Test Bench
        </a>
      </header>
      <div class={drawerOpen ? 'backdrop open' : 'backdrop'} onClick={() => setDrawerOpen(false)} />
      <Nav route={route} open={drawerOpen} lesson={lesson} />
      <main>
        {lesson ? (
          <LessonPage lesson={lesson} />
        ) : route === '/wifi' ? (
          <WifiPage />
        ) : route === '/preset' ? (
          <PresetPage />
        ) : (
          <HomePage />
        )}
      </main>
    </div>
  );
}
