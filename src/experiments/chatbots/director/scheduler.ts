/**
 * The only timers in the system.
 *
 * Components hold none. A single rAF loop compares performance.now()
 * against queued deadlines, which puts cancelling, flushing and
 * background-tab throttling all in one place — and means an unmount can
 * guarantee nothing is still pending, rather than hoping every component
 * cleaned up after itself.
 *
 * Chained setTimeout was the obvious implementation and it is the reason
 * half-finished sequences leak: each link only knows about the next one,
 * so there is no single thing to cancel.
 */
export type Scheduler = {
  after(ms: number, fn: () => void): void;
  /** Cancel everything pending. Safe to call repeatedly. */
  flush(): void;
  /** True while anything is queued — used by tests to assert no leaks. */
  pending(): number;
};

export function createScheduler(
  now: () => number = () => performance.now(),
  raf: (fn: () => void) => number = (fn) => requestAnimationFrame(fn),
  caf: (h: number) => void = (h) => cancelAnimationFrame(h)
): Scheduler {
  let queue: { at: number; fn: () => void }[] = [];
  let handle = 0;

  const tick = () => {
    handle = 0;
    const t = now();
    // Splice before running: a task that queues another task must not be
    // re-entered in the same pass.
    const due = queue.filter((q) => q.at <= t);
    if (due.length) queue = queue.filter((q) => q.at > t);
    for (const d of due) d.fn();
    if (queue.length) handle = raf(tick);
  };

  return {
    after(ms, fn) {
      queue.push({ at: now() + Math.max(0, ms), fn });
      if (!handle) handle = raf(tick);
    },
    flush() {
      queue = [];
      if (handle) caf(handle);
      handle = 0;
    },
    pending: () => queue.length,
  };
}
