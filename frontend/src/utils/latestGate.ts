/**
 * Request ordering guard. Call begin() when a request starts and keep the
 * token. When the response arrives, apply it only if isLatest(token) is true.
 */
export function createLatestGate() {
  let current = 0;
  return {
    begin(): number {
      current += 1;
      return current;
    },
    isLatest(token: number): boolean {
      return token === current;
    },
  };
}
