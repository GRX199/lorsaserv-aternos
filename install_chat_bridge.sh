#!/bin/bash
set -e

echo "=========================================================="
echo "  MEMASANG DISCORD CHAT BRIDGE DI SERVER MINECRAFT BEDROCK"
echo "=========================================================="

BEDROCK_DIR="$HOME/bedrock-server"
BP_DIR="$BEDROCK_DIR/behavior_packs/discord_chat_bridge"
WORLDS_DIR="$BEDROCK_DIR/worlds"

if [ ! -d "$BEDROCK_DIR" ]; then
  echo "❌ Direktori $BEDROCK_DIR tidak ditemukan. Pastikan Bedrock server sudah terpasang."
  exit 1
fi

# 1. Pastikan direktori behavior pack ada
mkdir -p "$BP_DIR/scripts"

# 2. Salin file manifest.json & scripts/main.js
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cp -r "$SCRIPT_DIR/behavior_packs/discord_chat_bridge/"* "$BP_DIR/"
echo "✅ Behavior pack discord_chat_bridge berhasil disalin ke $BP_DIR"

# 3. Aktifkan pack ke semua world di folder worlds/
PACK_UUID="a7b8c9d0-1234-4567-89ab-cdef01234567"

if [ -d "$WORLDS_DIR" ]; then
  for world in "$WORLDS_DIR"/*; do
    if [ -d "$world" ]; then
      WORLD_BP_FILE="$world/world_behavior_packs.json"
      echo "Mengaktifkan chat bridge di world: $(basename "$world")..."

      if [ -f "$WORLD_BP_FILE" ]; then
        if ! grep -q "$PACK_UUID" "$WORLD_BP_FILE"; then
          node -e "
            const fs = require('fs');
            const file = '$WORLD_BP_FILE';
            let data = [];
            try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
            data.push({ pack_id: '$PACK_UUID', version: [1, 0, 0] });
            fs.writeFileSync(file, JSON.stringify(data, null, 2));
          "
        fi
      else
        cat <<EOF > "$WORLD_BP_FILE"
[
  {
    "pack_id": "$PACK_UUID",
    "version": [1, 0, 0]
  }
]
EOF
      fi
      echo "✅ Berhasil diaktifkan di $WORLD_BP_FILE"
    fi
  done
fi

# 4. Restart service server bedrock
echo "Merestart service minecraft-bedrock..."
sudo systemctl restart minecraft-bedrock

echo ""
echo "=========================================================="
echo "  SUKSES! CHAT BRIDGE 2 ARAH SUDAH AKTIF!"
echo "=========================================================="
echo "Setiap ada pemain yang mengetik di in-game chat Minecraft,"
echo "pesannya akan langsung diteruskan ke channel Discord!"
