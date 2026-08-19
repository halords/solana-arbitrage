import { describe, it, expect } from 'vitest';
import { LatencyProfiler } from '../src/profiler.js';

describe('LatencyProfiler', () => {
  it('should accurately measure synchronous function execution time', () => {
    const profiler = new LatencyProfiler(100);

    const result = profiler.measure('math_computation', () => {
      let sum = 0;
      for (let i = 0; i < 1000; i++) sum += i;
      return sum;
    });

    expect(result).toBe(499500);
    const stats = profiler.getPercentiles('math_computation');
    expect(stats).not.toBeNull();
    expect(stats?.count).toBe(1);
    expect(stats?.p50Us).toBeGreaterThan(0);
  });

  it('should compute valid P50, P95, and P99 percentiles across multiple samples', () => {
    const profiler = new LatencyProfiler(100);

    for (let i = 1; i <= 100; i++) {
      profiler.recordStage('sample_stage', i * 10); // 10us to 1000us
    }

    const stats = profiler.getPercentiles('sample_stage');
    expect(stats).not.toBeNull();
    expect(stats?.count).toBe(100);
    expect(stats?.minUs).toBe(10);
    expect(stats?.maxUs).toBe(1000);
    expect(stats?.p50Us).toBe(510);
    expect(stats?.p95Us).toBe(960);
    expect(stats?.p99Us).toBe(1000);
  });
});
