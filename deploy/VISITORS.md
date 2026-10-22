# Visitor globe setup

The existing static site stays on Nginx. A small Flask/Gunicorn service listens only on 127.0.0.1:8787 and stores country aggregates in SQLite. The public API serves aggregate counts only.

1. In the Cloudflare dashboard for the site's zone, enable **Network → IP Geolocation**. Cloudflare sends `CF-IPCountry` to the origin. No city/GPS permission or paid geolocation service is required.
2. Pull the branch on the Ubuntu VM. Run `sudo bash deploy/install-visitors.sh https://YOUR-PUBLIC-HOSTNAME` from the repository root. Use the hostname visitors actually use; the collector only accepts recording requests from this origin.
3. Build with `npm ci && npm run build`, then copy `dist/.` into `/var/www/firehawk-labs/` as before.
4. Open the public HTTPS site. Check `/api/visitors` for real totals. Refreshing the same tab should not increment visits; a fresh browsing session should. IP geolocation may place VPN users in the VPN country. Direct LAN visits have no Cloudflare country and are not accepted by the public-origin collector.

## Data and interpretation

A visit is one random tab-session identifier per UTC day. The random identifier stays in sessionStorage; only a daily SHA-256 hash is stored server-side for deduplication. Hash records older than the previous UTC day are deleted on the next visit. Daily totals are retained for 400 days; all-time totals and country counts are retained until the database is removed. No raw IP, URL, referrer, or user-agent is written by this collector. The browser honors Do Not Track and Global Privacy Control. Existing Cloudflare/Nginx logs have their own retention settings.

Markers are country representative points, not individual visitor coordinates. Small countries absent from the low-resolution map can still appear in the totals/list. Counts are approximate sessions, not verified unique humans. Scripted requests can inflate a public counter despite origin checks and rate limiting. No historical visits are imported. There are no simulated markers or seeded totals.

The public GET endpoint never records a visit. A client POST records at most once per day per session, across all site pages. The globe refreshes every minute while visible. Exclude `/api/visitors` and `/api/visitors/*` from any custom Cloudflare caching rules. The service also sends `Cache-Control: no-store`.

## Deployment and operations

The install script targets `/etc/nginx/sites-available/firehawk-labs` and checks for the known document root before editing. It backs up the site configuration and validates Nginx before reload. If you use another site config, install the service/app manually, set `PUBLIC_ORIGIN` in `/etc/firehawk-visitors.env`, install the rate zone in the Nginx `http` context and include `visitor-locations.conf` within your site's `server` block.

Only route public traffic through Cloudflare Tunnel. Do not expose Gunicorn or add a public port-forward to Nginx: the location header is trusted because Cloudflare supplies it. Nginx rate limits recording by Cloudflare client IP in memory and disables access logging for these two API paths.

Troubleshooting: `sudo journalctl -u firehawk-visitors -n 50 --no-pager`, `sudo nginx -t`, and `curl http://127.0.0.1:8787/api/visitors`.

Back up `/var/lib/firehawk-visitors/` using a stopped service or SQLite-aware backup. For a reset, stop the service, back up then remove its SQLite database and WAL/SHM files, and restart. A reset discards collected history. For collector updates rerun the installer; it preserves the database.

## Map attribution

Country outlines and representative label coordinates are derived from Natural Earth's public-domain 1:110m admin-0 country data, simplified for this globe. Source: https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson . Terms: https://www.naturalearthdata.com/about/terms-of-use/ . Geographical boundaries are illustrative.
