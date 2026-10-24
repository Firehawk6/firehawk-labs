#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
bash "$SCRIPT_DIR/update-sorter.sh"
curl --fail --silent --show-error http://127.0.0.1:8787/api/visitors
printf '\nGlobe updated. Enable Cloudflare Add visitor location headers for new regional dots.\n'
