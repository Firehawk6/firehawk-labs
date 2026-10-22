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
    this.entries = new Map();
    this.nextSlot = 0;
    this.color = '';
  }
  clear() {
    this.entries.clear();
    this.nextSlot = 0;
  }
  get(tile, color) {
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
    if (entry.version !== tile.version) {
      const data = this.pixels.data;
      for (let i = 0; i < 1024; i++) {
        const p = i * 4;
        data[p] = this.rgb[0]; data[p + 1] = this.rgb[1]; data[p + 2] = this.rgb[2];
        data[p + 3] = tile.cells[i] ? 255 : 0;
      }
      this.context.putImageData(this.pixels, entry.x, entry.y);
      entry.version = tile.version;
    }
    return entry;
  }
}
