import { useEffect, useState } from 'preact/hooks';
import { lessonById, lessons } from './lessons';
import { HomePage } from './pages/HomePage';
import { LessonPage } from './pages/LessonPage';
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

function Nav({ route }: { route: string }) {
  const link = (href: string, label: string) => (
    <a href={`#${href}`} class={route === href ? 'active' : ''} aria-current={route === href ? 'page' : undefined}>
      {label}
    </a>
  );
  return (
    <nav class="sidebar">
      <a class="brand" href="#/">
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M1 12h3V4h4v8h3V4h4" />
        </svg>
        Test Bench
      </a>
      {link('/', 'Start here')}
      <div class="nav-group">Learn</div>
      {lessons.filter((l) => l.track === 'learn').map((l) => link(`/lesson/${l.id}`, l.title))}
      <div class="nav-group">Protocols</div>
      {lessons.filter((l) => l.track === 'protocols').map((l) => link(`/lesson/${l.id}`, l.title))}
      <div class="nav-group">Verify</div>
      {lessons.filter((l) => l.track === 'verify').map((l) => link(`/lesson/${l.id}`, l.title))}
      <div class="nav-group">Settings</div>
      {link('/wifi', 'Wi-Fi')}
    </nav>
  );
}

export function App() {
  const route = useRoute();
  const match = route.match(/^\/lesson\/(.+)$/);
  const lesson = match ? lessonById(match[1]) : undefined;
  return (
    <div class="layout">
      <Nav route={route} />
      <main>{lesson ? <LessonPage lesson={lesson} /> : route === '/wifi' ? <WifiPage /> : <HomePage />}</main>
    </div>
  );
}
