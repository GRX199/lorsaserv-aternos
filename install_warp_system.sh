#!/bin/bash
set -e

echo "=========================================================="
echo "    MEMASANG SISTEM WARP & TELEPORTASI INSTAN (ADMIN/OP)  "
echo "=========================================================="

BEDROCK_DIR="$HOME/bedrock-server"
BP_DIR="$BEDROCK_DIR/behavior_packs/discord_chat_bridge"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 1. Update file main.js di server Bedrock
if [ -d "$BP_DIR/scripts" ]; then
    echo "[1/3] Menyalin script in-game warp ke behavior pack..."
    cp -f "$SCRIPT_DIR/behavior_packs/discord_chat_bridge/scripts/main.js" "$BP_DIR/scripts/main.js"
    touch "$BP_DIR/scripts/main.js"
    echo "  ✅ Script main.js berhasil diperbarui!"
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
echo "  🎉 SUKSES! FITUR WARP & TP KHUSUS ADMIN TELAH AKTIF!"
echo "=========================================================="
echo "👑 Perintah In-Game Chat (Khusus OP / Tag 'admin'):"
echo "  • !setwarp <nama>       -> Simpan posisi berdiri saat ini"
echo "  • !warp <nama>          -> Teleport diri sendiri ke titik warp"
echo "  • !warp <nama> <player> -> Teleport pemain lain ke titik warp"
echo "  • !delwarp <nama>       -> Hapus titik warp"
echo "  • !warplist             -> Lihat seluruh daftar warp"
echo "  • !tpto <player>        -> Teleport ke pemain lain"
echo "  • !tphere <player>      -> Tarik pemain lain ke posisi Anda"
echo ""
echo "🤖 Perintah Discord Bot (Khusus Admin):"
echo "  • /warp set nama:<nama> [pemain:<gamertag>] [x: y: z:]"
echo "  • /warp tp nama:<nama> pemain:<gamertag>"
echo "  • /warp hapus nama:<nama>"
echo "  • /warp list"
echo "  • /tp pemain:<nama> [target_pemain:<nama>] [x: y: z:]"
echo "  • Tombol [🌀 Titik Warp & TP] di Admin Panel Discord!"
echo "=========================================================="
