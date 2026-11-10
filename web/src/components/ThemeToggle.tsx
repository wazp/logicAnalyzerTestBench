import { useEffect, useState } from 'preact/hooks';
import { applyTheme, darkQuery, loadTheme, saveTheme, systemTheme, type Theme } from '../model/theme';

function currentTheme(): Theme {
  return loadTheme() ?? systemTheme();
}

/** Light and dark, side by side with a switch between them; stores the choice. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(currentTheme);
  useEffect(() => {
    const sync = () => {
      const t = currentTheme();
      applyTheme(t);
      setTheme(t);
    };
    // Follows the OS while the reader has not picked a theme, and a pick made in another tab.
    const media = window.matchMedia?.(darkQuery);
    media?.addEventListener('change', sync);
    window.addEventListener('storage', sync);
    return () => {
      media?.removeEventListener('change', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  const pick = (t: Theme) => {
    saveTheme(t);
    applyTheme(t);
    setTheme(t);
  };
  const dark = theme === 'dark';
  // Both choices are always visible, with a switch between them whose knob sits on the active side. The icons
  // pick their own theme; the switch flips.
  return (
    <div class="theme-toggle">
      <span class="theme-toggle-label">Theme</span>
      <button
        type="button"
        class={dark ? 'theme-icon' : 'theme-icon active'}
        aria-label="Light mode"
        title="Light mode"
        aria-pressed={!dark}
        onClick={() => pick('light')}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      </button>
      <button
        type="button"
        role="switch"
        class="theme-switch"
        aria-checked={dark}
        aria-label="Dark mode"
        onClick={() => pick(dark ? 'light' : 'dark')}
      >
        <span class="theme-knob" />
      </button>
      <button
        type="button"
        class={dark ? 'theme-icon active' : 'theme-icon'}
        aria-label="Dark mode"
        title="Dark mode"
        aria-pressed={dark}
        onClick={() => pick('dark')}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
        </svg>
      </button>
    </div>
  );
}
