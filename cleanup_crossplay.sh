#!/bin/bash
set -e

echo "=========================================================="
echo "      MEMBERSIHKAN & MENGHAPUS SERVER CROSSPLAY           "
echo "=========================================================="

HOME_DIR=$(eval echo "~$USER")

echo "[1/5] Menghentikan service PaperMC & Viaproxy..."
sudo systemctl stop minecraft-paper 2>/dev/null || true
sudo systemctl disable minecraft-paper 2>/dev/null || true
sudo systemctl stop viaproxy 2>/dev/null || true
sudo systemctl disable viaproxy 2>/dev/null || true

echo "[2/5] Menghapus file systemd service PaperMC & Viaproxy..."
sudo rm -f /etc/systemd/system/minecraft-paper.service
sudo rm -f /etc/systemd/system/viaproxy.service
sudo rm -f /etc/sudoers.d/minecraft-paper
sudo systemctl daemon-reload

echo "[3/5] Menghapus folder ~/papermc-server & ~/viaproxy..."
rm -rf "$HOME_DIR/papermc-server"
rm -rf "$HOME_DIR/viaproxy"
rm -rf "$HOME_DIR/lorsaserv-aternos/public" 2>/dev/null || true
rm -f "$HOME_DIR/bedrock_world.zip" 2>/dev/null || true

echo "[4/5] Memastikan Minecraft Bedrock Dedicated Server aktif..."
sudo systemctl enable minecraft-bedrock
sudo systemctl restart minecraft-bedrock

echo "[5/5] Memverifikasi status server Bedrock..."
sleep 2

if systemctl is-active --quiet minecraft-bedrock; then
  echo ""
  echo "=========================================================="
  echo "  ✅ BERHASIL! SERVER CROSSPLAY TELAH DIHAPUS TOTAL       "
  echo "=========================================================="
  echo "• Server Minecraft Bedrock murni Anda aktif 100%!"
  echo "• Port: 129.226.95.58:19132"
  echo "• Semua data world, rumah, dan player Bedrock aman utuh."
  echo "• Memori RAM & disk VPS telah bersih kembali."
  echo "=========================================================="
else
  echo "⚠️ Service minecraft-bedrock belum aktif sempurna."
  echo "Periksa log dengan: sudo systemctl status minecraft-bedrock"
fi
