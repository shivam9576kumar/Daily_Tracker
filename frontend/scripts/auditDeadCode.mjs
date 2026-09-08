// Usage: node scripts/auditDeadCode.mjs
// Reports which audit candidates are safe to delete (zero external import references).
import { execSync } from 'node:child_process';
import { relative, resolve } from 'node:path';

const CANDIDATES = [
  'frontend/src/components/dashboard/StatusOverview.tsx',
  'frontend/src/components/dashboard/VibeBanner.tsx',
  'frontend/src/components/dashboard/TodaysHitlist.tsx',
  'frontend/src/components/dashboard/TaskRow.tsx',
  'frontend/src/components/dashboard/PendingAssignments.tsx',
  'frontend/src/components/assignments/PendingAssignments.tsx',
  'frontend/src/components/assignments/AssignmentItem.tsx',
  'frontend/src/store/taskStore.ts',
];

const results = [];
const projectRoot = resolve(process.cwd(), process.cwd().endsWith('frontend') ? '..' : '.');

for (const file of CANDIDATES) {
  const base = file.split('/').pop().replace(/\.(tsx|ts)$/, '');
  let refs = [];
  try {
    // Look specifically for import statements referencing the component/store
    const out = execSync(
      `grep -rn --include=*.ts --include=*.tsx "import.*['\\"]\\(.*\\/\\)\\?${base}['\\"]" frontend/src`,
      { encoding: 'utf8', cwd: projectRoot }
    );
    refs = out
      .split('\n')
      .filter(Boolean)
      .filter((line) => {
        const filePath = line.split(':')[0];
        const normalizedFile = relative(projectRoot, filePath).replace(/\\/g, '/');
        return normalizedFile !== file;
      });
  } catch {
    refs = [];
  }
  results.push({ file, external: refs.length, refs: refs.slice(0, 5) });
}

console.log('\nDEAD CODE AUDIT\n===============');
for (const r of results) {
  const verdict = r.external === 0 ? 'SAFE TO DELETE' : `KEEP (${r.external} refs)`;
  console.log(`\n${r.file}\n  → ${verdict}`);
  for (const ref of r.refs) console.log(`    ${ref}`);
}
