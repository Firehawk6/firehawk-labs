import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
let clock = 0, nextFrame, presentations = 0, steps = 0;
const elements = new Map();
const ctx = new Proxy({}, { get: () => () => {} });
const element = id => {
  if (!elements.has(id)) elements.set(id, { value: id === 'ant-theme' ? 'labs' : id === 'ant-speed' ? '4' : '1', checked: false,
    addEventListener() {}, getContext: () => ctx, getBoundingClientRect: () => ({ width: 800, height: 600 }),
    reportValidity: () => true });
  return elements.get(id);
};
class World {
  constructor() { this.ants = [{ x: 0, y: 0, dir: 0 }]; this.ticks = 0; this.active = 0; }
  step() { this.ticks++; steps++; return true; }
}
class Trails { constructor() { this.image = {}; } invalidate() {} update() { presentations++; } }
const context = {
  AntWorld: World, AntTrailLayer: Trails,
  document: { getElementById: element, hidden: false, addEventListener() {} },
  window: { devicePixelRatio: 1, addEventListener() {} },
  performance: { now: () => { clock += .25; return clock; } },
  requestAnimationFrame: cb => { nextFrame = cb; return 1; }, cancelAnimationFrame() {},
  ResizeObserver: class { constructor(cb) { this.cb = cb; } observe() { this.cb(); } },
  IntersectionObserver: class { observe() {} },
};
const source = fs.readFileSync(new URL('../src/scripts/langtons-ant.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '');
vm.runInNewContext(source, context);
function frame(time) { clock = time; const cb = nextFrame; nextFrame = null; cb(time); }
frame(0);
for (let i = 0; i < 30; i++) element('ant-out').onclick();
frame(1);
element('ant-play').onclick();
presentations = 0; steps = 0;
for (let i = 1; i <= 120; i++) frame(1 + i * 1000 / 120);
assert.ok(presentations >= 28 && presentations <= 31, 'Wide view should present at about 30 FPS on a 120 Hz monitor');
assert.ok(steps > 0 && steps < 1000, 'Simulation budget must leave CPU headroom rather than run to the selected 30k tick rate');
element('ant-play').onclick(); element('ant-in').onclick();
const before = presentations; frame(1002);
assert.equal(presentations, before + 1, 'Paused camera interactions must render immediately');
console.log('PASS: wide-view cadence on 120 Hz, bounded simulation work, immediate paused zoom');
