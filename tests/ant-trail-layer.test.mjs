import assert from 'node:assert/strict';
import { AntWorld } from '../src/scripts/ant-engine.mjs';
import { AntTrailLayer } from '../src/scripts/ant-trail-layer.mjs';
let uploads = 0, draws = 0, fills = 0;
const layer = new AntTrailLayer(() => ({ getContext: () => ({
  createImageData: () => ({ data: new Uint8ClampedArray(4096) }),
  putImageData: () => uploads++, drawImage: () => draws++, fillRect: () => fills++,
}) }));
const world = new AntWorld();
// More visible chunks than the 8,192-entry atlas can retain.
for (let y = 0; y < 100; y++) for (let x = 0; x < 100; x++) world.flip(x * 32, y * 32);
const view = { width: 1000, height: 1000, scale: .25, ox: 0, oy: 0, dpr: 1.25, background: '#0b0b0d', foreground: '#ff8b83' };
assert.equal(layer.update(world, view), 10000);
assert.equal(uploads, 10000);
for (let i = 0; i < 10; i++) assert.equal(layer.update(world, view), 0);
assert.equal(uploads, 10000, 'History exceeding the atlas must not cause repeated uploads');
world.flip(1, 1);
assert.equal(layer.update(world, view), 1);
assert.equal(uploads, 10001);
world.flip(1, 1); world.flip(0, 0);
const previousDraws = draws, previousFills = fills;
assert.equal(layer.update(world, view), 1);
assert.equal(draws, previousDraws, 'Deleted chunk must only clear its pixels');
assert.equal(fills, previousFills + 1);
world.flip(-32, -32);
assert.equal(layer.update(world, view), 0);
assert.equal(world.changed.size, 0);
assert.equal(layer.update(world, { ...view, ox: 8, oy: 8 }), 10000, 'Pan recovers offscreen changes');
assert.equal(layer.update(world, { ...view, foreground: '#ffffff' }), 9999);
layer.invalidate(); assert.equal(layer.update(world, view), 9999);
assert.equal(layer.update(new AntWorld(), view), 0, 'Reset clears retained history');
console.log('PASS: 10,000 chunks retained without repeat uploads; localized edits, deletion, offscreen changes, pan, palette, invalidation and reset');
