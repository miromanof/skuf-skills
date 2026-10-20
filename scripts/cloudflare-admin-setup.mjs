import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

function safe(value) {
  if (!value || /[\r\n\0]/u.test(value)) throw new Error('Некорректное значение конфигурации');
  return value;
}

function base64url(bytes) { return Buffer.from(bytes).toString('base64url'); }

export function cleanHiddenInput(value) {
  return value.replaceAll('\u001b[200~', '').replaceAll('\u001b[201~', '');
}

export async function createCloudflareSecretPayload(input, _saltBytes = randomBytes(16), cursorBytes = randomBytes(32)) {
  const login = safe(input.login);
  const password = safe(input.password);
  if (Array.from(password).length < 12) throw new Error('Пароль должен содержать не менее 12 символов');
  return {
    ADMIN_PASSWORD: password,
    CURSOR_SECRET: base64url(new Uint8Array(cursorBytes)),
  };
}

async function readHidden(prompt) {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) throw new Error('Для безопасного ввода нужен интерактивный терминал');
  process.stdout.write(prompt); process.stdin.setEncoding('utf8'); process.stdin.setRawMode(true); process.stdin.resume();
  return await new Promise((resolvePassword, reject) => {
    let password = '';
    const finish = () => { process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\n'); };
    const onData = (character) => {
      if (character === '\u0003') { process.stdin.off('data', onData); finish(); reject(new Error('Настройка отменена')); return; }
      if (character === '\r' || character === '\n') { process.stdin.off('data', onData); finish(); resolvePassword(cleanHiddenInput(password)); return; }
      if (character === '\u007f' || character === '\b') { password = password.slice(0, -1); return; }
      password += character;
    };
    process.stdin.on('data', onData);
  });
}

async function uploadSecrets(payload) {
  const { executable, args } = cloudflareSecretCommand(process.platform, process.env.ComSpec);
  const child = spawn(executable, args, { stdio: ['pipe', 'inherit', 'inherit'] });
  child.stdin.end(JSON.stringify(payload));
  const code = await new Promise((resolveCode) => child.once('close', resolveCode));
  if (code !== 0) throw new Error('Не удалось сохранить секреты Cloudflare');
}

export async function verifyProductionLogin(login, password, request = fetch) {
  const response = await request('https://api.skufskills.ru/api/admin/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://skufskills.ru' },
    body: JSON.stringify({ login, password }),
  });
  return response.status;
}

export function cloudflareSecretCommand(platform, commandShell) {
  const wranglerArgs = ['wrangler', 'secret', 'bulk', '--config', 'apps/worker/wrangler.jsonc'];
  if (platform !== 'win32') return { executable: 'npx', args: wranglerArgs };
  return { executable: commandShell || 'cmd.exe', args: ['/d', '/s', '/c', 'npx.cmd', ...wranglerArgs] };
}

async function main() {
  const loginFlag = process.argv.indexOf('--login');
  const login = loginFlag >= 0 ? process.argv[loginFlag + 1] : undefined;
  if (!login) throw new Error('Укажите логин: npm run cloudflare:admin-setup -- --login адрес@example.com');
  const password = await readHidden('Пароль администратора (ввод скрыт): ');
  await uploadSecrets(await createCloudflareSecretPayload({ login, password }));
  const status = await verifyProductionLogin(login, password);
  if (status !== 200) throw new Error(`Секреты загружены, но контрольный вход вернул HTTP ${status}`);
  process.stdout.write('Секреты администратора сохранены в Cloudflare. Контрольный вход успешен.\n');
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : 'Ошибка настройки'}\n`); process.exitCode = 1; });

