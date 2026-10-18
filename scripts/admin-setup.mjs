import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import argon2 from 'argon2';

const managedKeys = new Set(['ADMIN_LOGIN', 'ADMIN_PASSWORD_HASH', 'PUBLIC_CURSOR_SECRET']);

function safeValue(value) {
  if (!value || /[\r\n\0]/u.test(value)) throw new Error('Некорректное значение конфигурации');
  return value;
}

export function renderAdminEnvironment(existing, values) {
  const retained = existing.split(/\r?\n/u).filter((line) => {
    const key = line.match(/^([A-Z][A-Z0-9_]*)=/u)?.[1];
    return !key || !managedKeys.has(key);
  });
  while (retained.at(-1) === '') retained.pop();
  return [...retained,
    `ADMIN_LOGIN=${safeValue(values.login)}`,
    `ADMIN_PASSWORD_HASH=${safeValue(values.passwordHash)}`,
    `PUBLIC_CURSOR_SECRET=${safeValue(values.cursorSecret)}`,
    '',
  ].join('\n');
}

async function readHidden(prompt) {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) throw new Error('Для безопасного ввода нужен интерактивный терминал');
  process.stdout.write(prompt);
  process.stdin.setEncoding('utf8');
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return await new Promise((resolvePassword, reject) => {
    let password = '';
    const finish = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
    };
    const onData = (character) => {
      if (character === '\u0003') {
        process.stdin.off('data', onData); finish(); reject(new Error('Настройка отменена')); return;
      }
      if (character === '\r' || character === '\n') {
        process.stdin.off('data', onData); finish(); resolvePassword(password); return;
      }
      if (character === '\u007f' || character === '\b') { password = password.slice(0, -1); return; }
      password += character;
    };
    process.stdin.on('data', onData);
  });
}

async function main() {
  const loginFlag = process.argv.indexOf('--login');
  const login = loginFlag >= 0 ? process.argv[loginFlag + 1] : undefined;
  if (!login) throw new Error('Укажите логин: npm run admin:setup -- --login адрес@example.com');
  const password = await readHidden('Пароль администратора (ввод скрыт): ');
  if (password.length < 12) throw new Error('Пароль должен содержать не менее 12 символов');
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id, memoryCost: 65_536, timeCost: 3, parallelism: 1 });
  const envPath = resolve('.env');
  const existing = existsSync(envPath) ? readFileSync(envPath, 'utf8') : 'HOST=127.0.0.1\nPORT=3001\nLOCAL_DATABASE_PATH=.data/skuf-skills-db\n';
  writeFileSync(envPath, renderAdminEnvironment(existing, { login, passwordHash, cursorSecret: randomBytes(32).toString('base64url') }), { encoding: 'utf8', mode: 0o600 });
  process.stdout.write('Локальный администратор настроен. Перезапустите API.\n');
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : 'Ошибка настройки'}\n`); process.exitCode = 1; });
