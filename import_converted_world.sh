#!/bin/bash
set -e

echo "=========================================================="
echo "      IMPORT WORLD HASIL KONVERSI KE PAPERMC SERVER       "
echo "=========================================================="

INPUT_SOURCE="$1"
HOME_DIR=$(eval echo "~$USER")
PAPER_DIR="$HOME_DIR/papermc-server"
BEDROCK_DIR="$HOME_DIR/bedrock-server"
INPUT_FILE=""

if [ -z "$INPUT_SOURCE" ]; then
  # Cari file zip di folder saat ini jika ada
  FOUND_ZIP=$(ls -t *.zip 2>/dev/null | grep -v "bedrock_world" | head -n 1 || true)
  if [ -n "$FOUND_ZIP" ]; then
    INPUT_FILE="$FOUND_ZIP"
    echo "💡 Menggunakan file ZIP yang ditemukan: $INPUT_FILE"
  else
    echo "❌ Penggunaan:"
    echo "   bash import_converted_world.sh <path_file_zip_atau_url>"
    echo "Contoh file lokal: bash import_converted_world.sh /home/ubuntu/converted_world.zip"
    echo "Contoh dari URL:  bash import_converted_world.sh https://link-download-anda.com/world.zip"
    exit 1
  fi
elif [[ "$INPUT_SOURCE" =~ ^https?:// ]]; then
  echo "Mengunduh file world dari URL..."
  INPUT_FILE="/tmp/converted_world_$(date +%s).zip"
  curl -L "$INPUT_SOURCE" -o "$INPUT_FILE"
else
  INPUT_FILE="$INPUT_SOURCE"
fi

if [ ! -f "$INPUT_FILE" ]; then
  echo "❌ Error: File $INPUT_FILE tidak ditemukan!"
  exit 1
fi

echo "[1/5] Menghentikan sementara server PaperMC..."
sudo systemctl stop minecraft-paper 2>/dev/null || true

echo "[2/5] Membuat cadangan world PaperMC sebelumnya..."
if [ -d "$PAPER_DIR/world" ]; then
  mv "$PAPER_DIR/world" "$PAPER_DIR/world_backup_$(date +%s)"
fi
rm -rf "$PAPER_DIR/world_nether" "$PAPER_DIR/world_the_end" 2>/dev/null || true

echo "[3/5] Mengekstrak world hasil konversi..."
TEMP_EXTRACT="$PAPER_DIR/temp_extract"
rm -rf "$TEMP_EXTRACT"
mkdir -p "$TEMP_EXTRACT"

python3 -c "import zipfile; zipfile.ZipFile('$INPUT_FILE').extractall('$TEMP_EXTRACT')"

# Periksa struktur direktori hasil ekstrak
if [ -f "$TEMP_EXTRACT/level.dat" ]; then
  mv "$TEMP_EXTRACT" "$PAPER_DIR/world"
elif [ -d "$TEMP_EXTRACT/world" ] && [ -f "$TEMP_EXTRACT/world/level.dat" ]; then
  mv "$TEMP_EXTRACT/world" "$PAPER_DIR/world"
  [ -d "$TEMP_EXTRACT/world_nether" ] && mv "$TEMP_EXTRACT/world_nether" "$PAPER_DIR/"
  [ -d "$TEMP_EXTRACT/world_the_end" ] && mv "$TEMP_EXTRACT/world_the_end" "$PAPER_DIR/"
  rm -rf "$TEMP_EXTRACT"
else
  SUBDIR=$(find "$TEMP_EXTRACT" -name "level.dat" -exec dirname {} \; | head -n 1)
  if [ -n "$SUBDIR" ]; then
    mv "$SUBDIR" "$PAPER_DIR/world"
    rm -rf "$TEMP_EXTRACT"
  else
    echo "❌ Error: Struktur world Java (level.dat) tidak ditemukan di dalam ZIP!"
    exit 1
  fi
fi

echo "[4/5] Menyelaraskan setelan server.properties dari Bedrock ke PaperMC..."
if [ -f "$BEDROCK_DIR/server.properties" ] && [ -f "$PAPER_DIR/server.properties" ]; then
  DIFF=$(grep "^difficulty=" "$BEDROCK_DIR/server.properties" | cut -d'=' -f2 || echo "normal")
  GAMEMODE=$(grep "^gamemode=" "$BEDROCK_DIR/server.properties" | cut -d'=' -f2 || echo "survival")
  SEED=$(grep "^level-seed=" "$BEDROCK_DIR/server.properties" | cut -d'=' -f2 || true)

  sed -i "s/^difficulty=.*/difficulty=$DIFF/" "$PAPER_DIR/server.properties" 2>/dev/null || true
  sed -i "s/^gamemode=.*/gamemode=$GAMEMODE/" "$PAPER_DIR/server.properties" 2>/dev/null || true
  if [ -n "$SEED" ]; then
    sed -i "s/^level-seed=.*/level-seed=$SEED/" "$PAPER_DIR/server.properties" 2>/dev/null || true
  fi
  echo "• Difficulty: $DIFF"
  echo "• Gamemode: $GAMEMODE"
fi

echo "[5/5] Menyalakan kembali PaperMC Crossplay..."
sudo systemctl start minecraft-paper

echo ""
echo "=========================================================="
echo "  ✅ WORLD BERHASIL DIPASANG KE PAPERMC CROSSPLAY!        "
echo "=========================================================="
echo "Semua bangunan, rumah, dan setelan dari Bedrock lama Anda"
echo "sekarang sudah aktif di server PaperMC!"
echo "• Java (PC 26.3 / TLauncher): 129.226.95.58:25565"
echo "• Bedrock (HP 1.21.x):        129.226.95.58:19132"
echo "=========================================================="
