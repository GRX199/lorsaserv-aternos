#!/bin/bash
set -e

echo "=========================================================="
echo "  MEMASANG STRUKTUR KE SERVER TANPA RESTART MINECRAFT     "
echo "=========================================================="

BEDROCK_DIR="$HOME/bedrock-server"
WORLDS_DIR="$BEDROCK_DIR/worlds"
BP_DIR="$BEDROCK_DIR/behavior_packs/discord_chat_bridge"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ ! -d "$BEDROCK_DIR" ]; then
  echo "❌ Direktori $BEDROCK_DIR tidak ditemukan."
  exit 1
fi

echo "[1/3] Menyalin file mcstructure ke behavior pack..."
mkdir -p "$BP_DIR/structures"
cp -rf "$SCRIPT_DIR/behavior_packs/discord_chat_bridge/structures/"* "$BP_DIR/structures/"

echo "[2/3] Menyalin langsung ke folder worlds/*/structures/..."
if [ -d "$WORLDS_DIR" ]; then
  for world in "$WORLDS_DIR"/*; do
    if [ -d "$world" ]; then
      mkdir -p "$world/structures"
      cp -rf "$SCRIPT_DIR/behavior_packs/discord_chat_bridge/structures/"* "$world/structures/"
      echo "  ✅ Cetak biru aktif di: $world/structures/"
    fi
  done
fi

echo "[3/3] Me-reload Bot Discord di PM2 (Server Minecraft TETAP ONLINE)..."
pm2 reload all || pm2 restart all || true

echo "=========================================================="
echo "  🎉 SELESAI! STRUKTUR SIAP DIMUNCULKAN TANPA RESTART!"
echo "=========================================================="
echo "Server Minecraft TIDAK DIHENTIKAN dan pemain tetap bisa bermain."
echo ""
echo "Perintah Discord:"
echo "  /spawn-storage pemain:NamaAnda struktur:Easy Iron Farm"
echo "  /spawn-storage pemain:NamaAnda struktur:Gudang Auto Storage Golem"
echo "  /spawn-storage pemain:NamaAnda struktur:Auto Sugarcane Farm"
echo "  /spawn-storage pemain:NamaAnda struktur:Auto Cooked Chicken Farm"
echo "=========================================================="
