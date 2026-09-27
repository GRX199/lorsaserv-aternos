#!/bin/bash
set -e

echo "=========================================================="
echo "  UPDATE FITUR SERVER BEDROCK (FLOATING NAMETAG SIMPLE)   "
echo "=========================================================="

BEDROCK_DIR="$HOME/bedrock-server"
BP_DIR="$BEDROCK_DIR/behavior_packs/discord_chat_bridge"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ ! -d "$BEDROCK_DIR" ]; then
  echo "❌ Direktori $BEDROCK_DIR tidak ditemukan."
  exit 1
fi

echo "[1/2] Menyalin behavior pack discord_chat_bridge terbaru..."
mkdir -p "$BP_DIR/scripts"
cp -rf "$SCRIPT_DIR/behavior_packs/discord_chat_bridge/"* "$BP_DIR/"
touch "$BP_DIR/scripts/main.js"

echo "[2/2] Merestart service minecraft-bedrock..."
sudo systemctl restart minecraft-bedrock || true

echo ""
echo "=========================================================="
echo "  SUKSES! Floating NameTag Darah (Simple) telah aktif!   "
echo "=========================================================="
echo "Pemain di server sekarang memiliki indikator darah simpel:"
echo "  <Nama Pemain>"
echo "  ❤ 20/20"
echo ""
echo "Perintah In-Game (Admin/OP):"
echo "  !nametag on   (Mengaktifkan)"
echo "  !nametag off  (Mematikan)"
