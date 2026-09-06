import fs from 'fs';
import path from 'path';
import prisma from '../src/config/database';
import striverSheetData from '../src/data/striverSheet.json';
import striverGfgMappingData from '../src/data/striverGfgMapping.json';
import { FORCE_REJECT, titlesAreEquivalent } from '../src/services/plan/gfgTitleEquivalence';

interface StriverQuestion {
  id: string;
  title: string;
  topic: string;
  difficulty: string;
  url: string;
  order: number;
}

interface MappingRecord {
  gfgUrl: string;
  gfgTitle: string;
  status?: 'verified' | 'rejected';
  equivalenceVerified?: boolean;
  sourceUrl?: string;
}

interface TaskTransition {
  taskId: string;
  title: string;
  oldUrl: string | null;
  newUrl: string;
  oldPlatform: string | null;
  newPlatform: string;
}

const striverSheet = striverSheetData as StriverQuestion[];
const striverMapping = striverGfgMappingData as Record<string, MappingRecord>;

const OUTPUT_DIR = path.join(__dirname, 'output');
const REVERT_REPORT_PATH = path.join(OUTPUT_DIR, 'striver-gfg-revert-report.json');

export async function revertUnsafeStriverGfgLinks(options: { apply?: boolean } = {}): Promise<{
  applyMode: boolean;
  totalTasksChecked: number;
  revertedCount: number;
  unaffectedCount: number;
  revertedRows: TaskTransition[];
}> {
  const applyMode = !!options.apply;
  let revertedCount = 0;
  let unaffectedCount = 0;
  const revertedRows: TaskTransition[] = [];

  // Build lookup maps
  const idToQuestionMap = new Map<string, StriverQuestion>();
  const gfgUrlToQuestionMap = new Map<string, StriverQuestion>();

  striverSheet.forEach((q) => {
    idToQuestionMap.set(q.id, q);
    const m = striverMapping[q.id];
    if (m?.gfgUrl) {
      gfgUrlToQuestionMap.set(m.gfgUrl, q);
    }
  });

  const tasks = await prisma.task.findMany();

  for (const task of tasks) {
    const currentUrl = task.problemUrl || '';
    const currentUrlLower = currentUrl.toLowerCase();
    const isGfgUrl = currentUrlLower.includes('geeksforgeeks.org');

    let isUnsafe = false;
    let originalTufUrl: string | null = null;

    // Check 1: task.questionBankId in FORCE_REJECT or has non-verified mapping
    if (task.questionBankId) {
      const q = idToQuestionMap.get(task.questionBankId);
      const m = striverMapping[task.questionBankId];

      if (FORCE_REJECT.has(task.questionBankId) || m?.status === 'rejected' || m?.equivalenceVerified === false) {
        isUnsafe = true;
        originalTufUrl = q ? q.url : m?.sourceUrl || null;
      }
    }

    // Check 2: problemUrl matches a quarantined GFG URL or is GFG url for unsafe mapping
    if (!isUnsafe && isGfgUrl) {
      const matchedQ = gfgUrlToQuestionMap.get(currentUrl);
      if (matchedQ) {
        const m = striverMapping[matchedQ.id];
        if (FORCE_REJECT.has(matchedQ.id) || m?.status === 'rejected' || !titlesAreEquivalent(task.title, m?.gfgTitle || '', matchedQ.id)) {
          isUnsafe = true;
          originalTufUrl = matchedQ.url;
        }
      }
    }

    // Skip if task is ALREADY set to original URL and striver platform
    if (isUnsafe && originalTufUrl && (task.problemUrl !== originalTufUrl || task.platform !== 'striver')) {
      const revertedRow: TaskTransition = {
        taskId: task.id,
        title: task.title,
        oldUrl: task.problemUrl,
        newUrl: originalTufUrl,
        oldPlatform: task.platform,
        newPlatform: 'striver',
      };

      revertedRows.push(revertedRow);
      revertedCount++;

      if (applyMode) {
        await prisma.task.update({
          where: { id: task.id },
          data: {
            problemUrl: originalTufUrl,
            platform: 'striver',
          },
        });
      }
    } else {
      unaffectedCount++;
    }
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  fs.writeFileSync(REVERT_REPORT_PATH, JSON.stringify(revertedRows, null, 2), 'utf8');

  console.log('==================================================');
  console.log(`STRIVER GFG UNSAFE REVERT REPORT ${applyMode ? '(LIVE APPLIED)' : '(DRY RUN)'}`);
  console.log('==================================================');
  console.log(JSON.stringify({ applyMode, totalTasksChecked: tasks.length, revertedCount, unaffectedCount }, null, 2));
  console.log(`Detailed report written to: ${REVERT_REPORT_PATH}`);

  return {
    applyMode,
    totalTasksChecked: tasks.length,
    revertedCount,
    unaffectedCount,
    revertedRows,
  };
}

if (require.main === module) {
  const isApply = process.argv.includes('--apply');
  revertUnsafeStriverGfgLinks({ apply: isApply })
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('Revert script error:', err);
      process.exit(1);
    });
}
