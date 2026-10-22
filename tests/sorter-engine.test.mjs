import assert from 'node:assert/strict';
import { shuffled, sortSteps, verified } from '../src/scripts/sorter-engine.mjs';
let seed = 42;
const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
for (const method of ['quick', 'merge', 'insertion']) {
  for (const count of [1, 64, 128, 256, 512]) {
    for (const values of [shuffled(count, random), Array.from({length:count}, (_,i)=>count-i), Array.from({length:count}, (_,i)=>i+1)]) {
      let steps = 0;
      for (const highlights of sortSteps(values, method)) {
        assert.ok(highlights.every(i => i >= 0 && i < count));
        assert.ok(++steps < 1000000);
      }
      assert.ok(verified(values, count), method + ' failed at ' + count);
    }
  }
}
assert.equal(verified([1, 1, 3], 3), false);
assert.equal(verified([1, 3, 2], 3), false);
assert.equal(verified([1, 2], 3), false);
console.log('PASS: all three algorithms, 1–512 bars, shuffled/reverse/sorted inputs and invalid verification');
