/**
 * Runs async tasks strictly one after another, in call order.
 * A failing task does not block the tasks queued behind it.
 * `depth` counts tasks that are running or waiting.
 */
export interface SerialQueue {
  run<T>(task: () => Promise<T>): Promise<T>;
  readonly depth: number;
}

export function createSerialQueue(): SerialQueue {
  let tail: Promise<void> = Promise.resolve();
  let depth = 0;

  return {
    get depth() {
      return depth;
    },
    run<T>(task: () => Promise<T>): Promise<T> {
      depth += 1;
      const result = tail.then(() => task());
      tail = result
        .then(
          () => undefined,
          () => undefined,
        )
        .finally(() => {
          depth -= 1;
        });
      return result;
    },
  };
}
