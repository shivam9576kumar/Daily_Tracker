// Static checks + production build gate for Part B frontend.  Usage (from frontend/): node scripts/checkPartB.mjs
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

let fail = 0;
const ck = (n, c) => { console.log(`[${c ? 'PASS' : 'FAIL'}] ${n}`); if (!c) fail++; };
const read = (p) => readFileSync(p, 'utf8');

const types = read('src/types/index.ts');
const dash = read('src/pages/Dashboard.tsx');
const todoPage = read('src/pages/TodoPage.tsx');
const menu = read('src/components/todo/DailyChallengesMenu.tsx');
const store = read('src/store/dailyChallengesStore.ts');
const api = read('src/services/dailyChallengesApi.ts');
const css = read('src/components/todo/todo.css');

ck("TaskType includes 'cp31'", /TaskType\s*=[^;]*'cp31'/.test(types));
ck('DailyChallengeSettings type present', types.includes('interface DailyChallengeSettings'));
ck('PotdStreak.enabled present', /interface PotdStreak[\s\S]*?enabled\?: boolean/.test(types));
ck('api hits /daily-challenges/settings', api.includes("'/daily-challenges/settings'"));
ck('store refreshes todo + dashboard after toggle', store.includes('useTodoStore.getState().fetch(true)') && store.includes('useDashboardStore.getState().fetch(true)'));
ck('menu uses role=switch', menu.includes('role="switch"'));
ck('TodoPage mounts DailyChallengesMenu', todoPage.includes('<DailyChallengesMenu />'));
ck('Dashboard gates POTD chip on enabled', dash.includes('dailyChallenges?.potd.enabled'));
ck('css has dc-switch + dc-menu__panel', css.includes('.dc-switch') && css.includes('.dc-menu__panel'));

try { execSync('npm run build', { stdio: 'pipe' }); ck('frontend production build', true); }
catch { ck('frontend production build', false); }

console.log(fail === 0 ? '\n✅ PART B FRONTEND CHECKS PASSED' : `\n❌ ${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
