# 🎮 SASY199 • Minecraft Bedrock Server & Discord Ecosystem

Dokumentasi lengkap proyek integrasi server Minecraft Bedrock Dedicated Server (BDS) 24/7 di VPS Tencent Cloud dengan Bot Discord multi-fitur dan Web Visual Map 2D (uNmINeD).

---

## 📌 Ringkasan Ekosistem
- **Server Game**: Minecraft Bedrock Dedicated Server (BDS Linux x64) berjalan 24/7 di Ubuntu VPS Tencent Cloud via `systemd` (`minecraft-bedrock.service`).
- **IP Publik & Port**: `129.226.95.58` • Port `19132` (UDP RakNet)
- **Web Map 2D (uNmINeD)**: `http://129.226.95.58:3000/world-map/`
- **Dashboard Web & Live Radar**: `http://129.226.95.58:3000/map`
- **Bot Discord**: Node.js v20 (discord.js v14) dimonitor oleh PM2 di VPS (`pm2 restart all`).
- **Remote Git**: `https://github.com/GRX199/lorsaserv-aternos.git`

---

## 🏗️ Komponen Utama

### 1. Bot Discord (`src/`)
- `src/bot.js` & `src/index.js`: Entry point bot Discord.
- `src/server.js`: Web server HTTP port 3000:
  - Endpoint `/world-map/`: Web Map OpenLayers uNmINeD (Dark Void theme, base href auto-injection, fallback transparent tile 1x1, over-zoom booster).
  - Endpoint `/world-map/custom.markers.js`: Marker live koordinat pemain (avatar kepala skin, status online/offline, label ringkas).
  - Endpoint `/map`: Radar status live server & tabel posisi pemain.
  - Endpoint `/health`: Healthcheck uptime untuk Render/VPS.
- `src/playerLogMonitor.js`: Memantau file log BDS (`screenlog.0` / `server.log`) secara real-time untuk mencatat pemain yang join/leave dan update koordinat.
- `src/backupManager.js`: Otomatisasi backup berkala world Bedrock ke arsip zip.

### 2. Script Otomasi VPS (`*.sh`)
- `render_world_map.sh`: Script otomatis pengunduh uNmINeD CLI, me-render LevelDB Bedrock menjadi tile peta web format PNG, dengan dukungan `--zoomin=2` dan kontrol prioritas CPU `nice -n 19`.
- `setup_bedrock_server.sh`: Setup otomatis BDS, dependensi Linux, memory swap 2GB, dan konfigurasi `transport=raknet`.
- `install_chat_bridge.sh` & `diagnose_chat.sh`: Jembatan obrolan antara in-game Minecraft dan channel Discord.

### 3. Konfigurasi Protokol Jaringan (`server.properties`)
- **Protokol Transport**: `transport=raknet`
  - *Catatan Penting*: BDS menggunakan RakNet UDP langsung ke port 19132. Jangan diubah ke NetherNet agar client di HP/PC tidak mengalami error *"multiplayer services timeout"*.
- **Port**: `server-port=19132`, `server-portv6=19133`
- **Binding IP**: `server-ip=0.0.0.0`

---

## 🛠️ Perintah Berguna di VPS

```bash
# 1. Update kode bot terbaru dari GitHub & restart
cd ~/lorsaserv-aternos
git pull origin main
pm2 restart all

# 2. Render / update tampilan Web Map
bash render_world_map.sh

# 3. Kontrol Server Minecraft Bedrock
sudo systemctl status minecraft-bedrock
sudo systemctl restart minecraft-bedrock
sudo systemctl stop minecraft-bedrock

# 4. Monitor Log Server Real-Time
tail -f ~/bedrock-server/server.log
```
