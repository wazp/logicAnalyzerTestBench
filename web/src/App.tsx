import { useEffect, useState } from 'preact/hooks';
import { useProgress } from './components/useProgress';
import { lessonById, lessons, type Lesson } from './lessons';
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

function Nav({ route, open }: { route: string; open: boolean }) {
  const [done] = useProgress();
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
  const track = (t: Lesson['track']) =>
    lessons.filter((l) => l.track === t).map((l) => link(`/lesson/${l.id}`, l.title, l));
  return (
    <nav id="sidebar" class={open ? 'sidebar open' : 'sidebar'}>
      <a class="brand" href="#/">
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M1 12h3V4h4v8h3V4h4" />
        </svg>
        Test Bench
      </a>
      {link('/', 'Start here')}
      <div class="nav-group">Concepts</div>
      {track('concepts')}
      <div class="nav-group">Learn</div>
      {track('learn')}
      <div class="nav-group">Protocols</div>
      {track('protocols')}
      <div class="nav-group">Video and input</div>
      {track('video')}
      <div class="nav-group">Verify</div>
      {track('verify')}
      <div class="nav-group">Settings</div>
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
      <Nav route={route} open={drawerOpen} />
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
