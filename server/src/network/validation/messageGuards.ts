/**
 * Lightweight protections for the WebSocket message pipeline.
 * One limiter and one queue are created PER socket, never shared globally.
 */
export const MAX_MESSAGES_PER_SECOND = 30;
export const MAX_QUEUED_MESSAGES = 32;

/**
 * Rolling one-second window, bounded by MAX_MESSAGES_PER_SECOND entries.
 * Rejecting a burst does not require database access or a global timer.
 */
export class MessageRateLimiter {
  private receivedAt: number[] = [];

  allow(now: number = performance.now()): boolean {
    if (!Number.isFinite(now)) return false;

    // Keep timestamps within the last 1000ms.
    while (this.receivedAt.length > 0 && now - this.receivedAt[0] >= 1000) {
      this.receivedAt.shift();
    }
    if (this.receivedAt.length >= MAX_MESSAGES_PER_SECOND) return false;

    this.receivedAt.push(now);
    return true;
  }
}

/**
 * Serializes asynchronous handlers from the same socket in arrival order.
 * Without this, a slow command could finish after a later, dependent command.
 */
export class OrderedMessageQueue {
  private tail: Promise<void> = Promise.resolve();
  private queued = 0;

  constructor(private readonly onError: (error: unknown) => void) {}

  enqueue(action: () => void | Promise<void>): boolean {
    if (this.queued >= MAX_QUEUED_MESSAGES) return false;
    this.queued++;

    const run = async (): Promise<void> => {
      try {
        await action();
      } catch (error) {
        try { this.onError(error); } catch { /* Keep chain alive even if logging fails. */ }
      } finally {
        this.queued--;
      }
    };

    // Each task starts AFTER the prior task, even if the prior one threw.
    this.tail = this.tail.then(run, run);
    return true;
  }

  /** Shutdown awaits handlers already running before persisting the player. */
  whenIdle(): Promise<void> {
    return this.tail;
  }

  get pending(): number {
    return this.queued;
  }
}
