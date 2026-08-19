export interface LatencySample {
  readonly stage: string;
  readonly durationUs: number; // microseconds
  readonly timestamp: Date;
}

export interface LatencyPercentiles {
  readonly count: number;
  readonly minUs: number;
  readonly p50Us: number; // Median
  readonly p95Us: number;
  readonly p99Us: number;
  readonly maxUs: number;
  readonly meanUs: number;
}

export class LatencyProfiler {
  private readonly maxSamples: number;
  private readonly stageSamples = new Map<string, number[]>();

  constructor(maxSamples = 1000) {
    this.maxSamples = maxSamples;
  }

  public recordStage(stage: string, durationUs: number): void {
    let samples = this.stageSamples.get(stage);
    if (!samples) {
      samples = [];
      this.stageSamples.set(stage, samples);
    }

    samples.push(durationUs);
    if (samples.length > this.maxSamples) {
      samples.shift();
    }
  }

  public measure<T>(stage: string, fn: () => T): T {
    const start = process.hrtime.bigint();
    try {
      return fn();
    } finally {
      const elapsedNs = process.hrtime.bigint() - start;
      const elapsedUs = Number(elapsedNs) / 1000;
      this.recordStage(stage, elapsedUs);
    }
  }

  public async measureAsync<T>(stage: string, fn: () => Promise<T>): Promise<T> {
    const start = process.hrtime.bigint();
    try {
      return await fn();
    } finally {
      const elapsedNs = process.hrtime.bigint() - start;
      const elapsedUs = Number(elapsedNs) / 1000;
      this.recordStage(stage, elapsedUs);
    }
  }

  public getPercentiles(stage: string): LatencyPercentiles | null {
    const samples = this.stageSamples.get(stage);
    if (!samples || samples.length === 0) return null;

    const sorted = [...samples].sort((a, b) => a - b);
    const count = sorted.length;
    const minUs = sorted[0] ?? 0;
    const maxUs = sorted[count - 1] ?? 0;
    const meanUs = sorted.reduce((acc, val) => acc + val, 0) / count;

    const p50Index = Math.floor(count * 0.5);
    const p95Index = Math.min(count - 1, Math.floor(count * 0.95));
    const p99Index = Math.min(count - 1, Math.floor(count * 0.99));

    return {
      count,
      minUs: parseFloat(minUs.toFixed(2)),
      p50Us: parseFloat((sorted[p50Index] ?? 0).toFixed(2)),
      p95Us: parseFloat((sorted[p95Index] ?? 0).toFixed(2)),
      p99Us: parseFloat((sorted[p99Index] ?? 0).toFixed(2)),
      maxUs: parseFloat(maxUs.toFixed(2)),
      meanUs: parseFloat(meanUs.toFixed(2)),
    };
  }

  public getAllStageMetrics(): Record<string, LatencyPercentiles> {
    const result: Record<string, LatencyPercentiles> = {};
    for (const stage of this.stageSamples.keys()) {
      const percentiles = this.getPercentiles(stage);
      if (percentiles) {
        result[stage] = percentiles;
      }
    }
    return result;
  }

  public clear(): void {
    this.stageSamples.clear();
  }
}
