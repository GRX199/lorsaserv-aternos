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
- `src/commands/restart.js`: Slash command `/restart-server` dengan countdown notifikasi in-game, real-time Discord embed progress bar, serta tombol Batalkan & Force Restart.
- `src/commands/cancel_restart.js`: Slash command `/cancel-restart` untuk membatalkan countdown yang sedang berjalan.
- `src/commands/enchant_admin.js`: Panel admin Discord & Slash command `/enchant-admin` untuk memberikan max enchant instan ke item pemain secara langsung via konsol BDS.
- `src/commands/spawn_storage.js`: Slash command `/spawn-storage` untuk memunculkan struktur otomatis (Auto Storage Golem, Iron Farm, Sugarcane, Chicken) instan di server BDS.

### 2. Script Otomasi VPS (`*.sh` & `scripts/`)
- `scripts/restart_countdown.sh` & `restart.sh`: Script countdown restart 60 detik di VPS dengan progress bar terminal interaktif, siaran Title/Actionbar/Tellraw/Sound in-game, auto-save world (`save hold`), dan pembatalan mudah via `Ctrl+C`.
- `scripts/install_restart_alias.sh`: Memasang shortcut `mc-restart` dan `restart-server` ke `/usr/local/bin` dan alias `~/.bashrc`.
- `render_world_map.sh`: Script otomatis pengunduh uNmINeD CLI, me-render LevelDB Bedrock menjadi tile peta web format PNG, dengan dukungan `--zoomin=2` dan kontrol prioritas CPU `nice -n 19`.
- `setup_bedrock_server.sh`: Setup otomatis BDS, dependensi Linux, memory swap 2GB, dan konfigurasi `transport=raknet`.
- `install_chat_bridge.sh` & `diagnose_chat.sh`: Jembatan obrolan antara in-game Minecraft dan channel Discord.

### 3. Konfigurasi Protokol Jaringan (`server.properties`)
- **Protokol Transport**: `transport=raknet`
  - *Catatan Penting*: BDS menggunakan RakNet UDP langsung ke port 19132. Jangan diubah ke NetherNet agar client di HP/PC tidak mengalami error *"multiplayer services timeout"*.
- **Port**: `server-port=19132`, `server-portv6=19133`
- **Binding IP**: `server-ip=0.0.0.0`

---

## ⏱️ Sistem Safe Countdown Restart (60 Detik)

Sistem ini memastikan pemain di server tidak terputus mendadak atau kehilangan item saat server di-restart:

1. **Notifikasi In-Game Otomatis**:
   - **T-60 Detik**: Layar Title besar `RESTART SERVER Dalam 1 menit!`, pesan chat `[PERINGATAN]`, dan suara alarm `random.levelup`.
   - **T-45 Detik**: Pesan chat & suara `note.bell`.
   - **T-30 Detik**: Actionbar merah berkedip `⚠️ RESTART DALAM 30 DETIK!` & suara lonceng `block.bell.hit`.
   - **T-15 Detik**: Actionbar & peringatan chat.
   - **T-10 Detik**: Layar Title `10 DETIK Bersiap logout...` & suara `random.orb`.
   - **T-5 s/d 1 Detik**: Layar Title angka mundur `5..4..3..2..1` & suara klik `random.click`.
   - **T-0 Detik**: Title `RESTARTING NOW`, perintah `save hold` (simpan world ke disk), lalu me-restart service BDS.

2. **Pembatalan Aman (Cancel)**:
   - Jika dibatalkan (via Discord atau `Ctrl+C` di VPS), sistem langsung mengirim Title `RESTART DIBATALKAN`, Tellraw penenang, dan suara `random.toast`. Pemain tetap aman bermain tanpa lag atau server mati.

---

## 🛠️ Perintah Berguna di VPS

```bash
# 1. Update kode bot terbaru dari GitHub & pasang shortcut
cd ~/lorsaserv-aternos
git pull origin main
pm2 restart all
bash scripts/install_restart_alias.sh

# 2. Restart Server dengan Countdown 60 Detik (Disarankan)
mc-restart              # Countdown 60 detik (bisa dibatalkan dengan Ctrl+C)
mc-restart 30           # Countdown kustom 30 detik
mc-restart 0            # Restart instan tanpa countdown

# 3. Render / update tampilan Web Map
bash render_world_map.sh

# 4. Kontrol Langsung Service Systemd
sudo systemctl status minecraft-bedrock
sudo systemctl restart minecraft-bedrock
sudo systemctl stop minecraft-bedrock

# 5. Monitor Log Server Real-Time
tail -f ~/bedrock-server/server.log
```
