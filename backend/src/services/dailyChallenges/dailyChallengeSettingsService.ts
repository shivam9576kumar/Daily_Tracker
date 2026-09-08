import prisma from '../../config/database';
import { NotFoundError, ValidationError } from '../../utils/error';
import { getCp31Bands } from '../plan/cp31SheetLoader';
import { removeUnsolvedPotdTasks } from '../potd/potdService';

export interface DailyChallengeSettings {
  potdEnabled: boolean;
  cp31Enabled: boolean;
  cp31Band: number | null;
  cp31DailyCount: number;
  /** From the sheet — lets the UI render a band picker without another call. */
  availableBands: { band: number; count: number }[];
}

export interface DailyChallengeSettingsPatch {
  potdEnabled?: unknown;
  cp31Enabled?: unknown;
  cp31Band?: unknown;
  cp31DailyCount?: unknown;
}

export interface SettingsChangeReport {
  /** Unsolved POTD rows deleted because POTD was turned off in this call. */
  potdUnsolvedRemoved: number;
}

const FIELDS = {
  potdEnabled: true,
  cp31Enabled: true,
  cp31Band: true,
  cp31DailyCount: true,
} as const;

const MIN_COUNT = 1;
const MAX_COUNT = 3;

function parseBool(v: unknown, field: string): boolean {
  if (typeof v === 'boolean') return v;
  throw new ValidationError(`${field} must be true or false`);
}

function parseBand(v: unknown): number | null {
  if (v === null) return null;
  const bands = getCp31Bands().map((b) => b.band);
  if (typeof v !== 'number' || !Number.isInteger(v) || !bands.includes(v)) {
    throw new ValidationError(`cp31Band must be one of: ${bands.join(', ')} (or null)`);
  }
  return v;
}

function parseCount(v: unknown): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < MIN_COUNT || v > MAX_COUNT) {
    throw new ValidationError(`cp31DailyCount must be an integer between ${MIN_COUNT} and ${MAX_COUNT}`);
  }
  return v;
}

export const dailyChallengeSettingsService = {
  async get(userId: string): Promise<DailyChallengeSettings> {
    const row = await prisma.user.findUnique({ where: { id: userId }, select: FIELDS });
    if (!row) throw new NotFoundError('User');
    return { ...row, availableBands: getCp31Bands() };
  },

  async update(
    userId: string,
    patch: DailyChallengeSettingsPatch,
  ): Promise<{ settings: DailyChallengeSettings; changes: SettingsChangeReport }> {
    const current = await prisma.user.findUnique({ where: { id: userId }, select: FIELDS });
    if (!current) throw new NotFoundError('User');

    const next = { ...current };
    let touched = false;

    if (patch.potdEnabled !== undefined) {
      next.potdEnabled = parseBool(patch.potdEnabled, 'potdEnabled');
      touched = true;
    }
    if (patch.cp31Enabled !== undefined) {
      next.cp31Enabled = parseBool(patch.cp31Enabled, 'cp31Enabled');
      touched = true;
    }
    if (patch.cp31Band !== undefined) {
      next.cp31Band = parseBand(patch.cp31Band);
      touched = true;
    }
    if (patch.cp31DailyCount !== undefined) {
      next.cp31DailyCount = parseCount(patch.cp31DailyCount);
      touched = true;
    }

    if (!touched) throw new ValidationError('No settings provided');
    if (next.cp31Enabled && next.cp31Band === null) {
      throw new ValidationError('Choose a starting rating band to enable CP31');
    }

    const potdTurningOff = current.potdEnabled && !next.potdEnabled;

    const changes = await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: next });
      const potdUnsolvedRemoved = potdTurningOff ? await removeUnsolvedPotdTasks(userId, tx) : 0;
      return { potdUnsolvedRemoved };
    });

    return { settings: await this.get(userId), changes };
  },
};
