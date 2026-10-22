# Sorter

Migrated from Firehawk6/Sorter at a59f72e35477f45a59f504c88326ade8b258e6f3.
Public route: /projects/sorter. Original repository and hosting are untouched.

The original uses quicksort with repeated partition scans and setTimeout per operation; it has no separate verification pass. The Labs version adds merge/insertion sorting, frame-budgeted steps, a 450 ms completion sweep, endless playback, pause, and resize without state loss. Reduced-motion users start paused. This remains a browser simulation, not server rendering.

Completion requires the exact sorted permutation 1..N, not just ascending comparisons. Each completion increments the session count once and queues one UUID for the shared counter. Interrupted shuffles do not count. Endless cycles last at least 3.3 seconds of visible active time.

GET /api/sorts reads the persistent total. POST /api/sorts/complete accepts a UUIDv4 and today's UTC date, validates the configured Origin, and atomically deduplicates requests in SQLite. Old deduplication rows expire while the total remains. Browser-reported totals are not proof against fabricated requests; the supplied Nginx configuration limits submissions to 60/minute per Cloudflare client IP. No IP is stored by the collector. Up to 100 pending completions are retried in the open page; reloading or crossing the UTC date can lose unsynced completions. The UI reports outages without inventing a shared count.

## Existing VM deployment

Run from the repository:

```sh
npm run build
sudo bash deploy/update-sorter.sh
sudo cp -a dist/. /var/www/firehawk-labs/
sudo chown -R www-data:www-data /var/www/firehawk-labs
sudo chmod -R u=rwX,go=rX /var/www/firehawk-labs
```

The update script preserves /etc/firehawk-visitors.env and the existing SQLite database. It adds the sorter routes to the existing snippet, backs up replaced files, tests Nginx, restarts the collector, and checks its local read endpoint. On error it restores the old files; additive database tables are harmless if rolled back. Fresh installs can use install-visitors.sh with the correct public origin instead.

Validate the public /api/sorts response and watch a complete run increment both metrics. A stale static deployment or missing backend update will leave the shared counter unavailable. Cloudflare must not cache /api/*.

## Checks

```sh
node tests/sorter-engine.test.mjs
node tests/sorter-controller.test.mjs
PYTHONPATH=/tmp/firehawk-test-deps python -m unittest discover -s analytics -v
npm run build
bash -n deploy/update-sorter.sh
```

Engine checks cover shuffled/reversed/sorted inputs for all algorithms and invalid completions. A mocked browser lifecycle checks endless repetition, one completion per run, pause/hidden suspension and cancellation. Collector tests cover concurrency, duplicate retries, invalid payloads, persistence, cleanup and visitor isolation. Actual browser appearance and VM Nginx/service deployment need live verification.
