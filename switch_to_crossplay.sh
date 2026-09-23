#!/bin/bash
set -e

echo "=========================================================="
echo "    Beralih ke Server PaperMC Crossplay (Java + Bedrock)  "
echo "=========================================================="

echo "[1/3] Menghentikan server Bedrock asli & Viaproxy..."
sudo systemctl stop minecraft-bedrock 2>/dev/null || true
sudo systemctl disable minecraft-bedrock 2>/dev/null || true
sudo systemctl stop viaproxy 2>/dev/null || true
sudo systemctl disable viaproxy 2>/dev/null || true

echo "[2/3] Menyalakan PaperMC Crossplay (Java 25565 + Bedrock 19132)..."
sudo systemctl enable minecraft-paper
sudo systemctl restart minecraft-paper

echo "[3/3] Memverifikasi status server..."
sleep 3

if systemctl is-active --quiet minecraft-paper; then
  echo ""
  echo "=========================================================="
  echo "  ✅ BERHASIL BERALIH KE PAPERMC CROSSPLAY!               "
  echo "=========================================================="
  echo "• Pemain Java (PC / TLauncher): 129.226.95.58:25565"
  echo "• Pemain Bedrock (HP / Win10):  129.226.95.58:19132"
  echo ""
  echo "💡 Untuk beralih kembali ke server Bedrock asli kapan saja:"
  echo "   bash switch_to_bedrock.sh"
  echo "=========================================================="
else
  echo "⚠️ Service minecraft-paper belum aktif sempurna."
  echo "Periksa log dengan: sudo systemctl status minecraft-paper"
fi
