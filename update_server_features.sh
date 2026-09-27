#!/bin/bash
set -e

echo "=========================================================="
echo "  UPDATE FITUR SERVER BEDROCK (FLOATING NAMETAG PEMAIN & MOB)"
echo "=========================================================="

BEDROCK_DIR="$HOME/bedrock-server"
BP_DIR="$BEDROCK_DIR/behavior_packs/discord_chat_bridge"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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
  echo "Memberikan izin tag dan mengaktifkan nametag..."
  screen -S mc-bedrock -X stuff "tag @a add op\n" || true
  screen -S mc-bedrock -X stuff "tag @a add admin\n" || true
  screen -S mc-bedrock -X stuff "scriptevent bot:nametag on\n" || true
fi

echo ""
echo "=========================================================="
echo "  SUKSES! Floating NameTag & Izin OP Berhasil Diperbarui! "
echo "=========================================================="
echo "Status Admin In-Game:"
echo "  • Jika Anda Operator, ketik: !nametag on"
echo "  • Atau ketik !opme untuk mengaktifkan status Admin langsung"
echo ""
echo "Konsol VPS / Screen BDS:"
echo "  • scriptevent bot:nametag on"
echo "  • tag <NamaPemain> add op"
echo ""
echo "Discord Bot:"
echo "  • /nametag aktif: True"
echo "  • /cmd perintah: !nametag on"
