export interface DatabaseReadiness {
  ok: boolean;
  latencyMs: number;
}

/**
 * Pings the database with a hard timeout. Returns the outcome; the caller
 * decides what to expose. Errors are returned to the caller for logging only.
 */
export async function checkDatabaseReady(
  ping: () => Promise<unknown>,
  timeoutMs = 2_000,
): Promise<DatabaseReadiness & { error?: string }> {
  const started = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`database ping exceeded ${timeoutMs}ms`)), timeoutMs);
  });
  try {
    await Promise.race([ping(), timeout]);
    return { ok: true, latencyMs: Date.now() - started };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - started, error: (err as Error).message };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
