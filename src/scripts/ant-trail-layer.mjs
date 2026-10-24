import { TILE } from './ant-engine.mjs';
import { AntRasterCache } from './ant-raster-cache.mjs';

// Retain the viewport, so historical cells cost no redraw work between camera moves.
export class AntTrailLayer {
  constructor(createCanvas) {
    this.image = createCanvas();
    this.context = this.image.getContext('2d', { alpha: false });
    this.cache = new AntRasterCache(createCanvas);
    this.view = null;
    this.world = null;
  }
  invalidate() { this.view = null; }
  update(world, view) {
    const full = this.world !== world || !this.view || Object.keys(view).some(k => view[k] !== this.view[k]);
    if (this.world !== world) this.cache.clear();
    this.world = world;
    this.view = { ...view };
    const { width, height, dpr, scale, ox, oy, background, foreground } = view;
    const w = Math.round(width * dpr), h = Math.round(height * dpr);
    if (this.image.width !== w || this.image.height !== h) {
      this.image.width = w; this.image.height = h;
    }
    const ctx = this.context;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = background;
    if (full) ctx.fillRect(0, 0, w, h);
    const size = TILE * scale;
    const level = scale * dpr <= .25 ? 4 : scale * dpr <= .5 ? 2 : 1;
    const minX = Math.floor(-ox / size), maxX = Math.floor((width - ox) / size);
    const minY = Math.floor(-oy / size), maxY = Math.floor((height - oy) / size);
    let drawn = 0;
    const paint = (tx, ty, tile) => {
      if (tx < minX || tx > maxX || ty < minY || ty > maxY) return;
      // Shared integer boundaries prevent dirty chunks erasing a neighbour at fractional zoom.
      const x = Math.round((ox + tx * size) * dpr), y = Math.round((oy + ty * size) * dpr);
      const tw = Math.round((ox + (tx + 1) * size) * dpr) - x;
      const th = Math.round((oy + (ty + 1) * size) * dpr) - y;
      if (!full) ctx.fillRect(x, y, tw, th);
      if (tile) {
        const entry = this.cache.get(tile, foreground, level);
        ctx.drawImage(this.cache.image, entry.x, entry.y, TILE / level, TILE / level, x, y, tw, th);
      }
      drawn++;
    };
    if (full) {
      const area = (maxX - minX + 1) * (maxY - minY + 1);
      if (area > world.tiles.size) {
        for (const tile of world.tiles.values()) paint(tile.tx, tile.ty, tile);
      } else {
        for (let ty = minY; ty <= maxY; ty++) for (let tx = minX; tx <= maxX; tx++) {
          const tile = world.tiles.get(tx + ',' + ty);
          if (tile) paint(tx, ty, tile);
        }
      }
    } else {
      for (const key of world.changed) {
        const tile = world.tiles.get(key);
        if (tile) paint(tile.tx, tile.ty, tile);
        else {
          const comma = key.indexOf(',');
          paint(Number(key.slice(0, comma)), Number(key.slice(comma + 1)), null);
        }
      }
    }
    // Offscreen mutations are recovered by the next full viewport redraw.
    world.changed.clear();
    return drawn;
  }
}
