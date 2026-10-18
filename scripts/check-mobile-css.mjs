import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../apps/web/src/styles/global.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../apps/web/index.html', import.meta.url), 'utf8');
const start = css.indexOf('@media (max-width: 520px)');
const end = css.indexOf('[data-theme="retro"]', start);
const mobile = css.slice(start, end);

const requiredRules = [
  '.topbar nav {',
  'font-size: 12px',
  'min-height: 46px',
  '.note-card, .ticker { display: none; }',
  '.term-card { height: auto; min-height: 390px;',
  '.term-card > p { font-size: 17px;',
  '.term-card blockquote { font-size: 15px;',
  '.alphabet__letters button { min-height: 44px;',
  '.quiz-page { overflow: hidden;',
  '.quiz-options { grid-template-columns: 1fr;',
  '.quiz-page > h1 { font-size: clamp(42px, 12vw, 56px);',
  '.quiz-result { gap: 30px;',
  '.quiz-result-card { order: 1; width: 100%;',
  '.quiz-action { min-height: 52px;',
  '.quiz-result-panel { order: 2;',
  '.quiz-finish > h1 { font-size: clamp(34px, 9.5vw, 44px);',
];

const requiredRetroRules = [
  'width: min(1180px, calc(100% - 36px))',
  'gap: clamp(28px, 4vw, 56px)',
  'padding-inline: clamp(32px, 6vw, 82px)',
  '[data-theme="retro"] .hero__content { min-width: 0; }',
  '[data-theme="retro"] .hero h1 br + em { white-space: normal; }',
  '[data-theme="retro"] .search { width: 100%; }',
  '[data-theme="retro"] .home-choices > a { min-width: 0; padding-inline: clamp(32px, 6vw, 72px); }',
  '[data-theme="retro"] .quiz-home-cta, [data-theme="retro"] .suggest { align-items: flex-start; flex-direction: column;',
  '[data-theme="retro"] .quiz-home-cta > div, [data-theme="retro"] .suggest > div { min-width: 0; width: 100%; }',
  '[data-theme="retro"] .site-shell { width: 100%; margin: 0; border-inline: 0; }',
];

if (!html.includes('<meta name="viewport" content="width=device-width, initial-scale=1"')) {
  throw new Error('Mobile page is missing a responsive viewport meta tag');
}

if (!css.includes('body { margin: 0; min-width: 320px; overflow-x: hidden;')) {
  throw new Error('The page must prevent horizontal viewport overflow');
}

for (const rule of requiredRules) {
  if (!mobile.includes(rule)) throw new Error(`Mobile stylesheet is missing: ${rule}`);
}

for (const rule of requiredRetroRules) {
  if (!css.includes(rule)) throw new Error(`Retro responsive stylesheet is missing: ${rule}`);
}

console.log('Mobile readability checks passed.');

