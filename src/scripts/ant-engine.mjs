// Pure simulation; no DOM, rendering, or timers.
export const TILE = 32;
export class AntWorld {
  constructor({ count = 1, maxAnts = 1500, spawn = false, random = Math.random, maxTiles = 65536 } = {}) {
    this.tiles = new Map();
    this.ants = [];
    this.ticks = 0;
    this.active = 0;
    this.limit = false;
    this.random = random;
    this.spawn = spawn;
    this.maxAnts = Math.max(1, Math.min(1500, Math.floor(maxAnts) || 1500));
    this.maxTiles = Math.max(1, Math.min(65536, Math.floor(maxTiles) || 65536));
    this.radius = 100;
    count = Math.max(1, Math.min(100, this.maxAnts, Math.floor(count) || 1));
    // Unique positions without random-placement retry loops.
    for (let i = 0; i < count; i++) {
      this.ants.push(count === 1 ? { x: 0, y: 0, dir: 0 } :
        { x: (i % 10) * 4 - 18, y: Math.floor(i / 10) * 4 - 18, dir: Math.floor(random() * 4) });
    }
  }
  get(x, y) {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    return this.tiles.get(tx + "," + ty)?.cells[(y - ty * TILE) * TILE + x - tx * TILE] || 0;
  }
  flip(x, y) {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE), key = tx + "," + ty;
    let tile = this.tiles.get(key);
    if (!tile) {
      if (this.tiles.size >= this.maxTiles) { this.limit = true; return false; }
      tile = { cells: new Uint8Array(TILE * TILE), count: 0, version: 0 };
      this.tiles.set(key, tile);
    }
    const index = (y - ty * TILE) * TILE + x - tx * TILE;
    const delta = tile.cells[index] ? -1 : 1;
    tile.cells[index] ^= 1;
    tile.count += delta;
    tile.version++;
    this.active += delta;
    if (tile.count === 0) this.tiles.delete(key);
    return true;
  }
  step() {
    if (this.limit) return false;
    // Preflight allocation so a memory-limit pause never leaves a partial tick.
    const missing = new Set();
    for (const ant of this.ants) {
      const key = Math.floor(ant.x / TILE) + "," + Math.floor(ant.y / TILE);
      if (!this.tiles.has(key)) missing.add(key);
    }
    if (this.tiles.size + missing.size > this.maxTiles) { this.limit = true; return false; }
    for (const ant of this.ants) {
      const state = this.get(ant.x, ant.y);
      this.flip(ant.x, ant.y);
      ant.dir = (ant.dir + (state === 0 ? 1 : 3)) % 4;
      if (ant.dir === 0) ant.y--;
      else if (ant.dir === 1) ant.x++;
      else if (ant.dir === 2) ant.y++;
      else ant.x--;
    }
    if (this.spawn && this.ants.length < this.maxAnts) {
      const positions = new Set();
      for (const ant of this.ants) {
        const key = ant.x + "," + ant.y;
        if (positions.has(key)) {
          this.ants.push({
            x: Math.floor(this.random() * (2 * this.radius + 1)) - this.radius,
            y: Math.floor(this.random() * (2 * this.radius + 1)) - this.radius,
            dir: Math.floor(this.random() * 4),
          });
          this.radius = Math.min(10000, this.radius + 2);
          break;
        }
        positions.add(key);
      }
    }
    this.ticks++;
    return true;
  }
}
