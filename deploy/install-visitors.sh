#!/usr/bin/env bash
set -euo pipefail
if [ "$(id -u)" -ne 0 ] || [ "$#" -ne 1 ]; then
  echo 'Usage: sudo bash deploy/install-visitors.sh https://your-site-hostname'
  exit 1
fi
SITE_ORIGIN="$1"
python3 - "$SITE_ORIGIN" <<'PY'
import sys
from urllib.parse import urlsplit
u=urlsplit(sys.argv[1])
if u.scheme!='https' or not u.hostname or u.path not in ('','/') or u.query or u.fragment or u.username or u.password or any(c.isspace() for c in sys.argv[1]):
 raise SystemExit('Provide only the public HTTPS origin, e.g. https://labs.example.com')
PY
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SITE_CONFIG=/etc/nginx/sites-available/firehawk-labs
# Check the known site before installing anything or changing its configuration.
python3 - "$SITE_CONFIG" <<'PY'
from pathlib import Path
import sys
s=Path(sys.argv[1]).read_text()
if 'root /var/www/firehawk-labs;' not in s: raise SystemExit('Custom Nginx configuration detected. Follow deploy/VISITORS.md for manual setup.')
if '/api/visitors' in s: raise SystemExit('Existing visitor routes found. Review the configuration manually before continuing.')
PY
apt-get update
apt-get install -y gunicorn python3-flask
id firehawk-visitors >/dev/null 2>&1 || useradd --system --home /nonexistent --shell /usr/sbin/nologin firehawk-visitors
install -d -m 755 /opt/firehawk-visitors
install -m 644 "$SCRIPT_DIR/../analytics/app.py" /opt/firehawk-visitors/app.py
printf 'PUBLIC_ORIGIN=%s\n' "${SITE_ORIGIN%/}" > /etc/firehawk-visitors.env
chmod 600 /etc/firehawk-visitors.env
install -m 644 "$SCRIPT_DIR/firehawk-visitors.service" /etc/systemd/system/firehawk-visitors.service
install -m 644 "$SCRIPT_DIR/visitor-limits.conf" /etc/nginx/conf.d/firehawk-visitor-limits.conf
install -m 644 "$SCRIPT_DIR/visitor-locations.conf" /etc/nginx/snippets/firehawk-visitors.conf
BACKUP="${SITE_CONFIG}.before-visitors-$(date +%Y%m%d%H%M%S)"
cp -a "$SITE_CONFIG" "$BACKUP"
python3 - "$SITE_CONFIG" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1]);s=p.read_text();include='include /etc/nginx/snippets/firehawk-visitors.conf;'
if include not in s:s=s.replace('root /var/www/firehawk-labs;', 'root /var/www/firehawk-labs;\n    '+include,1)
p.write_text(s)
PY
if ! nginx -t; then
  cp -a "$BACKUP" "$SITE_CONFIG"
  echo 'Nginx validation failed; the site configuration was restored.'
  exit 1
fi
systemctl daemon-reload
systemctl enable firehawk-visitors
systemctl restart firehawk-visitors
systemctl reload nginx
systemctl is-active --quiet firehawk-visitors
echo 'Collector installed. Enable Cloudflare IP Geolocation and rebuild/copy the website.'
