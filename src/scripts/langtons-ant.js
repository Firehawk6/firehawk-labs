import { AntWorld, TILE } from "./ant-engine.mjs";

const root = document.getElementById("ant-lab");
if (root) init();

function init() {
  const el = id => document.getElementById("ant-" + id);
  const canvas = el("canvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) { el("state").textContent = "Canvas is unavailable in this browser."; return; }
  const palettes = {
    labs: ["#070d0b", "#6dff9b", "#ffbd69"],
    classic: ["#222222", "#ffffff", "#e74c3c"],
    neon: ["#000000", "#39ff14", "#00eaff"],
    minic: ["#13dcfa", "#f90018", "#00ffea"],
    jerm: ["#000000", "#B51C1C", "#EF6594"],
  };
  const speeds = [1, 60, 600, 6000, 30000];
  let world = new AntWorld(), cache = new WeakMap();
  let running = false, visible = true, dirty = true, frame = 0;
  let width = 0, height = 0, dpr = 1, scale = 10, ox = 0, oy = 0;
  let last = 0, debt = 0, sampleTime = 0, sampleTicks = 0, lastStats = 0;
  let applied = { count: 1, maxAnts: 100, spawn: false };
  let drag = null;

  function status() {
    el("play").textContent = running ? "Pause" : "Play";
    el("step").disabled = running || world.limit;
    el("play").disabled = world.limit;
    el("state").textContent = world.limit ? "Memory limit reached — reset to continue" :
      running ? ((!visible || document.hidden) ? "Suspended while out of view" : "Running") : "Paused — ready to explore";
  }
  function stats(now, force = false) {
    if (!force && now - lastStats < 250) return;
    el("ticks").textContent = world.ticks.toLocaleString();
    el("total").textContent = world.ants.length.toLocaleString();
    el("cells").textContent = world.active.toLocaleString();
    if (now - sampleTime >= 500 || force) {
      el("rate").textContent = running && visible && !document.hidden ?
        Math.round((world.ticks - sampleTicks) * 1000 / Math.max(1, now - sampleTime)).toLocaleString() : "0";
      sampleTicks = world.ticks; sampleTime = now;
    }
    lastStats = now;
  }
  function schedule() {
    if (!frame && visible && !document.hidden) frame = requestAnimationFrame(loop);
  }
  function change() { dirty = true; schedule(); }
  function center() {
    const ant = world.ants[0];
    ox = width / 2 - (ant.x + .5) * scale;
    oy = height / 2 - (ant.y + .5) * scale;
    change();
  }
  function draw() {
    const colors = palettes[el("theme").value];
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = colors[0];
    ctx.fillRect(0, 0, width, height);
    const size = TILE * scale;
    const minX = Math.floor(-ox / size), maxX = Math.floor((width - ox) / size);
    const minY = Math.floor(-oy / size), maxY = Math.floor((height - oy) / size);
    // Look up only visible chunks. Cache rasterized chunks until their contents change.
    for (let ty = minY; ty <= maxY; ty++) for (let tx = minX; tx <= maxX; tx++) {
      const tile = world.tiles.get(tx + "," + ty);
      if (!tile) continue;
      let entry = cache.get(tile);
      if (!entry) {
        const image = document.createElement("canvas");
        image.width = image.height = TILE;
        entry = { image, context: image.getContext("2d"), version: -1 };
        cache.set(tile, entry);
      }
      if (entry.version !== tile.version) {
        const c = entry.context;
        c.clearRect(0, 0, TILE, TILE); c.fillStyle = colors[1];
        for (let i = 0; i < tile.cells.length; i++) if (tile.cells[i]) c.fillRect(i % TILE, Math.floor(i / TILE), 1, 1);
        entry.version = tile.version;
      }
      ctx.drawImage(entry.image, ox + tx * size, oy + ty * size, size, size);
    }
    ctx.fillStyle = colors[2];
    for (const ant of world.ants) {
      const x = ox + (ant.x + .5) * scale, y = oy + (ant.y + .5) * scale;
      if (x < -scale || y < -scale || x > width + scale || y > height + scale) continue;
      ctx.save(); ctx.translate(x, y); ctx.rotate(ant.dir * Math.PI / 2);
      const s = Math.max(3, scale * .42);
      ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * .8, s); ctx.lineTo(-s * .8, s);
      ctx.closePath(); ctx.fill(); ctx.restore();
    }
    dirty = false;
  }
  function loop(now) {
    frame = 0;
    if (!visible || document.hidden) { last = 0; return; }
    if (running) {
      const elapsed = last ? Math.min(100, now - last) : 0;
      const rate = speeds[Number(el("speed").value)];
      debt = Math.min(debt + elapsed * rate / 1000, Math.max(1, rate / 10));
      const start = performance.now();
      let steps = 0;
      while (debt >= 1 && performance.now() - start < 5) {
        if (!world.step()) { running = false; status(); break; }
        debt--; steps++;
      }
      if (steps) {
        dirty = true;
        if (el("follow").checked) {
          const a = world.ants[0]; ox = width / 2 - (a.x + .5) * scale; oy = height / 2 - (a.y + .5) * scale;
        }
      }
    }
    last = now;
    if (dirty) draw();
    stats(now);
    if (running) schedule();
  }
  function reset() {
    running = false; debt = 0; last = 0;
    world = new AntWorld(applied); cache = new WeakMap();
    sampleTime = performance.now(); sampleTicks = 0;
    scale = applied.count === 1 ? 10 : 6;
    center(); status(); stats(performance.now(), true);
  }
  el("play").onclick = () => { running = !running; last = 0; debt = 0; status(); stats(performance.now(), true); schedule(); };
  el("step").onclick = () => { if (!running) { world.step(); status(); if (el("follow").checked) center(); change(); stats(performance.now(), true); } };
  el("reset").onclick = reset;
  el("apply").onclick = () => {
    if (!el("count").reportValidity() || !el("cap").reportValidity()) return;
    const count = Math.max(1, Math.min(100, Number(el("count").value) || 1));
    const maxAnts = Math.max(count, Math.min(500, Number(el("cap").value) || 100));
    el("count").value = String(count); el("cap").value = String(maxAnts);
    applied = { count, maxAnts, spawn: el("spawn").checked }; reset();
  };
  el("speed").oninput = () => { el("speed-value").textContent = speeds[Number(el("speed").value)].toLocaleString() + " ticks/s"; debt = 0; };
  el("theme").onchange = () => { cache = new WeakMap(); change(); };
  el("follow").onchange = () => { if (el("follow").checked) center(); };
  el("center").onclick = center;
  function zoom(factor, x = width / 2, y = height / 2) {
    const next = Math.max(2, Math.min(40, scale * factor));
    ox = x - (x - ox) * next / scale; oy = y - (y - oy) * next / scale;
    scale = next; change();
  }
  el("in").onclick = () => zoom(1.25);
  el("out").onclick = () => zoom(.8);
  canvas.addEventListener("wheel", event => {
    event.preventDefault(); const rect = canvas.getBoundingClientRect();
    zoom(event.deltaY < 0 ? 1.1 : 1 / 1.1, event.clientX - rect.left, event.clientY - rect.top);
  }, { passive: false });
  canvas.addEventListener("pointerdown", event => {
    if (drag || event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId); el("follow").checked = false;
  });
  canvas.addEventListener("pointermove", event => {
    if (!drag || drag.id !== event.pointerId) return;
    ox += event.clientX - drag.x; oy += event.clientY - drag.y;
    drag.x = event.clientX; drag.y = event.clientY; change();
  });
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"]) canvas.addEventListener(event, () => { drag = null; });
  canvas.addEventListener("keydown", event => {
    const moves = { ArrowLeft: [40, 0], ArrowRight: [-40, 0], ArrowUp: [0, 40], ArrowDown: [0, -40] };
    if (moves[event.key]) {
      event.preventDefault(); el("follow").checked = false;
      ox += moves[event.key][0]; oy += moves[event.key][1]; change();
    }
  });
  el("save").onclick = () => {
    if (dirty) draw();
    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob), link = document.createElement("a");
      link.href = url; link.download = "langtons-ant-" + world.ticks + ".png"; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
  };
  const resize = new ResizeObserver(() => {
    const rect = canvas.getBoundingClientRect();
    ox += (rect.width - width) / 2; oy += (rect.height - height) / 2;
    width = rect.width; height = rect.height; dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); change();
  });
  resize.observe(canvas);
  const observer = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting; last = 0; debt = 0; status();
    stats(performance.now(), true); schedule();
  });
  observer.observe(canvas);
  document.addEventListener("visibilitychange", () => { last = 0; debt = 0; status(); stats(performance.now(), true); schedule(); });
  window.addEventListener("pagehide", () => { if (frame) cancelAnimationFrame(frame); frame = 0; last = 0; });
  window.addEventListener("pageshow", () => { last = 0; change(); });
  for (const name of ["play", "step", "reset"]) el(name).disabled = false;
  reset();
}
