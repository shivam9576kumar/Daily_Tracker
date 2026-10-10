/**
 * Upper bounds for interactive transactions.
 *
 * Business transactions here touch a small number of rows. A transaction
 * that runs longer than this is almost always a stuck connection, not
 * legitimate work. Do not raise these values to silence a timeout: measure
 * first (slow-transaction log, Section 8-B) and reduce round trips.
 */
export const TX_OPTIONS = {
  maxWait: 10_000,
  timeout: 15_000,
} as const;
