/** Light/dark theme support: persisted in localStorage, defaults to the system preference. */

export type Theme = 'light' | 'dark';

const THEME_KEY = 'buyvsrent.theme';

/** Read the stored/system theme and apply it immediately (no flash on load). */
export function initialTheme(): Theme {
  let theme: Theme = 'light';
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') theme = saved;
    else if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) theme = 'dark';
  } catch {
    // storage unavailable — stay light
  }
  document.documentElement.dataset.theme = theme;
  return theme;
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // ignore — best effort
  }
}

 /** Colors for the Plotly charts, read from the active theme's CSS variables. */
export function chartColors(): { font: string; grid: string; line: string } {
  const cs = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    font: read('--text', '#1d2733'),
    grid: read('--row-border', '#e3e9ef'),
    line: read('--border', '#dbe2e8'),
  };
}
