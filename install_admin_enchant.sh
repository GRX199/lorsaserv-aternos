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
      cp -rf "$SCRIPT_DIR/behavior_packs/discord_chat_bridge/structures/"* "$world/structures/"
      echo "  -> Seluruh cetak biru farm & storage disalin ke $world/structures/"
    fi
  done
fi

echo "[3/4] Memastikan izin file..."
chmod -R 755 "$BP_DIR/functions" "$BP_DIR/structures"

echo "[4/4] Merestart service minecraft-bedrock..."
sudo systemctl restart minecraft-bedrock

echo "=========================================================="
echo "  ✅ BERHASIL DIUPDATE & SIAP DIGUNAKAN DARI DISCORD!"
echo "=========================================================="
echo "👑 FITUR DISCORD ADMIN (Langsung Aktif Tanpa Perlu Setup In-Game):"
echo "  1. /enchant-admin  -> Full max enchant instan untuk item pemain"
echo "  2. /spawn-storage  -> Munculkan Gudang Auto Storage Golem (22x10x20)"
echo "  3. Tombol [✨ Enchant Instan] di Live Admin Control Panel Discord"
echo ""
echo "ℹ️ Catatan: Kontrol lewat Discord tidak memerlukan izin atau tag apa pun di game"
echo "   karena perintah dikirim langsung lewat Konsol VPS (Super Admin)."
echo ""
echo "🎮 Opsi Tambahan In-Game (Opsional jika ingin ketik di game):"
echo "  /function admin/help"
echo "  /structure load easyautostorage ~ ~ ~"
echo "=========================================================="
