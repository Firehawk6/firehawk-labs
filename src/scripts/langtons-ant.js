import { AntWorld } from "./ant-engine.mjs";
import { AntTrailLayer } from "./ant-trail-layer.mjs";

const root = document.getElementById("ant-lab");
if (root) init();

function init() {
  const el = id => document.getElementById("ant-" + id);
  const canvas = el("canvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) { el("state").textContent = "Canvas is unavailable in this browser."; return; }
  const palettes = {
    labs: ["#0b0b0d", "#ff8b83", "#ffd0a6"],
    classic: ["#222222", "#ffffff", "#e74c3c"],
    neon: ["#000000", "#ff997a", "#ffd0a6"],
    minic: ["#13dcfa", "#f90018", "#00ffea"],
    jerm: ["#000000", "#B51C1C", "#EF6594"],
  };
  const speeds = [1, 60, 600, 6000, 30000];
  let world = new AntWorld();
  const trails = new AntTrailLayer(() => document.createElement("canvas"));
  let running = false, visible = true, dirty = true, frame = 0;
  let width = 0, height = 0, dpr = 1, scale = 10, ox = 0, oy = 0;
  let last = 0, debt = 0, sampleTime = 0, sampleTicks = 0, lastStats = 0;
  let applied = { count: 1, maxAnts: 1500, spawn: false };
  let drag = null;
  let lastDraw = -Infinity, forceDraw = true;

  function status() {
    el("play").textContent = running ? "Pause" : "Play";
    el("step").disabled = running || world.limit;
    el("play").disabled = world.limit;
    el("state").textContent = world.limit ? "Memory limit reached — reset to continue" :
      running ? ((!visible || document.hidden) ? "Suspended while out of view" : (world.spawn && world.ants.length >= world.maxAnts ? "Running — ant cap reached; spawning off" : "Running")) : "Paused — ready to explore";
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
    status();
  }
  function schedule() {
    if (!frame && visible && !document.hidden) frame = requestAnimationFrame(loop);
  }
  function change() { dirty = true; forceDraw = true; schedule(); }
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
    trails.update(world, { width, height, dpr, scale, ox, oy, background: colors[0], foreground: colors[1] });
    ctx.drawImage(trails.image, 0, 0, width, height);
    ctx.fillStyle = colors[2];
    ctx.beginPath();
    const s = Math.max(3, scale * .42);
    for (const ant of world.ants) {
      const x = ox + (ant.x + .5) * scale, y = oy + (ant.y + .5) * scale;
      if (x < -scale || y < -scale || x > width + scale || y > height + scale) continue;
      if (scale < 1) {
        ctx.rect(x - .5, y - .5, 1, 1);
        continue;
      }
      // Rotate vertices directly and draw all ants in one path.
      const dx = [0, 1, 0, -1][ant.dir], dy = [-1, 0, 1, 0][ant.dir];
      ctx.moveTo(x + dx * s, y + dy * s);
      ctx.lineTo(x - dx * s - dy * s * .8, y - dy * s + dx * s * .8);
      ctx.lineTo(x - dx * s + dy * s * .8, y - dy * s - dx * s * .8);
      ctx.closePath();
    }
    ctx.fill();
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
      // Bound CPU use by elapsed time, including on high-refresh-rate monitors.
      const budget = Math.min(3, elapsed * .18);
      while (debt >= 1 && performance.now() - start < budget) {
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
    // A wide view needs fewer presentation frames, not fewer simulation cells.
    const interval = scale < 1 ? 1000 / 30 : 1000 / 60;
    if (dirty && (forceDraw || !running || now - lastDraw >= interval - .5)) {
      draw(); lastDraw = now; forceDraw = false;
    }
    stats(now);
    if (running) schedule();
  }
  function reset() {
    running = false; debt = 0; last = 0;
    world = new AntWorld(applied); trails.invalidate();
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
    const maxAnts = Math.max(count, Math.min(1500, Number(el("cap").value) || 1500));
    el("count").value = String(count); el("cap").value = String(maxAnts);
    applied = { count, maxAnts, spawn: el("spawn").checked }; reset();
  };
  el("speed").oninput = () => { el("speed-value").textContent = speeds[Number(el("speed").value)].toLocaleString() + " ticks/s"; debt = 0; };
  el("theme").onchange = () => { trails.invalidate(); change(); };
  el("follow").onchange = () => { if (el("follow").checked) center(); };
  el("center").onclick = center;
  function zoom(factor, x = width / 2, y = height / 2) {
    const next = Math.max(0.25, Math.min(40, scale * factor));
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
