export type Theme = 'modern' | 'retro';

const THEME_KEY = 'skuf-theme';

export function readTheme(): Theme {
  return localStorage.getItem(THEME_KEY) === 'retro' ? 'retro' : 'modern';
}

export function writeTheme(theme: Theme): void {
  localStorage.setItem(THEME_KEY, theme);
  document.documentElement.dataset.theme = theme;
}
