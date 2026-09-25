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

echo "[1/4] Menyalin file .mcfunction ke $BP_DIR/functions/..."
mkdir -p "$BP_DIR/functions/admin"
cp -rf "$SCRIPT_DIR/behavior_packs/discord_chat_bridge/functions/"* "$BP_DIR/functions/"

echo "[2/4] Menyalin struktur Auto Storage (easyautostorage.mcstructure)..."
mkdir -p "$BP_DIR/structures"
cp -rf "$SCRIPT_DIR/behavior_packs/discord_chat_bridge/structures/"* "$BP_DIR/structures/"

# Salin juga ke folder world agar dikenali langsung oleh BDS engine
WORLDS_DIR="$BEDROCK_DIR/worlds"
if [ -d "$WORLDS_DIR" ]; then
  for world in "$WORLDS_DIR"/*; do
    if [ -d "$world" ]; then
      mkdir -p "$world/structures"
      cp -f "$SCRIPT_DIR/behavior_packs/discord_chat_bridge/structures/easyautostorage.mcstructure" "$world/structures/"
      echo "  -> Cetak biru disalin ke $world/structures/"
    fi
  done
fi

echo "[3/4] Memastikan izin file..."
chmod -R 755 "$BP_DIR/functions" "$BP_DIR/structures"

echo "[4/4] Merestart service minecraft-bedrock..."
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
echo "Command Auto Storage (Gudang Otomatis Golem 22x10x20):"
echo "  /structure load easyautostorage ~ ~ ~"
echo "  /function admin/spawn_storage"
echo ""
echo "Cara mengaktifkan status Admin untuk akun Anda:"
echo "  Ketik di in-game: /tag @s add admin"
echo "=========================================================="
