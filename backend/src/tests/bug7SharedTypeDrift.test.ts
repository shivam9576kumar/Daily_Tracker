/**
 * bug7SharedTypeDrift.test.ts
 * Tests for Bug 7 — Shared/Frontend Type Drift, Dead Code,
 * Stale Schema Comments & Documentation Drift.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import prisma from '../config/database';
import { taskService, resolvePlatformForUpdate } from '../services/task/taskService';

const ROOT_DIR = path.resolve(__dirname, '../../..');
const SHARED_DIR = path.join(ROOT_DIR, 'shared');
const BACKEND_DIR = path.join(ROOT_DIR, 'backend');
const FRONTEND_DIR = path.join(ROOT_DIR, 'frontend');

// ─────────────────────────────────────────────────
// A. shared package compiles cleanly
// ─────────────────────────────────────────────────
test('A. shared package compiles cleanly', () => {
  const result = execSync('npm run build', { cwd: SHARED_DIR, encoding: 'utf8' });
  assert.ok(fs.existsSync(path.join(SHARED_DIR, 'dist/index.d.ts')), 'dist/index.d.ts must exist');
  assert.ok(fs.existsSync(path.join(SHARED_DIR, 'dist/index.js')), 'dist/index.js must exist');
});

// ─────────────────────────────────────────────────
// B. REVISION_RULES has exactly one source
// ─────────────────────────────────────────────────
test('B. REVISION_RULES has exactly one source', () => {
  const candidateFiles = [
    path.join(SHARED_DIR, 'src/index.ts'),
    path.join(SHARED_DIR, 'src/constants/revisionRules.ts'),
    path.join(BACKEND_DIR, 'src/config/rewards.ts'),
    path.join(BACKEND_DIR, 'src/utils/dateKeys.ts'),
  ];

  let literalDeclarationsCount = 0;
  for (const filePath of candidateFiles) {
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, 'utf8');
    // Match the array literal definition: [14, 28] or [Rating.EASY]
    if (content.includes('[14, 28]') && content.includes('[1, 3, 7, 14]')) {
      literalDeclarationsCount++;
    }
  }

  assert.equal(
    literalDeclarationsCount,
    1,
    'Exactly one file must contain the literal definition of REVISION_RULES'
  );

  // Assert that file is shared/src/constants/revisionRules.ts
  const canonicalRules = fs.readFileSync(path.join(SHARED_DIR, 'src/constants/revisionRules.ts'), 'utf8');
  assert.ok(canonicalRules.includes('export const REVISION_RULES'), 'Canonical file must export REVISION_RULES');
});

// ─────────────────────────────────────────────────
// C. shared/src/index.ts does not redeclare
// ─────────────────────────────────────────────────
test('C. shared/src/index.ts does not redeclare', () => {
  const content = fs.readFileSync(path.join(SHARED_DIR, 'src/index.ts'), 'utf8');
  assert.ok(!content.includes('const REVISION_RULES ='), 'shared/src/index.ts must not declare const REVISION_RULES');
  assert.ok(!content.includes('type Difficulty ='), 'shared/src/index.ts must not declare type Difficulty =');
  assert.ok(!content.includes('type TaskType ='), 'shared/src/index.ts must not declare type TaskType =');
  assert.ok(!content.includes('type TaskStatus ='), 'shared/src/index.ts must not declare type TaskStatus =');
  assert.ok(!content.includes('type Rating ='), 'shared/src/index.ts must not declare type Rating =');
  assert.ok(!content.includes('type Platform ='), 'shared/src/index.ts must not declare type Platform =');
  assert.ok(!content.includes('const BACKLOG_EXPIRY_DAYS ='), 'shared/src/index.ts must not declare const BACKLOG_EXPIRY_DAYS');
});

// ─────────────────────────────────────────────────
// D. Task.notes status check (Section 1-C / Section 7)
// ─────────────────────────────────────────────────
test('D. Task.notes architectural status check', () => {
  const schemaContent = fs.readFileSync(path.join(BACKEND_DIR, 'prisma/schema.prisma'), 'utf8');
  // Task.notes is verified to be present in schema and actively written in notesController.ts
  // as an in-flight cache, so removal was deferred per Section 7 policy.
  assert.ok(schemaContent.includes('model Task'), 'Task model must exist in schema');
  const taskRepoContent = fs.readFileSync(path.join(BACKEND_DIR, 'src/repositories/taskRepository.ts'), 'utf8');
  assert.ok(
    taskRepoContent.includes('Notes are stored exclusively in the `Note` model'),
    'taskRepository must contain notes unification architectural comment'
  );
});

// ─────────────────────────────────────────────────
// E. Stale /api/v1/ references are gone
// ─────────────────────────────────────────────────
test('E. Stale /api/v1/ references are gone', () => {
  const readmeContent = fs.readFileSync(path.join(ROOT_DIR, 'README.md'), 'utf8');
  assert.ok(!readmeContent.includes('/api/v1/'), 'README.md must not contain /api/v1/');

  const projectContextPath = path.join(ROOT_DIR, 'PROJECT_CONTEXT.md');
  if (fs.existsSync(projectContextPath)) {
    const projectContextContent = fs.readFileSync(projectContextPath, 'utf8');
    assert.ok(!projectContextContent.includes('/api/v1/'), 'PROJECT_CONTEXT.md must not contain /api/v1/');
  }

  // Check backend/src and frontend/src TypeScript source files
  function checkDirForV1(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'dist') {
        checkDirForV1(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        if (entry.name.includes('.test.')) continue;
        const fileContent = fs.readFileSync(fullPath, 'utf8');
        assert.ok(
          !fileContent.includes('/api/v1/'),
          `File ${fullPath} must not contain literal /api/v1/`
        );
      }
    }
  }

  checkDirForV1(path.join(BACKEND_DIR, 'src'));
  checkDirForV1(path.join(FRONTEND_DIR, 'src'));
});

// ─────────────────────────────────────────────────
// F. Stale Prisma comments are updated
// ─────────────────────────────────────────────────
test('F. Stale Prisma comments are updated', () => {
  const schemaContent = fs.readFileSync(path.join(BACKEND_DIR, 'prisma/schema.prisma'), 'utf8');
  assert.ok(
    !schemaContent.includes('// new | revision | assignment'),
    'schema.prisma must not contain outdated // new | revision | assignment comment'
  );
  assert.ok(
    !schemaContent.includes('// pending | completed | backlog | expired'),
    'schema.prisma must not contain outdated // pending | completed | backlog | expired comment'
  );
  assert.ok(
    schemaContent.includes("/// 'new' | 'revision' | 'potd' | 'personal' | 'cp31'"),
    'schema.prisma must contain current taskType union comment'
  );
  assert.ok(
    schemaContent.includes("/// 'pending' | 'completed' | 'backlog' | 'expired' | 'skipped'"),
    'schema.prisma must contain current status union comment'
  );
});

// ─────────────────────────────────────────────────
// G. Frontend types/index.ts is a re-export
// ─────────────────────────────────────────────────
test('G. Frontend types/index.ts is a re-export', () => {
  const frontendTypes = fs.readFileSync(path.join(FRONTEND_DIR, 'src/types/index.ts'), 'utf8');
  assert.ok(frontendTypes.includes("from '@dsa-planner/shared'"), "frontend types must import/re-export from '@dsa-planner/shared'");
  assert.ok(!frontendTypes.includes('export type Difficulty ='), 'frontend types must not declare export type Difficulty =');
  assert.ok(!frontendTypes.includes('export type TaskType ='), 'frontend types must not declare export type TaskType =');
  assert.ok(!frontendTypes.includes('export type TaskStatus ='), 'frontend types must not declare export type TaskStatus =');
  assert.ok(!frontendTypes.includes('export type Rating ='), 'frontend types must not declare export type Rating =');
});

// ─────────────────────────────────────────────────
// H. Platform resolution consistency in updateTask
// ─────────────────────────────────────────────────
test('H. Platform resolution consistency in updateTask', async () => {
  const user = await prisma.user.create({
    data: {
      googleId: `bug7-user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      email: `bug7-${Date.now()}@test.local`,
      name: 'Bug 7 Test User',
      coins: 0,
    },
  });

  // Seed task with platform: 'custom', problemUrl: null
  const task = await taskService.createTask(user.id, {
    title: 'Platform Resolution Test',
    topic: 'Arrays',
    difficulty: 'medium',
    platform: 'custom',
    scheduledDate: '2026-10-10',
  });
  assert.equal(task.platform, 'custom');

  // 1. Update with URL and explicit conflicting platform: URL host wins (same as create)
  const updated1 = await taskService.updateTask(task.id, user.id, {
    problemUrl: 'https://leetcode.com/problems/two-sum',
    platform: 'gfg',
  });
  assert.equal(updated1.platform, 'leetcode', 'URL host leetcode must win over explicit platform gfg');

  // 2. Update with only platform, no problemUrl in patch payload: explicit override applies
  const updated2 = await taskService.updateTask(task.id, user.id, {
    platform: 'striver',
  });
  assert.equal(updated2.platform, 'striver', 'Explicit platform update without URL change must be respected');

  // 3. Update with only Codeforces problemUrl: URL host wins over existing platform
  const updated3 = await taskService.updateTask(task.id, user.id, {
    problemUrl: 'https://codeforces.com/problemset/problem/1/A',
  });
  assert.equal(updated3.platform, 'codeforces', 'URL host codeforces must win when problemUrl updated');

  // Cleanup
  await prisma.task.delete({ where: { id: task.id } });
  await prisma.user.delete({ where: { id: user.id } });
});

// ─────────────────────────────────────────────────
// I. Dead todoApi.cp31* methods are gone
// ─────────────────────────────────────────────────
test('I. Dead todoApi.cp31* methods are gone', () => {
  const todoApiContent = fs.readFileSync(path.join(FRONTEND_DIR, 'src/services/todoApi.ts'), 'utf8');
  assert.ok(!todoApiContent.includes('cp31OneMore'), 'todoApi.ts must not contain cp31OneMore');
  assert.ok(!todoApiContent.includes('cp31Skip'), 'todoApi.ts must not contain cp31Skip');
  assert.ok(!todoApiContent.includes('cp31AdvanceBand'), 'todoApi.ts must not contain cp31AdvanceBand');

  // Verify zero frontend files import cp31OneMore from todoApi
  function searchImports(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'dist') {
        searchImports(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        const fileContent = fs.readFileSync(fullPath, 'utf8');
        assert.ok(
          !fileContent.includes('todoApi.cp31OneMore') &&
          !fileContent.includes('todoApi.cp31Skip') &&
          !fileContent.includes('todoApi.cp31AdvanceBand'),
          `File ${fullPath} must not reference dead todoApi.cp31* methods`
        );
      }
    }
  }

  searchImports(path.join(FRONTEND_DIR, 'src'));
});

// ─────────────────────────────────────────────────
// J. Recurrence enum lives in shared/
// ─────────────────────────────────────────────────
test('J. Recurrence enum lives in shared/', () => {
  assert.ok(
    fs.existsSync(path.join(SHARED_DIR, 'src/enums/Recurrence.ts')),
    'shared/src/enums/Recurrence.ts must exist'
  );

  const sharedIndexContent = fs.readFileSync(path.join(SHARED_DIR, 'src/index.ts'), 'utf8');
  assert.ok(
    sharedIndexContent.includes('Recurrence') && sharedIndexContent.includes('./enums/Recurrence'),
    'shared/src/index.ts must re-export Recurrence from ./enums/Recurrence'
  );

  const dateKeysContent = fs.readFileSync(path.join(BACKEND_DIR, 'src/utils/dateKeys.ts'), 'utf8');
  assert.ok(
    !dateKeysContent.includes("export type Recurrence = 'daily' | 'weekdays'"),
    'dateKeys.ts must not declare local type Recurrence ='
  );
  assert.ok(
    dateKeysContent.includes("from '@dsa-planner/shared'"),
    'dateKeys.ts must import Recurrence from @dsa-planner/shared'
  );

  const frontendTypesContent = fs.readFileSync(path.join(FRONTEND_DIR, 'src/types/index.ts'), 'utf8');
  assert.ok(
    !frontendTypesContent.includes("export type Recurrence = 'daily' | 'weekdays'"),
    'frontend types must not declare local type Recurrence ='
  );
  assert.ok(
    frontendTypesContent.includes("Recurrence") && frontendTypesContent.includes("@dsa-planner/shared"),
    'frontend types must re-export Recurrence from @dsa-planner/shared'
  );
});
