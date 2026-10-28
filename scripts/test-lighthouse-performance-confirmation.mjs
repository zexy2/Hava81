import assert from 'node:assert/strict';
import {
  median,
  medianAuditNumericValue,
  medianCategoryScore,
  shouldRepeatPerformanceMeasurement,
} from './lib/lighthouse-performance-confirmation.mjs';

for (const [score, expected] of [
  [0.57, true],
  [0.79, true],
  [0.8, false],
  [0.81, false],
  [undefined, false],
  [Number.NaN, false],
  [Number.POSITIVE_INFINITY, false],
]) {
  assert.equal(shouldRepeatPerformanceMeasurement(score), expected, `repeat decision for ${score}`);
}

assert.equal(median([]), null);
assert.equal(median([0.7]), 0.7);
assert.ok(Math.abs(median([0.57, 0.77]) - 0.67) < 1e-9);
assert.equal(median([0.57, 0.77, 0.9]), 0.77);
assert.equal(median([4, 1, 3, 2]), 2.5);

const reports = [
  {
    categories: { performance: { score: 0.57 } },
    audits: {
      'total-blocking-time': { numericValue: 2_600 },
      'cumulative-layout-shift': { numericValue: 0.013 },
    },
  },
  {
    categories: { performance: { score: 0.77 } },
    audits: {
      'total-blocking-time': { numericValue: 1_800 },
      'cumulative-layout-shift': { numericValue: 0.017 },
    },
  },
];
assert.ok(Math.abs(medianCategoryScore(reports, 'performance') - 0.67) < 1e-9);
assert.equal(medianAuditNumericValue(reports, 'total-blocking-time'), 2_200);
assert.ok(Math.abs(medianAuditNumericValue(reports, 'cumulative-layout-shift') - 0.015) < 1e-9);
assert.ok(medianCategoryScore(reports, 'performance') >= 0.6, 'a single low sample should not fail the hard floor when the median clears it');

console.log('Lighthouse target-based performance confirmation and median contract: PASS');
