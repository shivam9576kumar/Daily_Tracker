import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createBusyTracker } from '../src/utils/busyTracker';
import { createSerialQueue } from '../src/utils/serialQueue';
import { createLatestGate } from '../src/utils/latestGate';

const FRONTEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(FRONTEND, 'src');
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// ── A. Design-token audit (covers PlaceholderPage, rating-pill, and any token in unseen files) ──
test('A. every CSS custom property used without a fallback is declared', () => {
  const declared = new Set<string>();
  const usages: { name: string; file: string }[] = [];

  for (const f of walk(SRC)) {
    if (!/\.(css|tsx?)$/.test(f)) continue;
    const rel = path.relative(FRONTEND, f);
    const text = fs.readFileSync(f, 'utf8');

    if (f.endsWith('.css')) {
      for (const m of text.matchAll(/(--[A-Za-z0-9-]+)\s*:/g)) declared.add(m[1]);
    }
    // Custom properties set from inline style objects, e.g. { '--foo': value }
    for (const m of text.matchAll(/['"](--[A-Za-z0-9-]+)['"]\s*:/g)) declared.add(m[1]);

    // var(--name) with NO fallback (a fallback is "var(--name, …)")
    for (const m of text.matchAll(/var\((--[A-Za-z0-9-]+)\s*([,)])/g)) {
      if (m[2] === ')') usages.push({ name: m[1], file: rel });
    }
  }

  const missing = usages.filter((u) => !declared.has(u.name));
  assert.deepEqual(
    missing,
    [],
    'undefined tokens:\n' + missing.map((m) => `  ${m.file}: ${m.name}`).join('\n'),
  );
});

// ── B. Rating-pill hover uses a defined brand border token ──
test('B. rating pill hover uses a defined brand border token', () => {
  const css = read('index.css');
  assert.match(css, /\.rating-pill:hover\s*\{[^}]*--brand-soft-border/);
  assert.doesNotMatch(css, /--brand-border/);
});

// ── C. POTD and CP31 each rendered exactly once, by DailyChallengesSection ──
test('C. TodoPage hands POTD and CP31 to DailyChallengesSection and renders neither itself', () => {
  const src = read('pages/TodoPage.tsx');
  assert.match(src, /potd=\{t\.potd\}/);
  assert.match(src, /cp31=\{t\.cp31\}/);
  assert.doesNotMatch(src, /title="Daily Challenge"/);
  assert.doesNotMatch(src, /renderTasks\(t\.potd\)/);
  assert.doesNotMatch(src, /renderTasks\(t\.cp31\)/);
});

// ── D. SetDate only for personal tasks (UI and handler) ──
test('D. SetDate is offered only for personal tasks, in both the row and the handler', () => {
  const src = read('pages/TodoPage.tsx');
  assert.match(src, /taskType\s*===\s*'personal'\s*\?\s*handleSetDate\s*:\s*undefined/);
  assert.match(src, /dateTarget\.taskType\s*!==\s*'personal'/);
});

// ── E. Busy tracker: per-id, double-submit guard, no cross-clearing ──
test('E. busy tracker is per-id and rejects a second start for the same id', () => {
  const t = createBusyTracker();
  assert.equal(t.start('a'), true);
  assert.equal(t.start('a'), false);
  assert.equal(t.start('b'), true);
  t.end('a');
  assert.equal(t.has('a'), false);
  assert.equal(t.has('b'), true);
});

test('E2. busy tracker emits a snapshot on every real change only', () => {
  const seen: number[] = [];
  const t = createBusyTracker((ids) => seen.push(ids.size));
  t.start('a');
  t.start('a');   // rejected: no emit
  t.start('b');
  t.end('a');
  t.end('a');     // not present: no emit
  assert.deepEqual(seen, [1, 2, 1]);
});

// ── F. Serial queue: strict order, no overlap, failure does not block successors ──
test('F. serial queue runs in order with no overlap and survives a failure', async () => {
  const q = createSerialQueue();
  const log: string[] = [];
  let active = 0;
  let maxActive = 0;

  const work = (name: string, ms: number, fail = false) => async () => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((r) => setTimeout(r, ms));
    log.push(name);
    active -= 1;
    if (fail) throw new Error(name);
    return name;
  };

  const p1 = q.run(work('first', 30, true)).catch(() => 'caught');
  const p2 = q.run(work('second', 5));
  const p3 = q.run(work('third', 1));

  assert.equal(await p1, 'caught');
  assert.equal(await p2, 'second');
  await p3;
  await new Promise((r) => setTimeout(r, 0)); // let the depth bookkeeping settle

  assert.deepEqual(log, ['first', 'second', 'third']);
  assert.equal(maxActive, 1);
  assert.equal(q.depth, 0);
});

// ── G. Latest gate ignores superseded responses ──
test('G. latest gate marks only the most recent request as current', () => {
  const g = createLatestGate();
  const first = g.begin();
  const second = g.begin();
  assert.equal(g.isLatest(first), false);
  assert.equal(g.isLatest(second), true);
});

// ── H. Daily-challenge mutations are queued, never dropped ──
test('H. dailyChallengesStore queues mutations instead of discarding them', () => {
  const src = read('store/dailyChallengesStore.ts');
  assert.doesNotMatch(src, /saving\)\s*return/);
  assert.match(src, /createSerialQueue\(\)/);
});

// ── I. Store dependency is one-way; ladder actions live in dailyChallengesStore ──
test('I. todoStore has no CP31 actions and no import of dailyChallengesStore (no cycle)', () => {
  const todo = read('store/todoStore.ts');
  assert.doesNotMatch(todo, /cp31/i);
  assert.doesNotMatch(todo, /dailyChallengesStore/);

  const daily = read('store/dailyChallengesStore.ts');
  assert.match(daily, /import \{ useTodoStore \} from '\.\/todoStore'/);
  for (const action of ['cp31OneMore', 'cp31Skip', 'cp31Retry', 'cp31AdvanceBand']) {
    assert.match(daily, new RegExp(`\\b${action}\\b`));
  }
});

// ── J. Any file that calls ladder actions imports the daily-challenges store ──
test('J. ladder actions are only called through the daily-challenges store', () => {
  for (const f of walk(SRC).filter((x) => /\.(ts|tsx)$/.test(x))) {
    const text = fs.readFileSync(f, 'utf8');
    if (!/\b(cp31OneMore|cp31Skip|cp31Retry|cp31AdvanceBand)\b/.test(text)) continue;
    if (f.endsWith('dailyChallengesStore.ts')) continue;
    assert.match(
      text,
      /useDailyChallengesStore|dailyChallengesStore/,
      `${path.relative(FRONTEND, f)} calls a ladder action without the daily-challenges store`,
    );
  }
});

// ── K. planStore spinner rule: loading is never set unconditionally in fetchActive ──
test('K. planStore sets loading only on first load, never on background refresh', () => {
  const src = read('store/planStore.ts');
  const start = src.indexOf('fetchActive: async');
  const end = src.indexOf('fetchArchived: async');
  assert.ok(start >= 0 && end > start, 'fetchActive/fetchArchived implementations not found');
  const body = src.slice(start, end);
  const unconditional = body
    .split('\n')
    .filter((line) => /loading:\s*true/.test(line) && !/if\s*\(/.test(line));
  assert.deepEqual(unconditional, []);
});

// ── L. useTaskActions has no stale-closure global guard, and uses the tracker ──
test('L. useTaskActions uses per-id tracker and has no global busyId guard', () => {
  const src = read('hooks/useTaskActions.ts');
  assert.doesNotMatch(src, /if \(busyId\)/);
  assert.match(src, /tracker\.start\(id\)/);
});

// ── M. TodoPage reads per-row busy through isBusy only ──
test('M. TodoPage reads busy state only through isBusy', () => {
  const src = read('pages/TodoPage.tsx');
  assert.doesNotMatch(src, /actions\.busyId/);
  assert.match(src, /actions\.isBusy\(/);
});

// ── N. Settings placeholder is a component, uses only defined tokens ──
test('N. PlaceholderPage is a shared component with no undefined token names', () => {
  const routes = read('routes/AppRoutes.tsx');
  assert.doesNotMatch(routes, /function PlaceholderPage/);
  assert.match(routes, /from '\.\.\/components\/common\/PlaceholderPage'/);

  const comp = path.join(SRC, 'components/common/PlaceholderPage.tsx');
  assert.ok(fs.existsSync(comp), 'PlaceholderPage.tsx does not exist');
  assert.doesNotMatch(
    fs.readFileSync(comp, 'utf8'),
    /var\(--(font-size|font-weight|color-|radius-full|gradient-)/,
  );
});
