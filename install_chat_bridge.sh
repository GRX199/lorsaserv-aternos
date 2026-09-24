#!/bin/bash
set -e

echo "=========================================================="
echo "  MEMASANG DISCORD CHAT BRIDGE DI SERVER MINECRAFT BEDROCK"
echo "=========================================================="

BEDROCK_DIR="$HOME/bedrock-server"
BP_DIR="$BEDROCK_DIR/behavior_packs/discord_chat_bridge"
WORLDS_DIR="$BEDROCK_DIR/worlds"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ ! -d "$BEDROCK_DIR" ]; then
  echo "❌ Direktori $BEDROCK_DIR tidak ditemukan. Pastikan Bedrock server sudah terpasang."
  exit 1
fi

# 1. Pastikan config/default/permissions.json mengizinkan Script API module
echo "[1/5] Menyiapkan izin module scripting di config/default/permissions.json..."
mkdir -p "$BEDROCK_DIR/config/default"
cat <<EOF > "$BEDROCK_DIR/config/default/permissions.json"
{
  "allowed_modules": [
    "@minecraft/server",
    "@minecraft/server-gametest",
    "@minecraft/server-ui",
    "@minecraft/server-admin",
    "@minecraft/server-net"
  ]
}
EOF
echo "✅ permissions.json berhasil dikonfigurasi."

# 1.5. Pastikan server.properties mengaktifkan content-log console output agar console.warn/log muncul di log terminal
PROP_FILE="$BEDROCK_DIR/server.properties"
if [ -f "$PROP_FILE" ]; then
  echo "Mengaktifkan content-log di server.properties..."
  for key in content-log-console-output-enabled content-log-file-enabled; do
    if grep -q "^$key=" "$PROP_FILE"; then
      sed -i "s/^$key=.*/$key=true/" "$PROP_FILE"
    else
      echo "$key=true" >> "$PROP_FILE"
    fi
  done
  if grep -q "^content-log-level=" "$PROP_FILE"; then
    sed -i "s/^content-log-level=.*/content-log-level=verbose/" "$PROP_FILE"
  else
    echo "content-log-level=verbose" >> "$PROP_FILE"
  fi
  echo "✅ server.properties berhasil dikonfigurasi: content-log-console-output-enabled=true"
fi

# 2. Aktifkan Beta APIs / GameTest di level.dat agar script chatSend dapat berjalan
echo "[2/5] Memeriksa & mengaktifkan Beta APIs di level.dat..."
if command -v python3 &> /dev/null; then
  if ! python3 -c "import nbtlib" &>/dev/null; then
    echo "Mengunduh modul nbtlib..."
    python3 -m pip install --quiet --break-system-packages nbtlib 2>/dev/null || pip3 install --quiet nbtlib 2>/dev/null || { sudo apt-get update -y && sudo apt-get install -y python3-pip && pip3 install --quiet --break-system-packages nbtlib 2>/dev/null; } || true
  fi
  python3 "$SCRIPT_DIR/enable_experiments.py" "$BEDROCK_DIR" || true
else
  echo "ℹ️ python3 tidak ditemukan, melewati modifikasi level.dat otomatis."
fi

# 3. Salin file manifest.json & scripts/main.js
echo "[3/5] Menyalin Behavior Pack discord_chat_bridge..."
mkdir -p "$BP_DIR/scripts"
cp -rf "$SCRIPT_DIR/behavior_packs/discord_chat_bridge/"* "$BP_DIR/"
cp -f "$SCRIPT_DIR/behavior_packs/discord_chat_bridge/scripts/main.js" "$BP_DIR/scripts/main.js"
touch "$BP_DIR/scripts/main.js"
echo "✅ Behavior pack discord_chat_bridge berhasil disalin ke $BP_DIR"

# 4. Aktifkan pack ke semua world di folder worlds/
echo "[4/4] Mengaktifkan pack ke world_behavior_packs.json..."
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

# 5. Restart service server bedrock
echo "Merestart service minecraft-bedrock..."
sudo systemctl restart minecraft-bedrock || true

echo ""
echo "=========================================================="
echo "  SUKSES! CHAT BRIDGE 2 ARAH SUDAH AKTIF!"
echo "=========================================================="
echo "Setiap ada pemain yang mengetik di in-game chat Minecraft,"
echo "pesannya akan langsung diteruskan ke channel Discord!"
