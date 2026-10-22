import assert from 'node:assert/strict';
import { AntRasterCache } from '../src/scripts/ant-raster-cache.mjs';
let canvases = 0, buffers = 0, uploads = 0, last;
const cache = new AntRasterCache(() => {
  canvases++;
  return { getContext: () => ({
    createImageData: () => { buffers++; return { data: new Uint8ClampedArray(4096) }; },
    putImageData: (image, x, y) => { uploads++; last = { data: image.data.slice(), x, y }; },
  }) };
});
const tiles = Array.from({ length: 6000 }, () => ({ cells: new Uint8Array(1024), version: 0 }));
tiles[0].cells[0] = 1;
cache.get(tiles[0], '#ff8b83');
assert.deepEqual([...last.data.slice(0, 8)], [255,139,131,255,255,139,131,0]);
for (let frame = 0; frame < 5; frame++) for (const tile of tiles) cache.get(tile, '#ff8b83');
assert.equal(uploads, 6000, 'Unchanged visible tiles must not be rebuilt each frame');
tiles[0].cells[0] = 0; tiles[0].version++;
cache.get(tiles[0], '#ff8b83'); assert.equal(last.data[3], 0);
cache.get(tiles[0], '#ffffff'); assert.equal(last.data[0], 255); assert.equal(last.data[1], 255);
for (let i = 0; i < 20000; i++) cache.get({ cells: tiles[0].cells, version: 0 }, '#ffffff');
assert.equal(cache.entries.size, 8192); assert.equal(canvases, 1); assert.equal(buffers, 1);
assert.ok(last.x < cache.image.width && last.y < cache.image.height);
cache.clear(); cache.get(tiles[0], '#ffffff'); assert.equal(cache.entries.size, 1);
assert.equal(canvases, 1); assert.equal(buffers, 1);
console.log('PASS: 6,000 visible tiles reused across frames; bounded eviction, palette changes, cell clearing and reset use one canvas and buffer');
