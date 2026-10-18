import { readFileSync, writeFileSync } from 'node:fs';

const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID ?? '';
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(databaseId)) {
  throw new Error('CLOUDFLARE_D1_DATABASE_ID must be a D1 UUID');
}
const configUrl = new URL('../apps/worker/wrangler.jsonc', import.meta.url);
const config = readFileSync(configUrl, 'utf8');
if (!config.includes('__D1_DATABASE_ID__')) throw new Error('Wrangler D1 placeholder is missing');
writeFileSync(configUrl, config.replace('__D1_DATABASE_ID__', databaseId));
console.log('Prepared Wrangler configuration for the production D1 binding.');
