import fs from 'fs';
import path from 'path';
import prisma from '../src/config/database';
import striverSheetData from '../src/data/striverSheet.json';
import striverGfgMappingData from '../src/data/striverGfgMapping.json';
import { normalizeTitleForSearch } from './generateStriverGfgCandidates';

interface StriverQuestion {
  id: string;
  title: string;
  topic: string;
  difficulty: string;
  url: string;
  order: number;
}

interface GfgMappingEntry {
  gfgUrl: string;
  gfgTitle: string;
}

interface TaskTransition {
  taskId: string;
  title: string;
  oldUrl: string | null;
  newUrl: string;
  oldPlatform: string | null;
  newPlatform: string;
  oldQuestionBankId: string | null;
  newQuestionBankId: string;
}

const striverSheet = striverSheetData as StriverQuestion[];
const striverMapping = striverGfgMappingData as Record<string, GfgMappingEntry>;

const OUTPUT_DIR = path.join(__dirname, 'output');
const DRY_RUN_REPORT_PATH = path.join(OUTPUT_DIR, 'striver-gfg-backfill-dry-run.json');
const REVIEW_REPORT_PATH = path.join(OUTPUT_DIR, 'striver-gfg-backfill-review.json');

const STRIVER_SOURCES = ['striver', 'strivera2z', 'takeuforward'];
const NON_TAKEUFORWARD_HOSTS = ['leetcode.com', 'hackerrank.com', 'interviewbit.com', 'spoj.com', 'codeforces.com'];

export async function backfillStriverGfgLinks(options: { dryRun?: boolean } = {}): Promise<{
  dryRun: boolean;
  updated: number;
  skipped: number;
  ambiguous: number;
  unresolved: number;
  alreadyGfg: number;
  transitions: TaskTransition[];
}> {
  const dryRun = !!options.dryRun;
  let updated = 0;
  let skipped = 0;
  let ambiguous = 0;
  let unresolved = 0;
  let alreadyGfg = 0;

  const transitions: TaskTransition[] = [];
  const reviewRows: {
    taskId: string;
    title: string;
    currentUrl: string | null;
    reason: string;
  }[] = [];

  // Build lookup maps
  const urlToQuestionMap = new Map<string, StriverQuestion>();
  const titleToQuestionsMap = new Map<string, StriverQuestion[]>();

  striverSheet.forEach((q) => {
    urlToQuestionMap.set(q.url, q);
    const norm = normalizeTitleForSearch(q.title);
    const existing = titleToQuestionsMap.get(norm) || [];
    existing.push(q);
    titleToQuestionsMap.set(norm, existing);
  });

  const tasks = await prisma.task.findMany({
    include: {
      plan: true,
    },
  });

  for (const task of tasks) {
    const planSource = (task.plan?.source || '').toLowerCase().trim();
    const isStriverPlan = STRIVER_SOURCES.includes(planSource);

    const currentUrl = task.problemUrl || '';
    const currentUrlLower = currentUrl.toLowerCase();

    if (currentUrlLower.includes('geeksforgeeks.org')) {
      alreadyGfg++;
      continue;
    }

    const isPreservedHost = NON_TAKEUFORWARD_HOSTS.some((host) => currentUrlLower.includes(host));
    if (isPreservedHost && !isStriverPlan) {
      skipped++;
      continue;
    }

    let matchedQuestion: StriverQuestion | null = null;

    // Priority 1: task.questionBankId
    if (task.questionBankId) {
      matchedQuestion = striverSheet.find((q) => q.id === task.questionBankId) || null;
    }

    // Priority 2: Exact match on task.problemUrl
    if (!matchedQuestion && currentUrl) {
      matchedQuestion = urlToQuestionMap.get(currentUrl) || null;
    }

    // Priority 3: Striver plan + normalized title match
    if (!matchedQuestion && isStriverPlan) {
      const normTitle = normalizeTitleForSearch(task.title);
      const matches = titleToQuestionsMap.get(normTitle) || [];
      if (matches.length === 1) {
        matchedQuestion = matches[0];
      } else if (matches.length > 1) {
        ambiguous++;
        reviewRows.push({
          taskId: task.id,
          title: task.title,
          currentUrl: task.problemUrl,
          reason: `Ambiguous title match: found ${matches.length} matching Striver questions`,
        });
        continue;
      }
    }

    if (!matchedQuestion) {
      if (isStriverPlan) {
        unresolved++;
        reviewRows.push({
          taskId: task.id,
          title: task.title,
          currentUrl: task.problemUrl,
          reason: 'Unresolved Striver question identity',
        });
      } else {
        skipped++;
      }
      continue;
    }

    const mapping = striverMapping[matchedQuestion.id];
    if (!mapping?.gfgUrl) {
      if (isStriverPlan) {
        unresolved++;
        reviewRows.push({
          taskId: task.id,
          title: task.title,
          currentUrl: task.problemUrl,
          reason: `No verified GFG mapping for Striver question ID '${matchedQuestion.id}'`,
        });
      } else {
        skipped++;
      }
      continue;
    }

    if (task.problemUrl === mapping.gfgUrl && task.platform === 'gfg' && task.questionBankId === matchedQuestion.id) {
      alreadyGfg++;
      continue;
    }

    const transition: TaskTransition = {
      taskId: task.id,
      title: task.title,
      oldUrl: task.problemUrl,
      newUrl: mapping.gfgUrl,
      oldPlatform: task.platform,
      newPlatform: 'gfg',
      oldQuestionBankId: task.questionBankId,
      newQuestionBankId: matchedQuestion.id,
    };

    transitions.push(transition);
    updated++;

    if (!dryRun) {
      await prisma.task.update({
        where: { id: task.id },
        data: {
          problemUrl: mapping.gfgUrl,
          platform: 'gfg',
          questionBankId: matchedQuestion.id,
        },
      });
    }
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  if (dryRun) {
    fs.writeFileSync(DRY_RUN_REPORT_PATH, JSON.stringify(transitions, null, 2), 'utf8');
  }

  fs.writeFileSync(REVIEW_REPORT_PATH, JSON.stringify(reviewRows, null, 2), 'utf8');

  const summary = {
    dryRun,
    updated,
    skipped,
    ambiguous,
    unresolved,
    alreadyGfg,
    transitions,
  };

  console.log('==================================================');
  console.log(`STRIVER GFG BACKFILL REPORT ${dryRun ? '(DRY RUN)' : '(LIVE APPLIED)'}`);
  console.log('==================================================');
  console.log(JSON.stringify({ dryRun, updated, skipped, ambiguous, unresolved, alreadyGfg }, null, 2));

  return summary;
}

if (require.main === module) {
  const isDryRun = process.argv.includes('--dry-run');
  backfillStriverGfgLinks({ dryRun: isDryRun })
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('Backfill script error:', err);
      process.exit(1);
    });
}
