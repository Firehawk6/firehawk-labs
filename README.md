# Firehawk Labs

Public Astro site with a project showcase, homelab overview, server-status page, and navigation terminal.

## Development

Requires Node.js >=22.12. Run `npm ci`, then `npm run dev -- --background`.
Run `npm run build` for production output in `dist/`.

## Content

- `src/data/navigation.ts`: shared menu, launcher, and terminal destinations.
- `src/data/projects.ts`: public projects. Adding a record generates its detail page.
- `/homelab`: public infrastructure overview.
- `/status`: Minecraft monitoring placeholder; no uptime source is configured.

Server status needs a public monitoring feed before actual availability or percentages can be displayed. No private management endpoints or credentials belong in browser code.

## Visual effects

The homepage glow follows the pointer once per animation frame without a trailing animation. Background parallax uses frame-rate-independent smoothing. Particles use a soft radial canvas texture.

## Deployment

Build first, then copy `dist/` into the Nginx document root. Astro generates static redirect pages for legacy URLs. No Node server is needed in production.

Removing source links from the site does not change repository visibility or conceal browser-delivered code.

## Visitor globe

The homepage globe displays real country totals from an optional local collector. Follow [visitor setup](deploy/VISITORS.md) to enable Cloudflare geolocation and install the service on the Ubuntu VM. Until connected, the globe shows no simulated visits.
