import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const failures = [];
const requireText = (text, pattern, label) => { if (!pattern.test(text)) failures.push(label); };

let worker = '';
let pages = '';
let wrangler = '';
let docs = '';
try { worker = read('.github/workflows/worker.yml'); } catch { failures.push('missing Worker workflow'); }
try { pages = read('.github/workflows/pages.yml'); } catch { failures.push('missing Pages workflow'); }
try { wrangler = read('apps/worker/wrangler.jsonc'); } catch { failures.push('missing Wrangler configuration'); }
try { docs = read('docs/cloudflare-deployment.md'); } catch { failures.push('missing deployment guide'); }

for (const secret of ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_D1_DATABASE_ID']) {
  requireText(worker, new RegExp(secret, 'u'), `Worker workflow must reference ${secret}`);
}
requireText(worker, /d1 migrations apply[\s\S]*--remote/u, 'Worker workflow must apply remote D1 migrations');
requireText(worker, /wrangler deploy/u, 'Worker workflow must deploy Wrangler');
requireText(worker, /api\.skufskills\.ru\/health/u, 'Worker workflow must probe production health');
requireText(pages, /uses:\s*\.\/\.github\/workflows\/worker\.yml/u, 'Pages workflow must call the Worker workflow');
requireText(pages, /needs:\s*worker/u, 'Pages build must wait for Worker deployment');
requireText(pages, /VITE_API_BASE_URL:\s*https:\/\/api\.skufskills\.ru/u, 'Pages build must use the production API origin');
requireText(wrangler, /"binding"\s*:\s*"DB"/u, 'Wrangler must bind D1 as DB');
requireText(wrangler, /"migrations_dir"\s*:\s*"migrations"/u, 'Wrangler must use the Worker migrations directory');
requireText(wrangler, /"ALLOWED_ORIGINS"\s*:\s*"https:\/\/skufskills\.ru,https:\/\/www\.skufskills\.ru,https:\/\/miromanof\.github\.io"/u, 'Wrangler must allow the production and preview web origins');
requireText(docs, /185\.199\.108\.153[\s\S]*185\.199\.109\.153[\s\S]*185\.199\.110\.153[\s\S]*185\.199\.111\.153/u, 'Guide must preserve all GitHub Pages A records');
requireText(docs, /www[\s\S]*miromanof\.github\.io/u, 'Guide must preserve the www CNAME');
requireText(docs, /wrangler d1 export/u, 'Guide must document D1 backup');

if (failures.length) {
  console.error(`Cloud deployment is incomplete:\n- ${failures.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log('Cloud deployment configuration is complete.');
}
