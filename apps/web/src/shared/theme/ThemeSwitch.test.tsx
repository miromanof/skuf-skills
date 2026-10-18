import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ThemeSwitch } from './ThemeSwitch.js';

describe('ThemeSwitch', () => {
  afterEach(cleanup);

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('starts in modern mode and exposes an accessible switch', () => {
    render(<ThemeSwitch />);
    expect(screen.getByRole('switch', { name: /скуфский режим/i })).toHaveAttribute('aria-checked', 'false');
    expect(document.documentElement).toHaveAttribute('data-theme', 'modern');
  });

  it('persists and restores retro mode', () => {
    const { unmount } = render(<ThemeSwitch />);
    fireEvent.click(screen.getByRole('switch', { name: /скуфский режим/i }));
    expect(localStorage.getItem('skuf-theme')).toBe('retro');
    expect(document.documentElement).toHaveAttribute('data-theme', 'retro');
    unmount();
    render(<ThemeSwitch />);
    expect(screen.getByRole('switch', { name: /скуфский режим/i })).toHaveAttribute('aria-checked', 'true');
  });
});
