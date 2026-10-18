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

if (!html.includes('<meta name="viewport" content="width=device-width, initial-scale=1"')) {
  throw new Error('Mobile page is missing a responsive viewport meta tag');
}

if (!css.includes('body { margin: 0; min-width: 320px; overflow-x: hidden;')) {
  throw new Error('The page must prevent horizontal viewport overflow');
}

for (const rule of requiredRules) {
  if (!mobile.includes(rule)) throw new Error(`Mobile stylesheet is missing: ${rule}`);
}

console.log('Mobile readability checks passed.');
