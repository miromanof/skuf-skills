import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export function localEnvironmentCandidates(cwd: string): string[] {
  const candidates: string[] = [];
  let directory = resolve(cwd);
  for (let depth = 0; depth < 4; depth += 1) {
    candidates.push(resolve(directory, '.env'));
    const parent = dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  return candidates;
}

export function loadLocalEnvironment(cwd = process.cwd()): void {
  if (process.env.NODE_ENV === 'production') return;
  const envPath = localEnvironmentCandidates(cwd).find(existsSync);
  if (envPath) process.loadEnvFile(envPath);
}
