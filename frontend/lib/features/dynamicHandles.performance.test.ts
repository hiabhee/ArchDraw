/**
 * Performance tests for dynamic handle positioning
 * 
 * Tests performance characteristics to ensure handle calculations meet
 * the 60fps target (16ms per frame) during drag operations.
 * 
 * Requirements:
 * - 2.4: Complete recalculation within 16ms to maintain 60fps
 * - 7.4: Complete calculations for 100 edges within 16ms
 */

import { describe, it, expect } from 'vitest';
import { getDynamicHandles, type NodeRect } from './dynamicHandles';

/**
 * Performance test harness for measuring calculation time
 */
class PerformanceTestHarness {
  /**
   * Measure the execution time of a function in milliseconds
   * @param fn Function to measure
   * @returns Execution time in milliseconds
   */
  static measureExecutionTime(fn: () => void): number {
    const start = performance.now();
    fn();
    const end = performance.now();
    return end - start;
  }

  /**
   * Run a function multiple times and return statistics
   * @param fn Function to measure
   * @param iterations Number of iterations
   * @returns Statistics object with min, max, avg, median, total
   */
  static measureMultipleRuns(
    fn: () => void,
    iterations: number
  ): {
    min: number;
    max: number;
    avg: number;
    median: number;
    total: number;
    runs: number[];
  } {
    const runs: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const time = this.measureExecutionTime(fn);
      runs.push(time);
    }

    const sorted = [...runs].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const total = runs.reduce((sum, time) => sum + time, 0);
    const avg = total / runs.length;
    const median = sorted[Math.floor(sorted.length / 2)];

    return { min, max, avg, median, total, runs };
  }

  /**
   * Generate a random node rectangle for testing
   * @returns Random NodeRect
   */
  static generateRandomNodeRect(): NodeRect {
    return {
      x: Math.random() * 2000 - 1000, // -1000 to 1000
      y: Math.random() * 2000 - 1000,
      width: Math.random() * 400 + 100, // 100 to 500
      height: Math.random() * 300 + 50, // 50 to 350
    };
  }

  /**
   * Generate multiple random node pairs for testing
   * @param count Number of node pairs to generate
   * @returns Array of [source, target] node pairs
   */
  static generateNodePairs(count: number): Array<[NodeRect, NodeRect]> {
    const pairs: Array<[NodeRect, NodeRect]> = [];
    for (let i = 0; i < count; i++) {
      pairs.push([this.generateRandomNodeRect(), this.generateRandomNodeRect()]);
    }
    return pairs;
  }

  /**
   * Measure the time to calculate handles for multiple node pairs
   * @param pairs Array of node pairs
   * @returns Execution time in milliseconds
   */
  static measureBatchCalculation(pairs: Array<[NodeRect, NodeRect]>): number {
    return this.measureExecutionTime(() => {
      for (const [source, target] of pairs) {
        getDynamicHandles(source, target);
      }
    });
  }

  /**
   * Format time in milliseconds with appropriate precision
   * @param ms Time in milliseconds
   * @returns Formatted string
   */
  static formatTime(ms: number): string {
    if (ms < 0.001) {
      return `${(ms * 1000000).toFixed(2)}ns`;
    } else if (ms < 1) {
      return `${(ms * 1000).toFixed(2)}μs`;
    } else {
      return `${ms.toFixed(2)}ms`;
    }
  }

  /**
   * Log performance statistics to console
   * @param label Description of the test
   * @param stats Statistics object
   */
  static logStats(
    label: string,
    stats: {
      min: number;
      max: number;
      avg: number;
      median: number;
      total: number;
    }
  ): void {
    console.log(`\n${label}:`);
    console.log(`  Min:    ${this.formatTime(stats.min)}`);
    console.log(`  Max:    ${this.formatTime(stats.max)}`);
    console.log(`  Avg:    ${this.formatTime(stats.avg)}`);
    console.log(`  Median: ${this.formatTime(stats.median)}`);
    console.log(`  Total:  ${this.formatTime(stats.total)}`);
  }
}

describe('Performance Tests: Dynamic Handle Positioning', () => {
  describe('Performance Test Infrastructure', () => {
    it('should measure execution time accurately', () => {
      const time = PerformanceTestHarness.measureExecutionTime(() => {
        // Simple calculation that should take some time
        let sum = 0;
        for (let i = 0; i < 1000; i++) {
          sum += i;
        }
      });

      // Execution time should be measurable (> 0)
      expect(time).toBeGreaterThanOrEqual(0);
      expect(time).toBeLessThan(100); // Should complete quickly
    });

    it('should generate valid random node rectangles', () => {
      const rect = PerformanceTestHarness.generateRandomNodeRect();

      expect(rect.x).toBeGreaterThanOrEqual(-1000);
      expect(rect.x).toBeLessThanOrEqual(1000);
      expect(rect.y).toBeGreaterThanOrEqual(-1000);
      expect(rect.y).toBeLessThanOrEqual(1000);
      expect(rect.width).toBeGreaterThanOrEqual(100);
      expect(rect.width).toBeLessThanOrEqual(500);
      expect(rect.height).toBeGreaterThanOrEqual(50);
      expect(rect.height).toBeLessThanOrEqual(350);
    });

    it('should generate multiple node pairs', () => {
      const pairs = PerformanceTestHarness.generateNodePairs(10);

      expect(pairs).toHaveLength(10);
      pairs.forEach(([source, target]) => {
        expect(source).toBeDefined();
        expect(target).toBeDefined();
        expect(source.x).toBeDefined();
        expect(target.x).toBeDefined();
      });
    });

    it('should measure multiple runs and return statistics', () => {
      const stats = PerformanceTestHarness.measureMultipleRuns(() => {
        const rect1 = PerformanceTestHarness.generateRandomNodeRect();
        const rect2 = PerformanceTestHarness.generateRandomNodeRect();
        getDynamicHandles(rect1, rect2);
      }, 10);

      expect(stats.runs).toHaveLength(10);
      expect(stats.min).toBeGreaterThanOrEqual(0);
      expect(stats.max).toBeGreaterThanOrEqual(stats.min);
      expect(stats.avg).toBeGreaterThanOrEqual(stats.min);
      expect(stats.avg).toBeLessThanOrEqual(stats.max);
      expect(stats.median).toBeGreaterThanOrEqual(stats.min);
      expect(stats.median).toBeLessThanOrEqual(stats.max);
      expect(stats.total).toBeGreaterThanOrEqual(0);
    });

    it('should format time values correctly', () => {
      expect(PerformanceTestHarness.formatTime(0.0000005)).toContain('ns');
      expect(PerformanceTestHarness.formatTime(0.5)).toContain('μs');
      expect(PerformanceTestHarness.formatTime(5)).toContain('ms');
    });
  });

  describe('Single Calculation Performance', () => {
    it('should measure time for a single handle calculation', () => {
      const source = PerformanceTestHarness.generateRandomNodeRect();
      const target = PerformanceTestHarness.generateRandomNodeRect();

      const time = PerformanceTestHarness.measureExecutionTime(() => {
        getDynamicHandles(source, target);
      });

      // Single calculation should be very fast (< 1ms)
      expect(time).toBeLessThan(1);

      console.log(`\nSingle calculation time: ${PerformanceTestHarness.formatTime(time)}`);
    });

    it('should measure average time across multiple single calculations', () => {
      const stats = PerformanceTestHarness.measureMultipleRuns(() => {
        const source = PerformanceTestHarness.generateRandomNodeRect();
        const target = PerformanceTestHarness.generateRandomNodeRect();
        getDynamicHandles(source, target);
      }, 100);

      // Average should be very fast
      expect(stats.avg).toBeLessThan(1);

      PerformanceTestHarness.logStats('100 single calculations', stats);
    });
  });

  describe('Batch Calculation Performance', () => {
    it('should measure time for 10 edge calculations', () => {
      const pairs = PerformanceTestHarness.generateNodePairs(10);
      const time = PerformanceTestHarness.measureBatchCalculation(pairs);

      // 10 calculations should be very fast (< 5ms)
      expect(time).toBeLessThan(5);

      console.log(`\n10 edge calculations: ${PerformanceTestHarness.formatTime(time)}`);
    });

    it('should measure time for 50 edge calculations', () => {
      const pairs = PerformanceTestHarness.generateNodePairs(50);
      const time = PerformanceTestHarness.measureBatchCalculation(pairs);

      // 50 calculations should be fast (< 10ms)
      expect(time).toBeLessThan(10);

      console.log(`\n50 edge calculations: ${PerformanceTestHarness.formatTime(time)}`);
    });

    it('should calculate handles for 100 edges within 16ms (60fps target)', () => {
      // Requirements 2.4, 7.4: Complete calculations for 100 edges within 16ms
      const pairs = PerformanceTestHarness.generateNodePairs(100);
      const time = PerformanceTestHarness.measureBatchCalculation(pairs);

      // Must complete within 16ms to maintain 60fps during drag operations
      expect(time).toBeLessThan(16);

      console.log(`\n100 edge calculations: ${PerformanceTestHarness.formatTime(time)}`);
      console.log(`Per-edge average: ${PerformanceTestHarness.formatTime(time / 100)}`);
      console.log(`Performance margin: ${PerformanceTestHarness.formatTime(16 - time)} remaining of 16ms budget`);
    });

    it('should measure consistency of 100-edge calculations across multiple runs', () => {
      // Generate a fixed set of node pairs to test consistency
      const pairs = PerformanceTestHarness.generateNodePairs(100);

      const stats = PerformanceTestHarness.measureMultipleRuns(() => {
        for (const [source, target] of pairs) {
          getDynamicHandles(source, target);
        }
      }, 10);

      // All runs should complete within 16ms
      expect(stats.max).toBeLessThan(16);
      expect(stats.avg).toBeLessThan(16);

      PerformanceTestHarness.logStats('100 edges × 10 runs', stats);
      console.log(`Worst case: ${PerformanceTestHarness.formatTime(stats.max)} (must be < 16ms)`);
    });
  });

  describe('Selective Recalculation Performance', () => {
    it('should only recalculate connected edges when a node moves', () => {
      // Simulate 100 node pairs where only one source node moves
      const allPairs = PerformanceTestHarness.generateNodePairs(100);

      // Measure time to recalculate all pairs (simulating all edges on canvas)
      const allTime = PerformanceTestHarness.measureExecutionTime(() => {
        for (const [source, target] of allPairs) {
          getDynamicHandles(source, target);
        }
      });

      // Measure time to recalculate only pairs connected to a specific node
      // (simulating selective recalculation when one node moves)
      const movingNodeId = 0;
      const connectedPairs = allPairs.filter((_, i) => i === movingNodeId);
      const selectiveTime = PerformanceTestHarness.measureExecutionTime(() => {
        for (const [source, target] of connectedPairs) {
          getDynamicHandles(source, target);
        }
      });

      // Selective recalculation should be significantly faster
      expect(selectiveTime).toBeLessThan(allTime);

      console.log(`\nSelective Recalculation Performance:`);
      console.log(`  All 100 edges: ${PerformanceTestHarness.formatTime(allTime)}`);
      console.log(`  Connected edges (1): ${PerformanceTestHarness.formatTime(selectiveTime)}`);
      console.log(`  Ratio: ${(allTime / Math.max(selectiveTime, 0.000001)).toFixed(1)}x faster`);
    });

    it('should maintain < 16ms for 100 edges after a single node changes position', () => {
      // Generate fixed pairs, simulate one node moving
      const pairs = PerformanceTestHarness.generateNodePairs(100);

      // Initial calculation of all edges
      const initialTime = PerformanceTestHarness.measureBatchCalculation(pairs);

      // Simulate one node moving (update its position)
      const movedPairs: Array<[NodeRect, NodeRect]> = pairs.map(([source, target], i) => {
        if (i === 0) {
          return [
            { ...source, x: source.x + 50, y: source.y + 30 },
            target,
          ];
        }
        return [source, target];
      });

      // Recalculate with moved node
      const recalculationTime = PerformanceTestHarness.measureBatchCalculation(movedPairs);

      // Both should be well under 16ms
      expect(initialTime).toBeLessThan(16);
      expect(recalculationTime).toBeLessThan(16);

      console.log(`\nPost-move recalculation:`);
      console.log(`  Initial: ${PerformanceTestHarness.formatTime(initialTime)}`);
      console.log(`  After node move: ${PerformanceTestHarness.formatTime(recalculationTime)}`);
    });
  });

  describe('Performance Test Harness Validation', () => {
    it('should provide consistent measurements', () => {
      const pairs = PerformanceTestHarness.generateNodePairs(20);

      // Warm up to compile and stabilize JIT execution
      for (let i = 0; i < 20; i++) {
        PerformanceTestHarness.measureBatchCalculation(pairs);
      }

      // Run the same calculation multiple times
      const times: number[] = [];
      for (let i = 0; i < 10; i++) {
        const time = PerformanceTestHarness.measureBatchCalculation(pairs);
        times.push(time);
      }

      // Drop the top and bottom outliers for a more stable comparison
      times.sort((a, b) => a - b);
      const trimmed = times.slice(2, -2);
      const min = trimmed[0];
      const max = trimmed[trimmed.length - 1];

      // Trimmed times should be relatively consistent (within 5x of each other)
      expect(max / min).toBeLessThan(5);

      console.log(`\nConsistency check (20 edges, 10 runs, trimmed): ${trimmed.map(t => PerformanceTestHarness.formatTime(t)).join(', ')}`);
    });
  });
});
