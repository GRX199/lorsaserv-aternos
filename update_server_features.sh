#!/bin/bash
set -e

echo "=========================================================="
echo "  UPDATE FITUR SERVER BEDROCK (FLOATING NAMETAG PEMAIN & MOB)"
echo "=========================================================="

BEDROCK_DIR="$HOME/bedrock-server"
BP_DIR="$BEDROCK_DIR/behavior_packs/discord_chat_bridge"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SPECIFIC_OPERATOR="$1"

if [ ! -d "$BEDROCK_DIR" ]; then
  echo "❌ Direktori $BEDROCK_DIR tidak ditemukan."
  exit 1
fi

echo "[1/3] Mengonfigurasi allow-cheats=true & op-permission-level=4 di server.properties..."
PROP_FILE="$BEDROCK_DIR/server.properties"
if [ -f "$PROP_FILE" ]; then
  if grep -q "^allow-cheats=" "$PROP_FILE"; then
    sed -i 's/^allow-cheats=.*/allow-cheats=true/' "$PROP_FILE"
  else
    echo "allow-cheats=true" >> "$PROP_FILE"
  fi
  if grep -q "^op-permission-level=" "$PROP_FILE"; then
    sed -i 's/^op-permission-level=.*/op-permission-level=4/' "$PROP_FILE"
  else
    echo "op-permission-level=4" >> "$PROP_FILE"
  fi
  echo "✅ server.properties berhasil diperbarui (allow-cheats=true, op-permission-level=4)."
fi

echo "[2/3] Menyalin behavior pack discord_chat_bridge terbaru..."
mkdir -p "$BP_DIR/scripts"
cp -rf "$SCRIPT_DIR/behavior_packs/discord_chat_bridge/"* "$BP_DIR/"
touch "$BP_DIR/scripts/main.js"

echo "[3/3] Merestart service minecraft-bedrock..."
sudo systemctl restart minecraft-bedrock || true

# Tunggu 3 detik agar server booting dan screen aktif
sleep 3
if screen -ls | grep -q "mc-bedrock"; then
  echo "Membersihkan tag op/admin dari pemain biasa agar tidak semua pemain jadi admin..."
  screen -S mc-bedrock -X stuff "tag @a remove op\n" || true
  screen -S mc-bedrock -X stuff "tag @a remove admin\n" || true

  # Jika ada nama operator khusus yang dimasukkan sebagai argumen script
  if [ -n "$SPECIFIC_OPERATOR" ]; then
    echo "Menetapkan izin OP khusus untuk pemain: $SPECIFIC_OPERATOR"
    screen -S mc-bedrock -X stuff "op \"$SPECIFIC_OPERATOR\"\n" || true
    screen -S mc-bedrock -X stuff "tag \"$SPECIFIC_OPERATOR\" add op\n" || true
    screen -S mc-bedrock -X stuff "tag \"$SPECIFIC_OPERATOR\" add admin\n" || true
    screen -S mc-bedrock -X stuff "scriptevent bot:admin add $SPECIFIC_OPERATOR\n" || true
  fi

  screen -S mc-bedrock -X stuff "scriptevent bot:nametag on\n" || true
fi

echo ""
echo "=========================================================="
echo "  SUKSES! Server & Izin Operator Berhasil Diperbarui!     "
echo "=========================================================="
echo "Keamanan Terjaga:"
echo "  • Pemain biasa TIDAK menjadi admin atau operator."
echo "  • Hanya pemain yang secara resmi di-OP yang memiliki akses."
echo ""
echo "Cara Memberikan OP ke Pemain Tertentu Saja:"
echo "  • Di Discord Bot:  /op pemain:<Gamertag>"
echo "  • Di Konsol BDS:   op <Gamertag>"
echo "                     tag <Gamertag> add op"
echo "  • Atau jalankan:   bash update_server_features.sh <GamertagAnda>"
echo ""
