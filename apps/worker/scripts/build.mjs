import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cacheDirectory = fileURLToPath(new URL('../../../.data/wrangler-config/', import.meta.url));
mkdirSync(cacheDirectory, { recursive: true });
const wrangler = fileURLToPath(new URL('../../../node_modules/wrangler/bin/wrangler.js', import.meta.url));
const result = spawnSync(process.execPath, [wrangler, 'deploy', '--dry-run', '--outdir', 'dist'], {
  cwd: fileURLToPath(new URL('../', import.meta.url)),
  env: { ...process.env, XDG_CONFIG_HOME: cacheDirectory, WRANGLER_LOG_PATH: fileURLToPath(new URL('../../../.data/wrangler-build.log', import.meta.url)) },
  stdio: 'inherit',
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
