#!/bin/bash
set -e

echo "========================================================"
echo "  MEMASANG MINECRAFT DISCORD STATUS BOT DI VPS TENCENT  "
echo "========================================================"
echo ""

# Ambil token dari argumen jika ada
if [ -n "$1" ]; then
    DISCORD_TOKEN="$1"
fi

# Input konfigurasi dengan membaca langsung dari tty (keyboard)
while [ -z "$DISCORD_TOKEN" ]; do
    echo "Silakan masukkan Token bot Discord Anda:"
    if [ -e /dev/tty ]; then
        read -rp "1. Masukkan DISCORD_TOKEN: " DISCORD_TOKEN < /dev/tty
    else
        read -rp "1. Masukkan DISCORD_TOKEN: " DISCORD_TOKEN
    fi

    if [ -z "$DISCORD_TOKEN" ]; then
        echo "[PERINGATAN] DISCORD_TOKEN tidak boleh kosong!"
    fi
done

if [ -z "$CLIENT_ID" ]; then
    if [ -e /dev/tty ]; then
        read -rp "2. Masukkan CLIENT_ID [1551859313495253064]: " input_client_id < /dev/tty
    else
        read -rp "2. Masukkan CLIENT_ID [1551859313495253064]: " input_client_id
    fi
    CLIENT_ID=${input_client_id:-1551859313495253064}
fi

if [ -z "$STATUS_CHANNEL_ID" ]; then
    if [ -e /dev/tty ]; then
        read -rp "3. Masukkan STATUS_CHANNEL_ID [1551864566475128894]: " input_channel_id < /dev/tty
    else
        read -rp "3. Masukkan STATUS_CHANNEL_ID [1551864566475128894]: " input_channel_id
    fi
    STATUS_CHANNEL_ID=${input_channel_id:-1551864566475128894}
fi

echo ""
echo "[1/5] Memperbarui sistem dan menginstall alat pendukung..."
if command -v apt-get &> /dev/null; then
    sudo apt-get update -y
    sudo apt-get install -y curl git
elif command -v yum &> /dev/null; then
    sudo yum update -y
    sudo yum install -y curl git
fi

echo "[2/5] Menginstall Node.js..."
if ! command -v node &> /dev/null; then
    if command -v apt-get &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    elif command -v yum &> /dev/null; then
        curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
        sudo yum install -y nodejs
    fi
fi

echo "[3/5] Menginstall PM2..."
sudo npm install -g pm2

echo "[4/5] Mengunduh repository bot..."
cd "$HOME"
if [ -d "lorsaserv-aternos" ]; then
    cd lorsaserv-aternos
    git pull
else
    git clone https://github.com/GRX199/lorsaserv-aternos.git
    cd lorsaserv-aternos
fi

npm install

echo "[5/5] Membuat file konfigurasi .env..."
cat << EOF > .env
DISCORD_TOKEN=${DISCORD_TOKEN}
CLIENT_ID=${CLIENT_ID}
STATUS_CHANNEL_ID=${STATUS_CHANNEL_ID}
PORT=3000
EOF

# Jalankan bot di latar belakang
pm2 delete minecraft-bot 2>/dev/null || true
pm2 start src/index.js --name "minecraft-bot"
pm2 save
pm2 startup systemd -u "$USER" --hp "$HOME" 2>/dev/null || true

echo ""
echo "========================================================"
echo "  SELAMAT! BOT MINECRAFT SUDAH AKTIF 24 JAM DI VPS!    "
echo "========================================================"
echo ""
pm2 status
echo ""
echo "Untuk melihat log langsung bot, ketik: pm2 logs minecraft-bot"
