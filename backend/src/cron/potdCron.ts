import { getTodayPotd } from '../services/potd/potdService';
import prisma from '../config/database';
import logger from '../utils/logger';

export async function runPotdWarmupCron() {
  try {
    const potd = await getTodayPotd();
    logger.info(`POTD warm-up: ${potd ? `${potd.dateKey} — ${potd.title}` : 'unavailable'}`);
  } catch (err) {
    logger.warn('POTD warm-up failed', { message: (err as Error)?.message });
  }
}

export async function runPotdPruneCron() {
  try {
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - 90);
    const cutoffKey = cutoff.toISOString().slice(0, 10);

    const prunedCache = await prisma.potdCache.deleteMany({
      where: { dateKey: { lt: cutoffKey } },
    });

    const prunedDismissals = await prisma.potdDismissal.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    if (prunedCache.count > 0 || prunedDismissals.count > 0) {
      logger.info(`POTD retention pruned: ${prunedCache.count} cache rows, ${prunedDismissals.count} dismissals`);
    }
  } catch (err) {
    logger.warn('POTD retention prune failed', { message: (err as Error)?.message });
  }
}
