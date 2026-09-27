import assert from 'node:assert/strict';
import test from 'node:test';
import { benchmarkMetrics, buildComparison } from '../src/components/benchmark-model.ts';

const rows = [
  ['A', '120.0±1.1', '100.0±1.0', '0.98±0.01', '6.4±0.1'],
  ['B', '110.0±1.2', '105.0±1.0', '1.00±0.00', '44.7±0.2'],
];
test('changing metric can change the leader and respects higher-is-better scores', () => {
  assert.equal(buildComparison(rows, benchmarkMetrics[0]).leader.method, 'A');
  assert.equal(buildComparison(rows, benchmarkMetrics[1]).leader.method, 'B');
  const score = buildComparison(rows, benchmarkMetrics[3]);
  assert.equal(score.leader.method, 'B');
  assert.equal(score.scale, 1);
  assert.equal(score.next.display, '0.98');
  assert.equal(score.leader.display, '1.00');
  assert.equal(score.next.exact, '0.98±0.01');
});
test('comparison leaves source data intact and uses an enclosing zero-based error scale', () => {
  const before = JSON.stringify(rows);
  const result = buildComparison(rows, benchmarkMetrics[0]);
  assert.equal(JSON.stringify(rows), before);
  assert.equal(result.scale, 50);
  assert.ok(Math.abs(result.gap - 38.3) < 1e-9);
  assert.ok(result.ranked.every(row => row.value / result.scale <= 1));
});
