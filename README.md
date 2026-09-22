# 🟢 Minecraft Bedrock (Aternos) Discord Status Bot

Bot Discord modern dan super ringan untuk memantau status server **Minecraft Bedrock** (khususnya hosting gratis seperti **Aternos**) secara real-time langsung di server Discord Anda.

---

## ✨ Fitur Unggulan

- 🟢 **Live Status Panel (Auto-Update)**: Embed status otomatis diperbarui setiap 45–60 detik tanpa membuat spam pesan baru di channel.
- 👥 **Channel Counter Otomatis**: Nama channel (Voice atau Text) dapat berubah otomatis menampilkan jumlah pemain aktif (contoh: `🟢・3/20-online` atau `🔴・offline`).
- ⚡ **Dual-Engine Ping Cepat**:
  - RakNet UDP langsung via port Bedrock (resmi protokol Minecraft).
  - Fallback otomatis ke REST API mcstatus.io jika UDP dibatasi hosting / ISP.
  - Aman 100% tanpa login akun Aternos (anti-banned).
- 🎮 **Aktivitas Bot (Presence)**: Profil bot di Discord menampilkan status terkini: *"👥 3/20 pemain online"*.
- 🕹️ **Slash Commands & Tombol**:
  - `/setup-status` : Menaruh panel status live di channel yang diinginkan.
  - `/status` : Cek status server Minecraft kapan saja.
  - `/ip` : Menampilkan alamat IP & Port dengan tombol salin cepat.
  - Tombol **🔄 Perbarui Status** & **📋 Salin IP & Port** pada panel embed.
- ☁️ **Siap Hosting di Render (24/7 Gratis)**: Sudah dilengkapi built-in HTTP healthcheck server & file `render.yaml`.

---

## 📋 Persyaratan

- [Node.js](https://nodejs.org/) versi 18 atau lebih baru (v20 / v22 sangat direkomendasikan).
- Akun Discord & Server Discord tempat Anda menjadi Admin.
- Akun [Render.com](https://render.com/) (jika ingin hosting online 24/7).

---

## 🚀 Langkah 1: Buat Bot di Discord Developer Portal

1. Buka [Discord Developer Portal](https://discord.com/developers/applications).
2. Klik tombol **New Application**, beri nama bot Anda (misalnya `Minecraft Status`), lalu klik **Create**.
3. Di menu sebelah kiri, buka **Bot**:
   - Klik **Reset Token**, lalu salin token tersebut (ini adalah `DISCORD_TOKEN`). Simpan baik-baik dan jangan berikan ke orang lain.
4. Di menu sebelah kiri, buka **General Information**:
   - Salin **Application ID** (ini adalah `CLIENT_ID`).
5. Di menu sebelah kiri, buka **OAuth2** -> **URL Generator**:
   - Pada bagian **SCOPES**, centang:
     - `bot`
     - `applications.commands`
   - Pada bagian **BOT PERMISSIONS**, centang:
     - `Send Messages`
     - `Embed Links`
     - `Attach Files`
     - `Read Message History`
     - `Manage Messages`
     - `Manage Channels` (dibutuhkan jika Anda ingin fitur ubah nama channel counter pemain)
6. Salin link di bagian bawah (**Generated URL**), buka di browser, dan undang bot ke server Discord Anda.

---

## ⚙️ Langkah 2: Konfigurasi File Bot

Buka folder proyek bot ini di komputer Anda:

### 1. File `.env`
Salin file `.env.example` dan ubah namanya menjadi `.env`:
```env
DISCORD_TOKEN=Token_Bot_Dari_Developer_Portal
CLIENT_ID=Application_ID_Dari_Developer_Portal
GUILD_ID=                      # Kosongkan jika ingin slash command terdaftar di semua server
STATUS_CHANNEL_ID=123456789012 # ID channel Discord tempat live embed panel ditaruh
PLAYER_COUNT_CHANNEL_ID=       # (Opsional) ID voice/text channel counter pemain
PORT=3000
```

> **Tips Mendapatkan Channel ID**: 
> Di Discord, buka *User Settings* -> *Advanced* -> aktifkan **Developer Mode**. Lalu klik kanan pada channel yang diinginkan dan pilih **Copy Channel ID**.

### 2. File `config.json`
Sesuaikan dengan data server Minecraft Aternos Anda:
```json
{
  "mcserver": {
    "ip": "namaserver.aternos.me",
    "port": 12345,
    "type": "bedrock",
    "name": "NINDA SMP",
    "icon": "https://i.imgur.com/6Msem8Q.png",
    "footerText": "Minecraft Bedrock Server Monitor • Aternos Safe Ping"
  },
  "intervals": {
    "statusEmbedSeconds": 45,
    "channelNameMinutes": 5
  }
}
```

> [!IMPORTANT]
> **Khusus Aternos Bedrock**:
> Di dashboard Aternos, buka menu **Connect**. Ambil alamat server dan **Port**. Port di Bedrock Aternos biasanya berupa 5 digit angka acak (misal `34512`), **bukan** port default 19132. Pastikan port tersebut dimasukkan dengan benar!

---

## 💻 Jalankan di Komputer Lokal (Windows)

1. Klik dua kali file **`start.bat`**.
2. Script akan otomatis mengunduh dependensi (`npm install`) dan menyalakan bot.
3. Begitu bot online, buka server Discord Anda dan ketik:
   ```
   /setup-status
   ```
   Bot akan mengirim panel live status yang akan ter-update otomatis!

---

## ☁️ Panduan Hosting 24/7 Gratis di Render

Agar bot tetap online meskipun komputer/laptop Anda dimatikan, ikuti langkah mudah berikut untuk hosting di **Render.com**:

### Langkah A: Upload Kode ke GitHub
1. Buat repository baru di [GitHub](https://github.com/new) (bisa Private atau Public), misalnya `minecraft-discord-bot`.
2. Upload seluruh isi folder ini ke repository GitHub Anda (file `.env` tidak akan ter-upload karena sudah otomatis diabaikan oleh `.gitignore` demi keamanan).

### Langkah B: Deploy di Render
1. Buka [Render.com](https://render.com/) dan login menggunakan akun GitHub Anda.
2. Di dashboard Render, klik tombol **New +** lalu pilih **Web Service**.
3. Pilih repository GitHub yang baru saja Anda buat.
4. Isi data konfigurasi berikut:
   - **Name**: `minecraft-discord-bot` (bebas)
   - **Region**: `Singapore` (paling dekat dan cepat untuk Indonesia)
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`
5. Scroll ke bawah ke bagian **Environment Variables** (atau klik **Advanced**), tambahkan variabel berikut:
   - `DISCORD_TOKEN` : (Isi token bot Discord Anda)
   - `CLIENT_ID` : (Isi application ID bot Anda)
   - `STATUS_CHANNEL_ID` : (Isi ID channel status Discord Anda)
   - `PLAYER_COUNT_CHANNEL_ID` : (Opsional, isi jika ada)
6. Klik tombol **Deploy Web Service**.
7. Tunggu 1–2 menit hingga log menampilkan:
   ```
   🤖 Bot Discord Berhasil Login: NamaBot#0000
   [HTTP Server] Healthcheck web server listening on port 10000
   ```

### Langkah C: Trik Menjaga Bot Tetap Online 24/7 (Anti-Sleep)
Render paket *Free Web Service* akan tidur (sleep) setelah 15 menit jika tidak menerima kunjungan web. 

Karena bot ini sudah dilengkapi web server healthcheck bawaan di dalamnya:
1. Salin link URL Render bot Anda (misalnya `https://minecraft-discord-bot.onrender.com`).
2. Buka situs pinger gratis seperti **[UptimeRobot](https://uptimerobot.com/)** atau **[cron-job.org](https://cron-job.org/)**.
3. Daftarkan monitor baru:
   - **Monitor Type**: `HTTP(s)`
   - **URL**: Masukkan URL Render Anda (misal `https://minecraft-discord-bot.onrender.com/health`)
   - **Monitoring Interval**: Setiap `5 minutes` atau `10 minutes`.
4. Selesai! Bot Anda sekarang akan **aktif 24 jam nonstop (24/7) secara gratis** tanpa pernah tertidur!

---

## 🛠️ Troubleshoot

- **Status selalu Offline padahal server Aternos jalan**:
  - Pastikan server Aternos sudah benar-benar selesai loading dan berstatus *Online* di website Aternos.
  - Periksa kembali **Port** di `config.json`. Port Aternos Bedrock selalu spesifik sesuai yang tertera di tombol *Connect*.
- **Nama channel tidak berubah**:
  - Discord membatasi penggantian nama channel maksimal 2 kali setiap 10 menit. Tunggu minimal 5–10 menit.
  - Pastikan role Bot memiliki permission **Manage Channels** di channel tersebut.
