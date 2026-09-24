#!/usr/bin/env bash
# ==============================================================================
# Script: render_world_map.sh
# Deskripsi: Mengunduh uNmINeD CLI (Linux x64) dan me-render visual blok dunia asli
#            Minecraft Bedrock Dedicated Server (BDS) LevelDB ke Web Map.
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BOT_DIR="${SCRIPT_DIR}"
HOME_DIR="${HOME:-/home/ubuntu}"
BDS_DIR="${HOME_DIR}/bedrock-server"
UNMINED_DIR="${HOME_DIR}/unmined-cli"
UNMINED_BIN="${UNMINED_DIR}/unmined-cli"
OUTPUT_DIR="${BOT_DIR}/public/world_map"

echo "=========================================================="
echo "🗺️  Minecraft Bedrock Visual World Map Renderer (uNmINeD)"
echo "=========================================================="

# 1. Deteksi Folder World Bedrock Server
SERVER_PROPERTIES="${BDS_DIR}/server.properties"
LEVEL_NAME="Bedrock level"

if [ -f "${SERVER_PROPERTIES}" ]; then
  PROP_VAL=$(grep -E "^level-name=" "${SERVER_PROPERTIES}" | cut -d'=' -f2- | tr -d '\r' || true)
  if [ -n "${PROP_VAL}" ]; then
    LEVEL_NAME="${PROP_VAL}"
  fi
fi

WORLD_DIR="${BDS_DIR}/worlds/${LEVEL_NAME}"

if [ ! -d "${WORLD_DIR}" ]; then
  # Cek jika ada folder world lain
  ALT_WORLD=$(find "${BDS_DIR}/worlds" -mindepth 1 -maxdepth 1 -type d | head -n 1 || true)
  if [ -n "${ALT_WORLD}" ] && [ -d "${ALT_WORLD}/db" ]; then
    WORLD_DIR="${ALT_WORLD}"
    echo "ℹ️  Menggunakan folder world alternatif: ${WORLD_DIR}"
  else
    echo "❌ Error: Direktori world tidak ditemukan di ${WORLD_DIR}!"
    exit 1
  fi
fi

echo "📁 Direktori World: ${WORLD_DIR}"
echo "📁 Direktori Output: ${OUTPUT_DIR}"

# 2. Cek & Pasang uNmINeD CLI jika belum ada
if [ ! -f "${UNMINED_BIN}" ]; then
  echo "📥 uNmINeD CLI belum terpasang. Mengunduh uNmINeD CLI Linux x64..."
  mkdir -p "${UNMINED_DIR}"
  TMP_ARCHIVE="/tmp/unmined-cli.tar.gz"

  ARCH=$(uname -m)
  DOWNLOAD_URL="https://unmined.net/download/unmined-cli-linux-x64-dev/"
  if [ "${ARCH}" = "aarch64" ] || [ "${ARCH}" = "arm64" ]; then
    DOWNLOAD_URL="https://unmined.net/download/unmined-cli-linux-arm64-dev/"
  fi

  curl -f -sSL "${DOWNLOAD_URL}" -o "${TMP_ARCHIVE}" || {
    echo "❌ Gagal mengunduh uNmINeD CLI dari ${DOWNLOAD_URL}"
    rm -f "${TMP_ARCHIVE}"
    exit 1
  }

  echo "📦 Mengekstrak uNmINeD CLI ke ${UNMINED_DIR}..."
  tar -xzf "${TMP_ARCHIVE}" -C "${UNMINED_DIR}"
  rm -f "${TMP_ARCHIVE}"
  chmod +x "${UNMINED_BIN}" || true
  echo "✅ uNmINeD CLI berhasil dipasang!"
fi

# 3. Buat Folder Output Web Map
mkdir -p "${OUTPUT_DIR}"

# 4. Jalankan Proses Render dengan CPU Prioritas Rendah (nice -n 19)
echo "🔨 Me-render visual blok dunia Minecraft Bedrock LevelDB..."
echo "ℹ️  Menggunakan nice -n 19 (background CPU) agar BDS tidak mengalami lag."

nice -n 19 "${UNMINED_BIN}" web render \
  --world="${WORLD_DIR}" \
  --output="${OUTPUT_DIR}" \
  --shadows=true \
  --blockrender=true || {
    # Jika gagal dengan opsi tambahan, jalankan render standar
    echo "⚠️  Mencoba fallback perintah render standar..."
    nice -n 19 "${UNMINED_BIN}" web render \
      --world="${WORLD_DIR}" \
      --output="${OUTPUT_DIR}"
  }

# 5. Normalisasi File Index
if [ -f "${OUTPUT_DIR}/unmined.index.html" ] && [ ! -f "${OUTPUT_DIR}/index.html" ]; then
  cp "${OUTPUT_DIR}/unmined.index.html" "${OUTPUT_DIR}/index.html"
fi

# 6. Injeksi Navigasi Cepat (Radar & Masuk Game) ke index.html jika belum ada
TARGET_HTML=""
if [ -f "${OUTPUT_DIR}/index.html" ]; then
  TARGET_HTML="${OUTPUT_DIR}/index.html"
elif [ -f "${OUTPUT_DIR}/unmined.index.html" ]; then
  TARGET_HTML="${OUTPUT_DIR}/unmined.index.html"
fi

if [ -n "${TARGET_HTML}" ] && ! grep -q "lorsaserv-header" "${TARGET_HTML}"; then
  echo "🎨 Menambahkan bilah kontrol cepat ke halaman Web Map..."
  HEADER_HTML='<div id="lorsaserv-header" style="position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;gap:12px;align-items:center;background:rgba(18,20,24,0.92);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.15);border-radius:30px;padding:8px 20px;box-shadow:0 10px 30px rgba(0,0,0,0.6);font-family:system-ui,-apple-system,sans-serif;font-size:13px;color:#fff;"><span style="font-weight:700;display:flex;align-items:center;gap:6px;"><span style="color:#2ecc71;">●</span> SASY199</span><span style="color:rgba(255,255,255,0.25);">|</span><a href="/map" style="color:#38bdf8;text-decoration:none;font-weight:600;display:flex;align-items:center;gap:4px;">📡 Radar &amp; Koordinat</a><span style="color:rgba(255,255,255,0.25);">|</span><a href="/connect" style="color:#2ecc71;text-decoration:none;font-weight:700;display:flex;align-items:center;gap:4px;">🎮 Masuk Game</a></div>'
  sed -i "s|</body>|${HEADER_HTML}</body>|g" "${TARGET_HTML}"
fi

echo "=========================================================="
echo "🎉 Visual World Map Berhasil Di-render!"
echo "🌐 Buka peta visual di: http://129.226.95.58:3000/world-map"
echo "=========================================================="
