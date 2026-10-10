import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { env, assertProductionSecrets } from '../config/env';
import { isAiEnabled } from '../config/ai';
import { requireAiEnabled } from '../middleware/aiEnabledMiddleware';
import { TX_OPTIONS } from '../config/transaction';
import { checkDatabaseReady } from '../services/health/readiness';

const REPO = path.resolve(__dirname, '../../..');
const read = (rel: string) => fs.readFileSync(path.join(REPO, rel), 'utf8');
const readJson = (rel: string) => JSON.parse(read(rel));

test('A. render-build applies migrations and never runs db push', () => {
  const rb: string = readJson('package.json').scripts['render-build'];
  assert.ok(rb.includes('db:migrate:deploy'), rb);
  assert.ok(!rb.includes('db:push'), rb);
  assert.ok(!rb.includes('--accept-data-loss'), rb);
});

test('B. no destructive accept-data-loss flag in deploy configuration', () => {
  for (const f of ['package.json', 'backend/package.json', 'render.yaml']) {
    const p = path.join(REPO, f);
    if (!fs.existsSync(p)) continue;
    assert.ok(!fs.readFileSync(p, 'utf8').includes('--accept-data-loss'), `${f} still contains the flag`);
  }
});

test('C. backend exposes migrate deploy and a non-destructive db push', () => {
  const scripts = readJson('backend/package.json').scripts;
  assert.equal(scripts['db:migrate:deploy'], 'prisma migrate deploy');
  assert.ok(!String(scripts['db:push']).includes('accept-data-loss'));
});

test('D. production refuses weak JWT secret and missing DATABASE_URL', () => {
  const good = { ...env, isProd: true, DATABASE_URL: 'postgresql://x', JWT_SECRET: 'a'.repeat(40) };
  assert.doesNotThrow(() => assertProductionSecrets(good));
  assert.throws(() => assertProductionSecrets({ ...good, JWT_SECRET: 'dev-secret-change-me' }), /JWT_SECRET/);
  assert.throws(() => assertProductionSecrets({ ...good, JWT_SECRET: 'short' }), /JWT_SECRET/);
  assert.throws(() => assertProductionSecrets({ ...good, DATABASE_URL: '' }), /DATABASE_URL/);
  assert.doesNotThrow(() =>
    assertProductionSecrets({ ...good, isProd: false, JWT_SECRET: 'dev-secret-change-me' }),
  );
});

test('E. AI is enabled only when both key and model are set', () => {
  assert.equal(isAiEnabled({ ...env, GEMINI_API_KEY: '', GEMINI_MODEL: 'm' }), false);
  assert.equal(isAiEnabled({ ...env, GEMINI_API_KEY: 'k', GEMINI_MODEL: '' }), false);
  assert.equal(isAiEnabled({ ...env, GEMINI_API_KEY: 'k', GEMINI_MODEL: 'm' }), true);
});

test('F. requireAiEnabled returns 503 AI_DISABLED without calling next', () => {
  const guard = requireAiEnabled(() => false);
  let status = 0;
  let body: any = null;
  let nextCalled = false;
  const res: any = {
    status(code: number) { status = code; return this; },
    json(payload: unknown) { body = payload; return this; },
  };
  guard({} as any, res, () => { nextCalled = true; });
  assert.equal(status, 503);
  assert.equal(body.code, 'AI_DISABLED');
  assert.equal(nextCalled, false);
});

test('G. transactions are time-bounded and no 60-second timeout remains in backend source', () => {
  assert.ok(TX_OPTIONS.timeout <= 15_000);
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(p);
      } else if (p.endsWith('.ts') && !p.includes(`${path.sep}tests${path.sep}`)) {
        if (/timeout:\s*60_?000\b/.test(fs.readFileSync(p, 'utf8'))) hits.push(p);
      }
    }
  };
  walk(path.join(REPO, 'backend/src'));
  assert.deepEqual(hits, []);
});

test('H. database.ts does not connect at import time', () => {
  assert.ok(!read('backend/src/config/database.ts').includes('$connect('));
});

test('I. readiness reports not-ready on failure, rejection, and hang', async () => {
  const ok = await checkDatabaseReady(async () => 1, 200);
  assert.equal(ok.ok, true);
  const rejected = await checkDatabaseReady(async () => { throw new Error('down'); }, 200);
  assert.equal(rejected.ok, false);
  const hung = await checkDatabaseReady(() => new Promise(() => {}), 50);
  assert.equal(hung.ok, false);
});

test('J. dev server proxies /api to the backend', () => {
  assert.ok(read('frontend/vite.config.ts').includes("'/api'"), 'proxy for /api is missing');
});

test('K. @types/express major version matches the runtime express major', () => {
  const pkg = readJson('backend/package.json');
  const major = (v: string) => v.replace(/[^\d.]/g, '').split('.')[0];
  const runtime = major(String(pkg.dependencies.express));
  const types = major(String(pkg.dependencies['@types/express'] ?? pkg.devDependencies?.['@types/express']));
  assert.equal(types, runtime);
});

test('L. AI endpoints are guarded by requireAiEnabled', () => {
  const routes = read('backend/src/routes/planRoutes.ts');
  assert.ok(/\/ai-parse['"],\s*requireAiEnabled\(\)/.test(routes));
  assert.ok(/\/ai-conversation['"],\s*requireAiEnabled\(\)/.test(routes));
});
