import assert from 'node:assert/strict';
import { AntWorld } from '../src/scripts/ant-engine.mjs';
import { AntRasterCache } from '../src/scripts/ant-raster-cache.mjs';
const world = new AntWorld();
for (let i = 0; i < 10000; i++) world.flip((i * 17 % 127) - 64, (i * 31 % 113) - 57);
for (const tile of world.tiles.values()) {
  for (const level of [2, 4]) {
    const expected = new Uint8Array(1024 / level ** 2);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      expected[Math.floor(y / level) * (32 / level) + Math.floor(x / level)] += tile.cells[y * 32 + x];
    }
    assert.deepEqual(tile['coarse' + level], expected, 'Coarse counts must match exact cells after flips, including negative coordinates');
  }
}
let upload;
const cache = new AntRasterCache(() => ({ getContext: () => ({
  createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
  putImageData: p => { upload = { ...p, data: p.data.slice() }; },
}) }));
const isolated = new AntWorld(); isolated.flip(3, 3);
const tile = isolated.tiles.get('0,0');
cache.get(tile, '#ff8b83', 4);
assert.equal(upload.width, 8);
assert.equal(upload.data.length, 256, 'Maximum zoom-out uploads 16x fewer pixels per changed tile');
assert.equal(upload.data[3], 64, 'An isolated subpixel trail remains visible');
assert.equal(upload.data.filter((v, i) => i % 4 === 3 && v > 0).length, 1);
cache.get(tile, '#ff8b83', 2); assert.equal(upload.width, 16);
cache.get(tile, '#ff8b83', 1); assert.equal(upload.width, 32);
assert.equal(upload.data[(3 * 32 + 3) * 4 + 3], 255, 'Zooming in restores exact cells without a simulation tick');
isolated.flip(3, 3);
assert.ok(tile.coarse4.every(v => v === 0));
cache.get(tile, '#ff8b83', 4); assert.equal(upload.data[3], 0);
console.log('PASS: incremental density matches exact cells; 16x fewer upload pixels at widest zoom, isolated trails, zoom transitions and clearing');
