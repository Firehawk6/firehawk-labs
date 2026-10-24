# Twitch page and homepage live button

Channel: tezzzzaa. Page: /live. This is a site feature, not a project entry.

The homepage links to the stream page and polls /api/twitch once per minute while visible. A verified live response enables a coral pulse and LIVE NOW text. Offline and unavailable are distinct: failures never manufacture offline or retain an old live claim. Reduced motion disables the pulse. The watch page shows the stream title, category and viewer count when available.

The official Twitch video and chat embeds use the actual page hostname as parent. Video starts only when the viewer presses Play. Twitch requires a player at least 400×300; narrower containers show the external channel link rather than an undersized player. Resizing back restores the embed. Playback and chat login remain controlled by Twitch, including any browser or regional restrictions.

## Install on the existing VM

```sh
npm run build
sudo bash deploy/update-twitch.sh
sudo cp -a dist/. /var/www/firehawk-labs/
sudo chown -R www-data:www-data /var/www/firehawk-labs
sudo chmod -R u=rwX,go=rX /var/www/firehawk-labs
```

This updates the existing collector without changing its PUBLIC_ORIGIN or database. The watch page works without app credentials; the homepage live badge requires the setup below.

## Enable automatic live status

Register/manage a confidential application at https://dev.twitch.tv/console/apps using the Twitch account. Use a descriptive name such as Firehawk Labs Live, website integration category, and https://labs.firehawk6.com/live as the redirect URL if registration requires one. This server-to-server client credentials flow does not actually redirect visitors or request user scopes.

Copy its Client ID and generate a Client secret, then enter them ONLY in the VM prompt:

```sh
sudo python3 deploy/configure-twitch.py
curl -sS http://127.0.0.1:8787/api/twitch
```

The prompt writes /etc/firehawk-twitch.env with mode 600 and a systemd EnvironmentFile drop-in. Do not put credentials in public JavaScript, GitHub, screenshots, or chat. Use a dedicated app for Labs; no stream key is required. Re-run the helper to rotate credentials.

Expected API status: live or offline. Unknown means missing credentials, an upstream failure or a concurrent initial refresh. Check the credentials and retry after 30 seconds. The endpoint exposes only status/title/category/viewers, never credentials or tokens. Successful status is cached 60 seconds and failures 30 seconds, so live changes usually appear within 1–2 minutes. Tokens are reused until near expiry and renewed after a 401 response. External requests have timeouts and refreshes are coalesced per process; the shipped service uses one worker.

## Verification

```sh
PYTHONPATH=/tmp/firehawk-test-deps python -m unittest discover -s analytics -v
npm run build
bash -n deploy/update-twitch.sh
```

Tests mock Twitch to verify live, offline, missing configuration, malformed responses, upstream failure, token renewal, caching and secret exclusion. Existing visitor/sorter tests also pass. Actual playback, Twitch login, and live status with real credentials need verification on the deployed HTTPS domain. Confirm the homepage button pulses only when live, the stream embeds load, and pausing/playing works on desktop. Narrow screens should get the Twitch fallback link without horizontal overflow.

Official references:
- https://dev.twitch.tv/docs/embed/video-and-clips/
- https://dev.twitch.tv/docs/embed/chat/
- https://dev.twitch.tv/docs/api/reference/#get-streams
- https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#client-credentials-grant-flow
