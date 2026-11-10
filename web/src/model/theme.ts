// Light or dark. Until the reader picks one, the guide follows the OS preference, also when it changes; a pick
// is stored and wins from then on. index.html applies the same rule in a script before the first paint, so a
// dark page never flashes light: keep the key and the rule there in step with this file.

export type Theme = 'light' | 'dark';

const kKey = 'ltb-theme';

/** The theme the reader picked, or null to follow the OS. Storage can be unavailable, which reads as no pick. */
export function loadTheme(): Theme | null {
  try {
    const t = window.localStorage.getItem(kKey);
    return t === 'light' || t === 'dark' ? t : null;
  } catch {
    return null;
  }
}

/** Stores a pick. Saving can fail, which only means the OS preference applies again next visit. */
export function saveTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(kKey, theme);
  } catch {
    // Not persisting is fine.
  }
}

export const darkQuery = '(prefers-color-scheme: dark)';

export function systemTheme(): Theme {
  return window.matchMedia?.(darkQuery).matches ? 'dark' : 'light';
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}
