#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COUNTDOWN_SCRIPT="$SCRIPT_DIR/restart_countdown.sh"

chmod +x "$COUNTDOWN_SCRIPT"
sudo ln -sf "$COUNTDOWN_SCRIPT" /usr/local/bin/mc-restart
sudo ln -sf "$COUNTDOWN_SCRIPT" /usr/local/bin/restart-server

# Tambahkan alias ke ~/.bashrc jika belum ada
if ! grep -q "alias restart='mc-restart'" "$HOME/.bashrc" 2>/dev/null; then
    echo "alias restart='mc-restart'" >> "$HOME/.bashrc"
    echo "alias restart-server='mc-restart'" >> "$HOME/.bashrc"
fi

echo "=========================================================="
echo "  ✅ SHORTCUT RESTART COUNTDOWN BERHASIL DIPASANG DI VPS!"
echo "=========================================================="
echo "Sekarang Anda dapat mengetik salah satu perintah ini di VPS:"
echo "  1. mc-restart        -> Countdown 60 detik + notifikasi game"
echo "  2. restart-server    -> Countdown 60 detik + notifikasi game"
echo "  3. mc-restart 30     -> Countdown 30 detik kustom"
echo "  4. ./restart.sh      -> Countdown dari folder bot"
echo "=========================================================="
