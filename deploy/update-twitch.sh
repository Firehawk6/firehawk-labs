#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# Both features share the existing collector and Nginx snippet.
bash "$SCRIPT_DIR/update-sorter.sh"
curl --fail --silent --show-error http://127.0.0.1:8787/api/twitch
printf '\nTwitch page service ready. Configure Twitch credentials to enable live status.\n'
