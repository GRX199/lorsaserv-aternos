#!/bin/bash
set -e

echo "=========================================================="
echo "  MEMASANG ADMIN INSTANT ENCHANT FUNCTIONS DI BDS SERVER  "
echo "=========================================================="

BEDROCK_DIR="$HOME/bedrock-server"
BP_DIR="$BEDROCK_DIR/behavior_packs/discord_chat_bridge"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ ! -d "$BEDROCK_DIR" ]; then
  echo "❌ Direktori $BEDROCK_DIR tidak ditemukan."
  exit 1
fi

echo "[1/3] Menyalin file .mcfunction ke $BP_DIR/functions/..."
mkdir -p "$BP_DIR/functions/admin"
cp -rf "$SCRIPT_DIR/behavior_packs/discord_chat_bridge/functions/"* "$BP_DIR/functions/"

echo "[2/3] Memastikan izin file..."
chmod -R 755 "$BP_DIR/functions"

echo "[3/3] Merestart service minecraft-bedrock..."
sudo systemctl restart minecraft-bedrock

echo "=========================================================="
echo "  ✅ BERHASIL MEMASANG ADMIN INSTANT ENCHANT!"
echo "=========================================================="
echo "Daftar command in-game untuk Admin:"
echo "  /function admin/help"
echo "  /function admin/all"
echo "  /function admin/sword"
echo "  /function admin/pickaxe"
echo "  /function admin/silkpick"
echo "  /function admin/axe"
echo "  /function admin/shovel"
echo "  /function admin/armor"
echo "  /function admin/bow"
echo "  /function admin/crossbow"
echo "  /function admin/trident"
echo "  /function admin/mace"
echo ""
echo "Cara mengaktifkan status Admin untuk akun Anda:"
echo "  Ketik di in-game: /tag @s add admin"
echo "=========================================================="
