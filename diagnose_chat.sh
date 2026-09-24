#!/bin/bash
echo "=========================================================="
echo "          DIAGNOSTIK CHAT & LOG BEDROCK SERVER            "
echo "=========================================================="

BEDROCK_DIR="$HOME/bedrock-server"

echo ""
echo "--- [1] STATUS SERVICE SYSTEMD ---"
sudo systemctl status minecraft-bedrock --no-pager | head -n 15 || true

echo ""
echo "--- [2] FILE LOG DI BEDROCK DIR ---"
ls -la "$BEDROCK_DIR"/*.log "$BEDROCK_DIR"/screenlog* 2>/dev/null || echo "Tidak ada file .log atau screenlog"

echo ""
echo "--- [3] 20 BARIS LOG BEDROCK TERAKHIR ---"
if [ -f "$BEDROCK_DIR/server.log" ] && [ -s "$BEDROCK_DIR/server.log" ]; then
  echo "Membaca $BEDROCK_DIR/server.log:"
  tail -n 20 "$BEDROCK_DIR/server.log"
elif [ -f "$BEDROCK_DIR/screenlog.0" ] && [ -s "$BEDROCK_DIR/screenlog.0" ]; then
  echo "Membaca $BEDROCK_DIR/screenlog.0:"
  tail -n 20 "$BEDROCK_DIR/screenlog.0"
else
  echo "File server.log kosong atau belum terisi."
fi

echo ""
echo "--- [4] PERMISSIONS & BEHAVIOR PACKS ---"
if [ -f "$BEDROCK_DIR/config/default/permissions.json" ]; then
  echo "permissions.json ditemukan:"
  cat "$BEDROCK_DIR/config/default/permissions.json"
else
  echo "⚠️ permissions.json TIDAK DITEMUKAN di $BEDROCK_DIR/config/default/"
fi

echo ""
echo "Folder behavior_packs:"
ls -la "$BEDROCK_DIR/behavior_packs" 2>/dev/null || echo "behavior_packs kosong/tidak ada"

echo ""
echo "--- [5] WORLD BEHAVIOR PACKS JSON ---"
for w in "$BEDROCK_DIR"/worlds/*; do
  if [ -d "$w" ]; then
    echo "World: $(basename "$w")"
    if [ -f "$w/world_behavior_packs.json" ]; then
      cat "$w/world_behavior_packs.json"
      echo ""
    else
      echo "⚠️ world_behavior_packs.json TIDAK ADA di $w"
    fi
  fi
done

echo ""
echo "--- [6] 30 BARIS LOG DISCORD BOT (PM2) ---"
pm2 logs minecraft-bot --lines 30 --nostream || true
echo "=========================================================="
