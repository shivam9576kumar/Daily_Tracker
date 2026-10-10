import { randomUUID } from 'node:crypto';

interface ExchangeEntry {
  token: string;
  expiresAt: number;
}

const EXCHANGE_TTL_MS = 30_000;
const codes = new Map<string, ExchangeEntry>();

/**
 * In-memory, single-instance store — consistent with the existing
 * authMiddleware userCache, which already assumes a single backend
 * instance. If the deployment is ever scaled horizontally, this (like
 * userCache) will need to move to a shared store (e.g. Redis).
 */
export function createExchangeCode(token: string, ttlMs: number = EXCHANGE_TTL_MS): string {
  const code = randomUUID();
  codes.set(code, { token, expiresAt: Date.now() + ttlMs });
  return code;
}

/** Single-use: always deletes on lookup, whether valid or expired. */
export function consumeExchangeCode(code: string): string | null {
  const entry = codes.get(code);
  if (!entry) return null;
  codes.delete(code);
  if (entry.expiresAt < Date.now()) return null;
  return entry.token;
}

setInterval(() => {
  const now = Date.now();
  for (const [code, entry] of codes) {
    if (entry.expiresAt < now) codes.delete(code);
  }
}, 60_000).unref();
