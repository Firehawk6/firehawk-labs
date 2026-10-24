const links = document.querySelectorAll('[data-twitch-link]');
const status = document.getElementById('twitch-status');
if (links.length || status) {
  let pending = false;
  function render(data) {
    const live = data?.status === 'live', offline = data?.status === 'offline';
    for (const link of links) {
      link.dataset.live = String(live);
      link.querySelector('[data-twitch-label]').textContent = live ? 'LIVE NOW · WATCH STREAM' : 'WATCH TWITCH';
      link.title = live ? (data.title || 'tezzzzaa is live') : offline ? 'Currently offline — visit the stream page' : 'Open the Twitch stream page';
    }
    if (status) {
      status.textContent = live ? 'LIVE NOW' : offline ? 'OFFLINE' : 'LIVE STATUS UNAVAILABLE';
      status.dataset.live = String(live);
      document.getElementById('twitch-title').textContent = live ? data.title || 'Live with tezzzzaa' : offline ? 'Catch the next stream here.' : 'Welcome to the stream.';
      document.getElementById('twitch-detail').textContent = live ? [data.category, Number.isInteger(data.viewers) ? data.viewers.toLocaleString() + ' viewers' : ''].filter(Boolean).join(' · ') : offline ? 'Follow on Twitch to know when I go live.' : 'You can still use the player below or open Twitch.';
    }
  }
  async function refresh() {
    if (pending || document.hidden) return;
    pending = true;
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch('/api/twitch', { signal:controller.signal, cache:'no-store', credentials:'omit' });
      if (!response.ok) throw new Error('Unavailable');
      render(await response.json());
    } catch { render(null); }
    finally { clearTimeout(timer); pending = false; }
  }
  void refresh();
  setInterval(() => void refresh(), 60000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) render(null); else void refresh(); });
}
