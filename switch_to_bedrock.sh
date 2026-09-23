#!/bin/bash
set -e

echo "=========================================================="
echo "    Beralih ke Server Minecraft Bedrock Asli (Vanilla)    "
echo "=========================================================="

echo "[1/3] Menghentikan PaperMC Crossplay Server..."
sudo systemctl stop minecraft-paper 2>/dev/null || true
sudo systemctl disable minecraft-paper 2>/dev/null || true

echo "[2/3] Menyalakan Minecraft Bedrock Dedicated Server..."
sudo systemctl enable minecraft-bedrock
sudo systemctl restart minecraft-bedrock

echo "[3/3] Memverifikasi status server..."
sleep 2

if systemctl is-active --quiet minecraft-bedrock; then
  echo ""
  echo "=========================================================="
  echo "  ✅ BERHASIL KEMBALI KE SERVER BEDROCK ASLI!              "
  echo "=========================================================="
  echo "• Alamat IP: 129.226.95.58"
  echo "• Port Bedrock: 19132"
  echo "• Dunia & file Bedrock Anda 100% utuh tanpa perubahan."
  echo ""
  echo "💡 Untuk beralih kembali ke Crossplay (Java + Bedrock):"
  echo "   bash switch_to_crossplay.sh"
  echo "=========================================================="
else
  echo "⚠️ Service minecraft-bedrock belum aktif sempurna."
  echo "Periksa log dengan: sudo systemctl status minecraft-bedrock"
fi
