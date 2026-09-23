#!/bin/bash
set -e

echo "=========================================================="
echo "      EKSPOR WORLD BEDROCK UNTUK KONVERSI CHUNKER         "
echo "=========================================================="

HOME_DIR=$(eval echo "~$USER")
BEDROCK_DIR="$HOME_DIR/bedrock-server"
WORLDS_DIR="$BEDROCK_DIR/worlds"
REPO_DIR="$HOME_DIR/lorsaserv-aternos"
PUBLIC_DIR="$REPO_DIR/public"
OUTPUT_ZIP="$PUBLIC_DIR/bedrock_world.zip"

if [ ! -d "$WORLDS_DIR" ]; then
  echo "❌ Error: Direktori $WORLDS_DIR tidak ditemukan!"
  exit 1
fi

mkdir -p "$PUBLIC_DIR"

echo "[1/2] Mengompresi folder world Bedrock..."
python3 -c "import shutil; shutil.make_archive('$PUBLIC_DIR/bedrock_world', 'zip', '$WORLDS_DIR')"

# Salin juga ke home folder untuk kemudahan akses
cp "$OUTPUT_ZIP" "$HOME_DIR/bedrock_world.zip" 2>/dev/null || true

PUBLIC_IP=$(curl -s https://api.ipify.org || echo "129.226.95.58")

echo ""
echo "=========================================================="
echo "  ✅ BERHASIL DIEKSPOR: $OUTPUT_ZIP"
echo "=========================================================="
echo ""
echo "📥 Tautan Unduh Langsung (Buka di Browser PC Anda):"
echo "   http://$PUBLIC_IP:3000/download-bedrock-world"
echo "   (atau http://$PUBLIC_IP:3000/bedrock_world.zip)"
echo ""
echo "Langkah selanjutnya:"
echo "1. Klik tautan di atas untuk mengunduh file bedrock_world.zip ke PC."
echo "2. Buka https://chunker.app di browser PC Anda."
echo "3. Klik 'Upload Archive' dan pilih file bedrock_world.zip."
echo "4. Pilih 'Export to Java 1.21.4' lalu unduh file zip hasilnya."
echo "5. Pindahkan file zip hasil Chunker ke VPS, lalu jalankan:"
echo "   bash import_converted_world.sh <nama_file_hasil_chunker.zip>"
echo "=========================================================="
