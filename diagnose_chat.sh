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
ls -la "$BEDROCK_DIR"/*.log "$BEDROCK_DIR"/screenlog* "$BEDROCK_DIR"/ContentLog* 2>/dev/null || echo "Tidak ada file .log/screenlog/ContentLog"

echo ""
echo "--- [3] 20 BARIS LOG BEDROCK TERAKHIR ---"
if [ -f "$BEDROCK_DIR/server.log" ] && [ -s "$BEDROCK_DIR/server.log" ]; then
  echo "Membaca $BEDROCK_DIR/server.log:"
  tail -n 20 "$BEDROCK_DIR/server.log"
fi

echo ""
echo "--- [4] FILTER SCRIPTING & CHAT DI SERVER.LOG ---"
grep -iE "script|chat|bridge" "$BEDROCK_DIR/server.log" 2>/dev/null | tail -n 20 || echo "Tidak ada catatan scripting/chat di server.log"

echo ""
echo "--- [5] CONTENT LOG (JIKA ADA ERROR PACK) ---"
for cl in "$BEDROCK_DIR"/ContentLog*.txt; do
  if [ -f "$cl" ]; then
    echo "Isi log $cl:"
    tail -n 25 "$cl"
  fi
done

echo ""
echo "--- [6] CEK EXPERIMENTS DI LEVEL.DAT ---"
python3 -c "
import nbtlib, os
path = '$BEDROCK_DIR/worlds/Bedrock level/level.dat'
if os.path.exists(path):
    f = open(path, 'rb')
    f.read(8)
    l = nbtlib.File.parse(f, byteorder='little')
    print('Experiments:', l.get('experiments'))
else:
    print('level.dat tidak ditemukan di Bedrock level')
" 2>/dev/null || echo "Gagal memeriksa experiments via python (nbtlib belum terpasang)"

echo ""
echo "--- [7] MANIFEST & SCRIPT DISCORD CHAT BRIDGE ---"
ls -la "$BEDROCK_DIR/behavior_packs/discord_chat_bridge" 2>/dev/null || true
if [ -f "$BEDROCK_DIR/behavior_packs/discord_chat_bridge/manifest.json" ]; then
  cat "$BEDROCK_DIR/behavior_packs/discord_chat_bridge/manifest.json"
fi

echo ""
echo "--- [8] 25 BARIS LOG DISCORD BOT (PM2) ---"
pm2 logs minecraft-bot --lines 25 --nostream || true
echo "=========================================================="
