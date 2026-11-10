import { useEffect, useState } from 'preact/hooks';
import { applyTheme, darkQuery, loadTheme, saveTheme, systemTheme, type Theme } from '../model/theme';

// Tells every mounted toggle (sidebar and top bar) that the theme changed.
const kEvent = 'ltb-theme';

function currentTheme(): Theme {
  return loadTheme() ?? systemTheme();
}

/** A button that switches between light and dark, and stores the choice. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(currentTheme);
  useEffect(() => {
    const sync = () => {
      const t = currentTheme();
      applyTheme(t);
      setTheme(t);
    };
    // Follows the OS while the reader has not picked a theme.
    const media = window.matchMedia?.(darkQuery);
    media?.addEventListener('change', sync);
    window.addEventListener(kEvent, sync);
    window.addEventListener('storage', sync);
    return () => {
      media?.removeEventListener('change', sync);
      window.removeEventListener(kEvent, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  const other: Theme = theme === 'dark' ? 'light' : 'dark';
  const label = `Switch to ${other} mode`;
  return (
    <button
      type="button"
      class="theme-toggle"
      aria-label={label}
      title={label}
      onClick={() => {
        saveTheme(other);
        applyTheme(other);
        window.dispatchEvent(new Event(kEvent));
      }}
    >
      {theme === 'dark' ? (
        // Sun: what the button switches to.
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        // Moon.
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
        </svg>
      )}
    </button>
  );
}
