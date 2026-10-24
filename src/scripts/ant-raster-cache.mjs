// One reusable atlas: 8,192 chunks / 32 MiB of RGBA pixels, no per-chunk canvases.
export class AntRasterCache {
  constructor(createCanvas, capacity = 8192) {
    this.capacity = capacity;
    this.columns = 128;
    this.image = createCanvas();
    this.image.width = this.columns * 32;
    this.image.height = Math.ceil(capacity / this.columns) * 32;
    this.context = this.image.getContext('2d');
    this.pixels = this.context.createImageData(32, 32);
    this.coarsePixels = null;
    this.entries = new Map();
    this.nextSlot = 0;
    this.color = '';
  }
  clear() {
    this.entries.clear();
    this.nextSlot = 0;
  }
  get(tile, color, level = 1) {
    if (color !== this.color) {
      this.clear();
      this.color = color;
      this.rgb = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16));
    }
    let entry = this.entries.get(tile);
    if (!entry) {
      let slot;
      if (this.entries.size === this.capacity) {
        const oldest = this.entries.keys().next().value;
        slot = this.entries.get(oldest).slot;
        this.entries.delete(oldest);
      } else {
        slot = this.nextSlot++;
      }
      entry = { slot, x: (slot % this.columns) * 32, y: Math.floor(slot / this.columns) * 32, version: -1 };
      this.entries.set(tile, entry);
    }
    if (entry.version !== tile.version || entry.level !== level) {
      let pixels = this.pixels, cells = tile.cells;
      if (level !== 1) {
        this.coarsePixels ??= new Map();
        if (!this.coarsePixels.has(level)) this.coarsePixels.set(level, this.context.createImageData(32 / level, 32 / level));
        pixels = this.coarsePixels.get(level);
        cells = level === 2 ? tile.coarse2 : tile.coarse4;
      }
      const data = pixels.data;
      for (let i = 0; i < cells.length; i++) {
        const p = i * 4;
        data[p] = this.rgb[0]; data[p + 1] = this.rgb[1]; data[p + 2] = this.rgb[2];
        // Density keeps subpixel trails visible instead of dropping cells during nearest-neighbour sampling.
        data[p + 3] = Math.round(255 * Math.sqrt(cells[i] / (level * level)));
      }
      this.context.putImageData(pixels, entry.x, entry.y);
      entry.version = tile.version;
      entry.level = level;
    }
    return entry;
  }
}
