/**
 * #388: Prometheus-compatible metrics for Prisma connection pool.
 * #436: Heap usage ratio gauge and heap dump counter for memory leak detection.
 *
 * Instruments Prisma middleware to track:
 *  - prisma_pool_wait_seconds   – time spent waiting to acquire a connection (histogram)
 *  - prisma_pool_acquire_seconds – total time from request to first query byte (histogram)
 *  - prisma_pool_exhausted_total – P2024 (pool timeout) error counter
 *
 * Memory metrics:
 *  - nodejs_heap_used_ratio     – heapUsed / heap_size_limit (0–1 gauge)
 *  - nodejs_heap_dump_total     – number of heap snapshots written to disk
 *
 * Also collects default Node.js process metrics (event loop, memory, CPU).
 */
import { Registry, Histogram, Counter, Gauge, collectDefaultMetrics } from "prom-client";

export const registry = new Registry();

collectDefaultMetrics({ register: registry });

export const poolWaitHistogram = new Histogram({
  name: "prisma_pool_wait_seconds",
  help: "Time in seconds a query spent waiting for a connection from the pool",
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [registry],
});

export const poolAcquireHistogram = new Histogram({
  name: "prisma_pool_acquire_seconds",
  help: "Total time in seconds from query start to first result (includes pool wait + query)",
  labelNames: ["model", "action"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry],
});

export const poolExhaustedCounter = new Counter({
  name: "prisma_pool_exhausted_total",
  help: "Total number of P2024 connection pool timeout errors",
  registers: [registry],
});

// #436: heap usage ratio — heapUsed divided by the effective V8 heap size limit.
// Values approaching 1.0 indicate a potential memory leak.
export const heapUsedRatioGauge = new Gauge({
  name: "nodejs_heap_used_ratio",
  help: "Ratio of V8 heapUsed to heap_size_limit (0–1). Values near 1 indicate potential memory leak.",
  registers: [registry],
});

export const heapDumpCounter = new Counter({
  name: "nodejs_heap_dump_total",
  help: "Total number of heap snapshots written to disk by the leak detector.",
  registers: [registry],
});
