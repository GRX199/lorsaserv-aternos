#!/bin/bash
set -e

echo "=========================================================="
echo "      MINECRAFT BEDROCK DEDICATED SERVER ADD-ON INSTALLER "
echo "=========================================================="

BEDROCK_DIR="$HOME/bedrock-server"
WORLDS_DIR="$BEDROCK_DIR/worlds"
PROP_FILE="$BEDROCK_DIR/server.properties"

if [ ! -d "$BEDROCK_DIR" ]; then
  echo "❌ Direktori $BEDROCK_DIR tidak ditemukan!"
  exit 1
fi

INPUT_SRC="$1"

if [ -z "$INPUT_SRC" ]; then
  echo "Penggunaan:"
  echo "  ./install_addon.sh <path_file_mcaddon_atau_url>"
  echo ""
  echo "Contoh:"
  echo "  ./install_addon.sh /path/ke/health_indicator.mcaddon"
  echo "  ./install_addon.sh https://example.com/health_bar.mcaddon"
  echo ""
  exit 1
fi

TEMP_DIR=$(mktemp -d /tmp/bds_addon_XXXXXX)
trap "rm -rf '$TEMP_DIR'" EXIT

TARGET_FILE="$TEMP_DIR/addon.zip"

if [[ "$INPUT_SRC" =~ ^https?:// ]]; then
  echo "[1/4] Mengunduh Add-on dari URL: $INPUT_SRC ..."
  wget -q --show-progress -U "Mozilla/5.0" "$INPUT_SRC" -O "$TARGET_FILE" || {
    echo "❌ Gagal mengunduh file dari $INPUT_SRC"
    exit 1
  }
else
  if [ ! -f "$INPUT_SRC" ]; then
    echo "❌ File $INPUT_SRC tidak ditemukan!"
    exit 1
  fi
  echo "[1/4] Menggunakan file lokal: $INPUT_SRC ..."
  cp "$INPUT_SRC" "$TARGET_FILE"
fi

echo "[2/4] Mengekstrak file Add-on..."
EXTRACT_DIR="$TEMP_DIR/extracted"
mkdir -p "$EXTRACT_DIR"
unzip -q "$TARGET_FILE" -d "$EXTRACT_DIR" || {
  echo "❌ Gagal mengekstrak archive Add-on!"
  exit 1
}

# Jika di dalamnya ada sub-file .mcpack (misal .mcaddon berisi bp.mcpack dan rp.mcpack)
find "$EXTRACT_DIR" -name "*.mcpack" | while read -r mcpack_file; do
  pack_sub_dir="${mcpack_file%.mcpack}"
  mkdir -p "$pack_sub_dir"
  unzip -q -o "$mcpack_file" -d "$pack_sub_dir" || true
  rm -f "$mcpack_file"
done

echo "[3/4] Menganalisis manifest.json dan memasang ke direktori BDS..."
node -e '
const fs = require("fs");
const path = require("path");

const extractDir = process.argv[1];
const bedrockDir = process.argv[2];

function findManifests(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findManifests(fullPath, results);
    } else if (entry.name.toLowerCase() === "manifest.json") {
      results.push(fullPath);
    }
  }
  return results;
}

const manifests = findManifests(extractDir);
if (manifests.length === 0) {
  console.error("❌ Tidak ditemukan manifest.json yang valid di dalam addon!");
  process.exit(1);
}

const installedPacks = [];

for (const manifestPath of manifests) {
  try {
    const raw = fs.readFileSync(manifestPath, "utf8");
    const manifest = JSON.parse(raw);
    const header = manifest.header || {};
    const modules = manifest.modules || [];
    const packUuid = header.uuid;
    const version = header.version || [1, 0, 0];
    const name = header.name || path.basename(path.dirname(manifestPath));
    const safeFolderName = name.replace(/[^a-zA-Z0-9_\-\.]/g, "_").toLowerCase() + "_" + packUuid.slice(0, 8);

    const isResource = modules.some(m => m.type === "resources" || m.type === "client_data");
    const isBehavior = modules.some(m => m.type === "data" || m.type === "script" || m.type === "javascript");

    const packFolder = path.dirname(manifestPath);
    let targetType = "behavior_packs";
    if (isResource && !isBehavior) {
      targetType = "resource_packs";
    }

    const targetDir = path.join(bedrockDir, targetType, safeFolderName);
    fs.mkdirSync(targetDir, { recursive: true });

    // Salin seluruh isi folder pack
    function copyRecursive(src, dest) {
      if (!fs.existsSync(src)) return;
      const stats = fs.statSync(src);
      if (stats.isDirectory()) {
        fs.mkdirSync(dest, { recursive: true });
        for (const file of fs.readdirSync(src)) {
          copyRecursive(path.join(src, file), path.join(dest, file));
        }
      } else {
        fs.copyFileSync(src, dest);
      }
    }

    copyRecursive(packFolder, targetDir);

    installedPacks.push({
      type: targetType,
      name,
      uuid: packUuid,
      version: Array.isArray(version) ? version : [1, 0, 0],
      dir: targetDir
    });

    console.log(`✅ Berhasil menyalin ${name} [${targetType}] (UUID: ${packUuid})`);
  } catch (err) {
    console.warn(`⚠️ Gagal memproses manifest di ${manifestPath}: ${err.message}`);
  }
}

// Daftarkan ke semua world di worlds/
const worldsDir = path.join(bedrockDir, "worlds");
if (fs.existsSync(worldsDir)) {
  const worlds = fs.readdirSync(worldsDir, { withFileTypes: true }).filter(d => d.isDirectory());
  for (const w of worlds) {
    const worldPath = path.join(worldsDir, w.name);

    for (const pack of installedPacks) {
      const configName = pack.type === "resource_packs" ? "world_resource_packs.json" : "world_behavior_packs.json";
      const configPath = path.join(worldPath, configName);

      let list = [];
      if (fs.existsSync(configPath)) {
        try {
          list = JSON.parse(fs.readFileSync(configPath, "utf8"));
          if (!Array.isArray(list)) list = [];
        } catch {}
      }

      const existingIndex = list.findIndex(item => item.pack_id === pack.uuid);
      if (existingIndex >= 0) {
        list[existingIndex].version = pack.version;
      } else {
        list.push({ pack_id: pack.uuid, version: pack.version });
      }

      fs.writeFileSync(configPath, JSON.stringify(list, null, 2));
      console.log(`📌 Diaktifkan pada world "${w.name}": ${configName}`);
    }
  }
}
' "$EXTRACT_DIR" "$BEDROCK_DIR"

# 4. Pastikan texturepack-required=true agar resource pack otomatis diunduh oleh pemain saat join
if [ -f "$PROP_FILE" ]; then
  if grep -q "^texturepack-required=" "$PROP_FILE"; then
    sed -i 's/^texturepack-required=.*/texturepack-required=true/' "$PROP_FILE"
  else
    echo "texturepack-required=true" >> "$PROP_FILE"
  fi
  echo "✅ Mengaktifkan texturepack-required=true di server.properties"
fi

echo ""
echo "[4/4] Merestart Minecraft Bedrock Server..."
sudo systemctl restart minecraft-bedrock || true

echo ""
echo "=========================================================="
echo "  SUKSES! Add-on berhasil dipasang dan diaktifkan!"
echo "=========================================================="
