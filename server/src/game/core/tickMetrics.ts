/** Bounded, low-cost tick latency histogram. No external agent or telemetry. */
export interface TickSummary {
  samples: number;
  totalTicks: number;
  averageMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
  slowTicks: number;
}

export class TickMetrics {
  private readonly durations: number[] = [];
  private nextIndex = 0;
  private count = 0;
  private slow = 0;

  constructor(
    readonly sampleLimit: number = 512,
    readonly slowThresholdMs: number = 250,
  ) {
    if (!Number.isSafeInteger(sampleLimit) || sampleLimit <= 0 ||
        !Number.isFinite(slowThresholdMs) || slowThresholdMs <= 0) {
      throw new Error("TickMetrics requer buffer e limiar positivos.");
    }
  }

  record(durationMs: number): void {
    if (!Number.isFinite(durationMs) || durationMs < 0)
      throw new Error("Duração do tick inválida.");
    this.count++;
    if (durationMs > this.slowThresholdMs) this.slow++;
    if (this.durations.length < this.sampleLimit) this.durations.push(durationMs);
    else this.durations[this.nextIndex] = durationMs;
    this.nextIndex = (this.nextIndex + 1) % this.sampleLimit;
  }

  snapshot(): TickSummary {
    if (!this.durations.length) return {
      samples: 0, totalTicks: this.count, averageMs: 0, p50Ms: 0,
      p95Ms: 0, p99Ms: 0, maxMs: 0, slowTicks: this.slow,
    };
    const sorted = [...this.durations].sort((a, b) => a - b);
    const nearest = (p: number) => sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
    return {
      samples: sorted.length, totalTicks: this.count,
      averageMs: sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
      p50Ms: nearest(.50), p95Ms: nearest(.95), p99Ms: nearest(.99),
      maxMs: sorted[sorted.length - 1], slowTicks: this.slow,
    };
  }
}
