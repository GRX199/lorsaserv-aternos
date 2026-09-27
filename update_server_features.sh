#!/bin/bash
set -e

echo "=========================================================="
echo "    MEMPERBARUI FITUR SERVER & SCRIPT API MINECRAFT BDS   "
echo "=========================================================="

BEDROCK_DIR="$HOME/bedrock-server"
BP_DIR="$BEDROCK_DIR/behavior_packs/discord_chat_bridge"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 1. Update file main.js di server Bedrock
if [ -d "$BP_DIR/scripts" ]; then
    echo "[1/3] Menyalin script terbaru ke behavior pack..."
    cp -f "$SCRIPT_DIR/behavior_packs/discord_chat_bridge/scripts/main.js" "$BP_DIR/scripts/main.js"
    touch "$BP_DIR/scripts/main.js"
    echo "  ✅ Script main.js (Warp, Teleport & NameTag Darah) berhasil diperbarui!"
else
    echo "ℹ️ Direktori $BP_DIR/scripts belum ada, menjalankan install_chat_bridge.sh..."
    bash "$SCRIPT_DIR/install_chat_bridge.sh"
fi

# 2. Restart Server Bedrock (agar Script API me-reload main.js)
echo "[2/3] Me-restart Minecraft Bedrock server (memuat Script API)..."
sudo systemctl restart minecraft-bedrock || true

# 3. Reload Bot Discord
echo "[3/3] Me-reload Bot Discord di PM2..."
pm2 reload all || pm2 restart all || true

echo ""
echo "=========================================================="
echo "  🎉 SUKSES! SELURUH FITUR SERVER TERBARU TELAH AKTIF!"
echo "=========================================================="
echo "🏷️ FITUR BARU: FLOATING NAMETAG DARAH (HP) & INFO PEMAIN:"
echo "  • Tepat di atas kepala setiap pemain kini muncul:"
echo "    - Baris 1: [Prefix Role/Badge] NamaPemain [AFK]"
echo "    - Baris 2: ❤ HP/MaxHP | ⭐ Level XP | Ikon Dimensi"
echo "  • Perintah In-Game Chat (Admin):"
echo "    - !nametag on        -> Aktifkan tampilan darah"
echo "    - !nametag off       -> Matikan tampilan darah (nama biasa)"
echo "    - !nametag style full   -> Gaya lengkap"
echo "    - !nametag style simple -> Gaya ringkas (hanya HP)"
echo "    - !nametag style hearts -> Gaya bar hati visual (❤❤❤❤❤)"
echo ""
echo "🌀 FITUR WARP & TELEPORTASI (Khusus Admin/OP):"
echo "  • In-game: !setwarp <nama>, !warp <nama>, !delwarp <nama>, !warplist"
echo "  • Discord: /warp, /tp, dan tombol di Admin Panel"
echo "=========================================================="
