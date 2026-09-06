import prisma from '../src/config/database';
import { loadQuestionBank, QuestionBankEntry } from '../src/services/plan/questionBankLoader';
import { normalizeQuestionUrl } from '../src/utils/questionUrl';
import { titleCompatible } from '../src/utils/titleMatch';

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const striverRows = loadQuestionBank('striver');

  const bySourceUrl = new Map<string, QuestionBankEntry[]>();
  striverRows.forEach((r) => {
    const rawSrc = r.sourceUrl || r.url;
    const key = normalizeQuestionUrl(rawSrc);
    if (!key) return;
    const arr = bySourceUrl.get(key) || [];
    arr.push(r);
    bySourceUrl.set(key, arr);
  });

  const tasks = await prisma.task.findMany({
    where: {
      questionBankId: { startsWith: 'striver-' },
      OR: [
        { platform: 'striver' },
        { problemUrl: { contains: 'takeuforward.org' } },
      ],
    },
    select: {
      id: true,
      problemUrl: true,
      sourceUrl: true,
      platform: true,
      questionBankId: true,
      title: true,
    },
  });

  const updates: { id: string; problemUrl: string; sourceUrl: string; platform: string }[] = [];

  for (const t of tasks) {
    const norm = normalizeQuestionUrl(t.problemUrl || t.sourceUrl);
    if (!norm) continue;
    const candidates = bySourceUrl.get(norm) || [];
    const match = candidates.find((c) => titleCompatible(t.title, [c.title]));
    if (match) {
      if (match.url !== t.problemUrl) {
        updates.push({
          id: t.id,
          problemUrl: match.url,
          sourceUrl: match.sourceUrl || t.problemUrl || '',
          platform: 'gfg',
        });
      }
    }
  }

  console.log(`Found ${updates.length} tasks to update.`);
  if (!apply) {
    console.log('Dry run. Pass --apply to commit changes.');
    return;
  }

  for (const u of updates) {
    await prisma.task.update({
      where: { id: u.id },
      data: {
        problemUrl: u.problemUrl,
        sourceUrl: u.sourceUrl,
        platform: u.platform,
      },
    });
  }
  console.log('Backfill complete.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
