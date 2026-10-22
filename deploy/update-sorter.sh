#!/usr/bin/env bash
set -euo pipefail
if [ "$(id -u)" -ne 0 ]; then echo 'Run with sudo bash deploy/update-sorter.sh'; exit 1; fi
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
test -f /etc/firehawk-visitors.env
test -f /opt/firehawk-visitors/app.py
grep -q 'include /etc/nginx/snippets/firehawk-visitors.conf;' /etc/nginx/sites-available/firehawk-labs
BACKUP_DIR="$(mktemp -d /opt/firehawk-visitors/before-sorter.XXXXXX)"
cp -a /opt/firehawk-visitors/app.py "$BACKUP_DIR/app.py"
cp -a /etc/nginx/snippets/firehawk-visitors.conf "$BACKUP_DIR/locations.conf"
cp -a /etc/nginx/conf.d/firehawk-visitor-limits.conf "$BACKUP_DIR/limits.conf"
rollback() {
  trap - ERR
  cp -a "$BACKUP_DIR/app.py" /opt/firehawk-visitors/app.py
  cp -a "$BACKUP_DIR/locations.conf" /etc/nginx/snippets/firehawk-visitors.conf
  cp -a "$BACKUP_DIR/limits.conf" /etc/nginx/conf.d/firehawk-visitor-limits.conf
  systemctl restart firehawk-visitors || true
  nginx -t && systemctl reload nginx || true
  echo 'Update failed; previous service files restored.'
}
trap rollback ERR
install -m 644 "$SCRIPT_DIR/../analytics/app.py" /opt/firehawk-visitors/app.py
install -m 644 "$SCRIPT_DIR/visitor-locations.conf" /etc/nginx/snippets/firehawk-visitors.conf
install -m 644 "$SCRIPT_DIR/visitor-limits.conf" /etc/nginx/conf.d/firehawk-visitor-limits.conf
nginx -t
systemctl restart firehawk-visitors
curl --fail --silent --show-error --retry 5 --retry-connrefused --retry-delay 1 http://127.0.0.1:8787/api/sorts
systemctl reload nginx
trap - ERR
echo 'Sorter counter ready. Existing visitor totals and public origin preserved.'
