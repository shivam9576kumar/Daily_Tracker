import prisma from '../../config/database';
import logger from '../../utils/logger';
import { NotFoundError, ValidationError } from '../../utils/error';
import { getCp31Bands } from '../plan/cp31SheetLoader';
import { removeUnsolvedPotdTasks } from '../potd/potdService';
import { removeUnsolvedCp31Tasks, ensureCp31TasksForUser, toPublicCp31State, type Cp31PublicState } from '../cp31/cp31Service';

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
  cp31PendingParked: number;
  cp31PendingRemoved?: number;
}

export interface DailyChallengeSettingsResponse {
  settings: DailyChallengeSettings;
  changes: SettingsChangeReport;
  /**
   * CP31 state immediately after the settings change, if CP31 is enabled.
   * This is populated by a best-effort ensureCp31TasksForUser call that runs
   * after the settings transaction commits — fixing the previous behaviour
   * where enabling/switching a band left the band empty until the next page load.
   * null when CP31 is disabled or the post-update ensure call fails.
   */
  cp31State: Cp31PublicState | null;
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
    tz: string,
  ): Promise<DailyChallengeSettingsResponse> {
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
    const cp31TurningOff = current.cp31Enabled && !next.cp31Enabled;
    const cp31BandChanged = next.cp31Band !== current.cp31Band;

    const changes = await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: next });
      const potdUnsolvedRemoved = potdTurningOff ? await removeUnsolvedPotdTasks(userId, tx) : 0;
      const cp31PendingParked = (cp31TurningOff || cp31BandChanged) ? await removeUnsolvedCp31Tasks(userId, tx) : 0;
      return { potdUnsolvedRemoved, cp31PendingParked, cp31PendingRemoved: cp31PendingParked };
    });

    // Best-effort immediate materialization for the (possibly new) band.
    //
    // This is intentionally a separate sequential call, NOT nested inside
    // the settings transaction above. ensureCp31TasksForUser is explicitly
    // documented as idempotent and safe to call on every dashboard/todo load,
    // so running it here as a follow-up step is sufficient to fix
    // "band left empty until next page load" without the complexity and
    // risk of threading a shared transaction client through the entire
    // CP31 ensure/materialize call graph (which also internally performs
    // its own retry-on-P2002 logic that assumes an independent connection).
    //
    // If this call fails, the settings change itself has already committed
    // successfully; the next Todo/Dashboard load will retry materialization
    // via its own ensure call, so this failure is logged but non-fatal.
    let cp31State: Cp31PublicState | null = null;
    if (next.cp31Enabled && next.cp31Band !== null) {
      try {
        cp31State = toPublicCp31State(await ensureCp31TasksForUser(userId, tz));
      } catch (err) {
        logger.error('dailyChallengeSettingsService: post-update CP31 ensure failed', {
          userId,
          message: (err as Error)?.message,
        });
      }
    }

    return { settings: await this.get(userId), changes, cp31State };
  },
};
