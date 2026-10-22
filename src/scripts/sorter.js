import { shuffled, sortSteps, verified } from './sorter-engine.mjs';
const root = document.getElementById('sorter');
if (root) init();
function init() {
  const el = name => document.getElementById('sort-' + name);
  const canvas = el('canvas'), ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) { el('state').textContent = 'Canvas unavailable'; return; }
  const names = { quick: 'Quicksort', merge: 'Merge sort', insertion: 'Insertion sort' };
  let values, iterator, highlights = [], method, cycle = 0;
  let phase = 'sorting', phaseTime = 0, runTime = 0, local = 0, total = 0;
  let running = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  let visible = true, frame = 0, last = 0, debt = 0, width = 0, height = 0, dpr = 1, dirty = true;
  let pending = [], sending = false;
  function status() {
    el('play').textContent = running ? 'Pause' : 'Play';
    el('state').textContent = !running ? (phase === 'done' ? 'Complete' : 'Paused') :
      (document.hidden || !visible) ? 'Resting while out of view' :
      phase === 'sorting' ? 'Sorting' : phase === 'verify' ? 'Verifying' : 'Sorted ✓';
  }
  function restart() {
    method = el('method').value === 'cycle' ? ['quick', 'merge', 'insertion'][cycle++ % 3] : el('method').value;
    values = shuffled(Number(el('count').value));
    iterator = sortSteps(values, method); highlights = [];
    phase = 'sorting'; phaseTime = 0; runTime = 0; debt = 0; last = 0;
    el('algorithm').textContent = names[method]; dirty = true; status(); schedule();
  }
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0b0b0d'; ctx.fillRect(0, 0, width, height);
    const step = width / values.length, gap = step > 4 ? Math.min(2, step * .18) : 0;
    const sweep = phase === 'verify' ? Math.floor(values.length * Math.min(1, phaseTime / 450)) : 0;
    for (let i = 0; i < values.length; i++) {
      const bar = Math.max(2, values[i] / values.length * (height - 12));
      ctx.fillStyle = phase === 'hold' || phase === 'done' || i < sweep ? '#ffd0ba' : highlights.includes(i) ? '#fff5ee' : '#ff8b83';
      ctx.fillRect(i * step, height - bar, Math.max(.5, step - gap), bar);
    }
    dirty = false;
  }
  function schedule() { if (!frame && visible && !document.hidden) frame = requestAnimationFrame(loop); }
  function loop(now) {
    frame = 0;
    if (!visible || document.hidden) { last = 0; return; }
    const elapsed = last ? Math.min(80, now - last) : 0; last = now;
    if (running) {
      runTime += elapsed;
      if (phase === 'sorting') {
        debt = Math.min(1000, debt + elapsed * Number(el('speed').value) / 1000);
        const start = performance.now();
        while (debt >= 1 && performance.now() - start < 4) {
          const next = iterator.next(); debt--;
          if (next.done) {
            if (!verified(values, Number(el('count').value))) {
              running = false; status(); el('state').textContent = 'Verification failed — start a new shuffle'; break;
            }
            phase = 'verify'; phaseTime = 0; highlights = []; status(); break;
          }
          highlights = next.value;
        }
        dirty = true;
      } else if (phase === 'verify') {
        phaseTime += elapsed; dirty = true;
        // One quick verification sweep, followed by a separate resting beat.
        if (phaseTime >= 450) {
          phase = 'hold'; phaseTime = 0; local++;
          el('local').textContent = local.toLocaleString();
          if (globalThis.crypto?.randomUUID && pending.length < 100) {
            pending.push({ run: crypto.randomUUID(), day: new Date().toISOString().slice(0, 10) });
            void flush();
          } else el('network').textContent = 'This run counted locally; shared reporting unavailable.';
          status();
        }
      } else if (phase === 'hold') {
        phaseTime += elapsed;
        if (phaseTime >= 900 && runTime >= 3300) {
          if (el('endless').checked) restart();
          else { phase = 'done'; running = false; status(); dirty = true; }
        }
      }
    }
    if (dirty) draw();
    if (running) schedule();
  }
  async function request(url, options = {}) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal, credentials: 'omit', cache: 'no-store' });
      if (!response.ok) throw new Error('Counter unavailable');
      const data = await response.json();
      if (!Number.isSafeInteger(data.total) || data.total < 0) throw new Error('Invalid total');
      total = Math.max(total, data.total); el('global').textContent = total.toLocaleString();
      return data;
    } finally { clearTimeout(timer); }
  }
  async function flush() {
    if (sending || document.hidden) return;
    sending = true;
    try {
      if (!pending.length) await request('/api/sorts');
      // Bounded retries keep failures from blocking animation or growing a queue forever.
      for (let i = 0; pending.length && i < 5; i++) {
        const item = pending[0];
        if (item.day !== new Date().toISOString().slice(0, 10)) { pending.shift(); continue; }
        await request('/api/sorts/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) });
        pending.shift();
      }
      el('network').textContent = pending.length ? 'Syncing completed sorts…' : 'Shared count · completed sorts reported by visitors';
    } catch { el('network').textContent = 'Shared counter unavailable — sorting continues. Retrying automatically.'; }
    finally { sending = false; }
  }
  el('play').disabled = el('new').disabled = false;
  el('play').onclick = () => {
    running = !running;
    if (running && phase === 'done') restart();
    last = 0; status(); schedule();
  };
  el('new').onclick = restart;
  el('method').onchange = restart; el('count').onchange = restart;
  el('speed').onchange = () => { debt = 0; };
  const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; last = 0; status(); schedule(); });
  observer.observe(canvas);
  new ResizeObserver(() => {
    const rect = canvas.getBoundingClientRect(); width = rect.width; height = rect.height;
    dpr = Math.min(devicePixelRatio || 1, 2); canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    dirty = true; schedule();
  }).observe(canvas);
  document.addEventListener('visibilitychange', () => { last = 0; status(); schedule(); if (!document.hidden) void flush(); });
  window.addEventListener('pagehide', () => { cancelAnimationFrame(frame); frame = 0; last = 0; });
  window.addEventListener('pageshow', () => { last = 0; schedule(); });
  setInterval(() => { if (!document.hidden) void flush(); }, 30000);
  restart(); void flush();
}
