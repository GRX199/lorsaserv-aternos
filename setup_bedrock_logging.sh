#!/bin/bash
set -e

echo "=========================================================="
echo "  KONFIGURASI LOGGING REAL-TIME BEDROCK SERVER & DISCORD  "
echo "=========================================================="

CURRENT_USER=$(whoami)
HOME_DIR=$(eval echo "~$CURRENT_USER")
BEDROCK_DIR="$HOME_DIR/bedrock-server"
LOG_FILE="$BEDROCK_DIR/server.log"
SERVICE_FILE="/etc/systemd/system/minecraft-bedrock.service"

if [ ! -d "$BEDROCK_DIR" ]; then
  echo "❌ Direktori $BEDROCK_DIR tidak ditemukan."
  exit 1
fi

# 1. Buat file log dan beri izin baca-tulis
touch "$LOG_FILE"
touch "$BEDROCK_DIR/screenlog.0"
chmod 664 "$LOG_FILE" "$BEDROCK_DIR/screenlog.0" 2>/dev/null || true
echo "✅ File log disiapkan di $LOG_FILE & screenlog.0"

# 2. Konfigurasi ~/.screenrc dan /etc/screenrc agar screen langsung flush log tiap detik
cat <<EOF > "$HOME_DIR/.screenrc"
logfile $LOG_FILE
logfile flush 1
deflog on
EOF
sudo cp "$HOME_DIR/.screenrc" /etc/screenrc 2>/dev/null || true
echo "✅ ~/.screenrc dan /etc/screenrc dikonfigurasi (flush 1s & deflog on)"

# 3. Perbarui ExecStart di systemd service minecraft-bedrock jika belum menggunakan -L -Logfile
if [ -f "$SERVICE_FILE" ]; then
  if grep -q "screen -DmS mc-bedrock" "$SERVICE_FILE" && ! grep -q -- "-Logfile" "$SERVICE_FILE"; then
    echo "Memperbarui $SERVICE_FILE dengan opsi screen -L -Logfile..."
    sudo sed -i 's|/usr/bin/screen -DmS mc-bedrock|/usr/bin/screen -L -Logfile '"$LOG_FILE"' -DmS mc-bedrock|g' "$SERVICE_FILE"
    sudo sed -i 's|screen -DmS mc-bedrock|screen -L -Logfile '"$LOG_FILE"' -DmS mc-bedrock|g' "$SERVICE_FILE"
    echo "✅ Service file berhasil diperbarui."
  else
    echo "ℹ️ Service file sudah memiliki parameter logging."
  fi
fi

# 4. Pasang Behavior Pack Chat Bridge & Player Events
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/install_chat_bridge.sh" ]; then
  echo "Memasang Behavior Pack Chat Bridge & Player Events..."
  bash "$SCRIPT_DIR/install_chat_bridge.sh" || true
fi

# 5. Reload daemon & restart service
echo "Memuat ulang systemd daemon..."
sudo systemctl daemon-reload
echo "Merestart service minecraft-bedrock..."
sudo systemctl restart minecraft-bedrock

# 6. Restart discord bot via PM2 jika ada
if command -v pm2 &> /dev/null; then
  echo "Merestart bot discord di pm2..."
  pm2 restart minecraft-bot || pm2 restart all || true
fi

echo ""
echo "=========================================================="
echo "  SUKSES! LOGGING REAL-TIME BERHASIL DIAKTIFKAN!         "
echo "=========================================================="
echo "File log aktif: $LOG_FILE"
echo "Sekarang bot dapat mendeteksi pemain masuk/keluar secara instan."
echo "Jalankan slash command di Discord: /setup-alerts [channel]"
echo "=========================================================="
