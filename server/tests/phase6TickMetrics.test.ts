import assert from "node:assert/strict";
import { test } from "node:test";
import { TickMetrics } from "../src/game/core/tickMetrics";

test("nearest-rank p50/p95/p99 with deterministic workload", () => {
  const metrics = new TickMetrics(200, 80);
  for (let i = 1; i <= 100; i++) metrics.record(i);
  const snapshot = metrics.snapshot();
  assert.equal(snapshot.samples, 100);
  assert.equal(snapshot.totalTicks, 100);
  assert.equal(snapshot.averageMs, 50.5);
  assert.equal(snapshot.p50Ms, 50);
  assert.equal(snapshot.p95Ms, 95);
  assert.equal(snapshot.p99Ms, 99);
  assert.equal(snapshot.maxMs, 100);
  assert.equal(snapshot.slowTicks, 20);
});

test("ring buffer stores bounded recent 4 samples without losing total count", () => {
  const m = new TickMetrics(4, 250);
  for (let i = 1; i <= 8; i++) m.record(i);
  const s = m.snapshot();
  assert.deepEqual([s.samples,s.totalTicks,s.p50Ms,s.p95Ms,s.p99Ms,s.maxMs],
    [4,8,6,8,8,8]);
  assert.equal(s.slowTicks, 0);
});

test("empty snapshot and invalid measurements handled explicitly", () => {
  const m = new TickMetrics();
  assert.equal(m.snapshot().p99Ms, 0);
  assert.throws(() => m.record(NaN), /inválida/);
  assert.throws(() => m.record(-1), /inválida/);
  assert.throws(() => new TickMetrics(0), /positivos/);
});
