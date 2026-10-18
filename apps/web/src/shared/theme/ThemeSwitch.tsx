import { useState } from 'react';
import { readTheme, writeTheme, type Theme } from './theme.js';

export function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = readTheme();
    document.documentElement.dataset.theme = savedTheme;
    return savedTheme;
  });

  const toggleTheme = () => {
    const nextTheme = theme === 'modern' ? 'retro' : 'modern';
    setTheme(nextTheme);
    writeTheme(nextTheme);
  };

  return (
    <button
      className="theme-switch"
      type="button"
      role="switch"
      aria-checked={theme === 'retro'}
      aria-label="Скуфский режим"
      onClick={toggleTheme}
    >
      <span className="theme-switch__year" aria-hidden="true">2026</span>
      <span className="theme-switch__track" aria-hidden="true">
        <span className="theme-switch__thumb" />
      </span>
      <span className="theme-switch__year" aria-hidden="true">1998</span>
    </button>
  );
}
