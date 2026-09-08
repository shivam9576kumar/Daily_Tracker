// Part F frontend gate: contract greps + tokens-only warning + production build.  Usage (from frontend/): node scripts/checkPartF.mjs
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';

let fail = 0, warn = 0;
const ck = (n, c) => { console.log(`[${c ? 'PASS' : 'FAIL'}] ${n}`); if (!c) fail++; };
const wn = (n, c) => { if (!c) { warn++; console.log(`[WARN] ${n}`); } };
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
const todoDir = 'src/components/todo';
const todoSrc = readdirSync(todoDir).filter((f) => f.endsWith('.tsx')).map((f) => read(`${todoDir}/${f}`)).join('\n') + read('src/pages/TodoPage.tsx');
const types = read('src/types/index.ts');
const api = read('src/services/dailyChallengesApi.ts');
const dash = read('src/pages/Dashboard.tsx');
const css = read(`${todoDir}/todo.css`);

ck("TaskType has 'cp31'", /TaskType\s*=[^;]*'cp31'/.test(types));
ck("TaskStatus has 'skipped'", /TaskStatus\s*=[^;]*'skipped'/.test(types));
ck('settings change report has cp31PendingParked', types.includes('cp31PendingParked'));
for (const p of ['/daily-challenges/settings', '/daily-challenges/cp31/one-more', '/daily-challenges/cp31/skip/',
  '/daily-challenges/cp31/retry/', '/daily-challenges/cp31/skipped', '/daily-challenges/cp31/advance-band', '/daily-challenges/cp31/streak']) {
  ck(`api has ${p}`, api.includes(p));
}
ck('Today renders today.cp31 group', /today\.cp31/.test(todoSrc));
ck('POTD + CP31 switches (role="switch" ×2+)', (todoSrc.match(/role="switch"/g) ?? []).length >= 2);
ck('daily-count stepper wired (cp31DailyCount)', /cp31DailyCount/.test(todoSrc));
ck('band picker uses availableBands', /availableBands/.test(todoSrc));
ck('"One more" button copy', /one more/i.test(todoSrc));
ck('cap note "Great session"', todoSrc.includes('Great session'));
ck('resume dialog copy', todoSrc.includes('Resume from') && /different band/i.test(todoSrc));
ck('Skipped collapsible + Retry', /Skipped/.test(todoSrc) && /Retry/i.test(todoSrc));
ck('band-complete ceremony ("Not now")', /Not now/.test(todoSrc));
ck('Dashboard cp31 chip gated on enabled', dash.includes('cp31Streak') && /cp31Streak\?\.enabled|dailyChallenges\?\.cp31\.enabled/.test(dash));
ck('no legacy dashboard TaskRow import in todo', !todoSrc.includes('components/dashboard/TaskRow'));
wn('todo.css contains raw hex colors (tokens only expected)', !/#[0-9a-fA-F]{3,8}\b/.test(css));

try { execSync('npm run build', { stdio: 'pipe' }); ck('frontend production build', true); }
catch { ck('frontend production build', false); }

console.log(fail === 0 ? `\n✅ PART F FRONTEND CHECKS PASSED (${warn} warning(s))` : `\n❌ ${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
