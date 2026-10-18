import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../apps/web/src/styles/global.css', import.meta.url), 'utf8');
const start = css.indexOf('@media (max-width: 520px)');
const end = css.indexOf('[data-theme="retro"]', start);
const mobile = css.slice(start, end);

const requiredRules = [
  '.topbar nav {',
  'font-size: 14px',
  'min-height: 46px',
  '.note-card { display: none; }',
  '.term-card { height: auto; min-height: 390px;',
  '.term-card > p { font-size: 17px;',
  '.term-card blockquote { font-size: 15px;',
  '.alphabet__letters button { min-height: 44px;',
  '.quiz-page { overflow: hidden;',
  '.quiz-options { grid-template-columns: 1fr;',
  '.quiz-result { gap: 38px;',
  '.quiz-result-card { width: 100%;',
];

for (const rule of requiredRules) {
  if (!mobile.includes(rule)) throw new Error(`Mobile stylesheet is missing: ${rule}`);
}

console.log('Mobile readability checks passed.');
