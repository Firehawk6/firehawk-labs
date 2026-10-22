import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { shuffled, sortSteps, verified } from '../src/scripts/sorter-engine.mjs';
const elements = new Map();
const element = id => {
  if (!elements.has(id)) elements.set(id, { value: '', checked: false, textContent: '', disabled: true });
  return elements.get(id);
};
for (const [id, value] of Object.entries({method:'quick', count:'64', speed:'4000'})) element('sort-'+id).value = value;
element('sort-endless').checked = true;
const ctx = { setTransform(){}, fillRect(){} };
element('sort-canvas').getContext = () => ctx;
element('sort-canvas').getBoundingClientRect = () => ({width:800,height:400});
let now = 0, frameId = 0; const frames = new Map(), handlers = {}, runs = new Set();
const document = { hidden: false, getElementById: element, addEventListener: (name, fn) => { handlers[name] = fn; } };
vm.runInNewContext(readFileSync('src/scripts/sorter.js', 'utf8').replace(/^import[^\n]+\n/, ''), {
  shuffled, sortSteps, verified, document, window: {addEventListener(){}},
  performance: {now: () => now}, devicePixelRatio: 1,
  matchMedia: () => ({matches:false}), crypto:{randomUUID}, AbortController, setTimeout, clearTimeout,
  setInterval(){}, requestAnimationFrame: fn => {frames.set(++frameId, fn); return frameId;}, cancelAnimationFrame: id => frames.delete(id),
  IntersectionObserver: class { observe(){} }, ResizeObserver: class { constructor(fn){this.fn=fn;} observe(){this.fn();} },
  fetch: async (url, options) => {
    if (url.endsWith('/complete')) {
      const run = JSON.parse(options.body).run;
      assert.ok(!runs.has(run), 'Unexpected duplicate completion'); runs.add(run);
    }
    return {ok:true, json:async()=>({total:runs.size})};
  },
});
async function advance(count) {
  for(let i=0;i<count;i++) {
    now+=16; const callbacks=[...frames.values()]; frames.clear(); callbacks.forEach(fn=>fn(now));
    await Promise.resolve(); await Promise.resolve();
  }
}
await advance(300);
assert.equal(runs.size, 0, 'Page load must not start sorting');
assert.equal(element('sort-play').textContent, 'Play');
assert.equal(element('sort-endless').checked, true);
element('sort-play').onclick();
await advance(1200);
assert.ok(runs.size >= 3, 'Endless loop did not finish multiple verified runs');
assert.equal(Number(element('sort-local').textContent), runs.size);
element('sort-play').onclick(); const paused = runs.size;
await advance(300); assert.equal(runs.size, paused, 'Paused run counted');
element('sort-play').onclick();
document.hidden = true; handlers.visibilitychange();
await advance(300); assert.equal(runs.size, paused, 'Hidden tab counted');
document.hidden = false; handlers.visibilitychange();
element('sort-endless').checked = false;
element('sort-new').onclick();
await advance(1200);
assert.equal(runs.size, paused + 1, 'Single run repeated');
assert.equal(element('sort-state').textContent, 'Complete');
element('sort-play').onclick(); await advance(10); element('sort-new').onclick();
assert.equal(runs.size, paused + 1, 'Interrupted run counted');
console.log('PASS: endless cycles count once, pause/hidden suspension, single-run completion and shuffle cancellation');
