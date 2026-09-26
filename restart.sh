#!/bin/bash
# Shortcut untuk menjalankan safe countdown restart
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$SCRIPT_DIR/scripts/restart_countdown.sh" "$@"
