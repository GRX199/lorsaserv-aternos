#!/bin/bash
set -e

echo "========================================================"
echo "  MEMASANG MINECRAFT BEDROCK DEDICATED SERVER DI VPS    "
echo "========================================================"
echo ""

# 1. Pastikan Swap 2GB tersedia agar RAM 2GB aman & tidak crash
echo "[1/6] Memeriksa & menyiapkan Swap Memory 2GB..."
SWAP_SIZE=$(free -m | awk '/^Swap:/ {print $2}')
if [ "$SWAP_SIZE" -lt 1000 ]; then
    echo "Membuat 2GB Swapfile..."
    sudo fallocate -l 2G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    if ! grep -q '/swapfile' /etc/fstab; then
        echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    fi
    echo "Swap 2GB berhasil diaktifkan!"
else
    echo "Swap sudah cukup (${SWAP_SIZE} MB)."
fi

# 2. Install dependensi Linux yang dibutuhkan Bedrock Server
echo "[2/6] Menginstall dependensi (libcurl4, unzip, jq, wget, screen)..."
if command -v apt-get &> /dev/null; then
    sudo apt-get update -y
    sudo apt-get install -y curl wget unzip jq libcurl4 libssl-dev screen
elif command -v yum &> /dev/null; then
    sudo yum update -y
    sudo yum install -y curl wget unzip jq libcurl openssl-devel screen
fi

# 3. Menyiapkan direktori server
BEDROCK_DIR="$HOME/bedrock-server"
echo "[3/6] Menyiapkan direktori: $BEDROCK_DIR..."
mkdir -p "$BEDROCK_DIR"
cd "$BEDROCK_DIR"

# 4. Unduh Bedrock Dedicated Server versi resmi terbaru dari Mojang
echo "[4/6] Mengunduh Minecraft Bedrock Dedicated Server terbaru dari Mojang..."
if [ ! -f "$BEDROCK_DIR/bedrock_server" ]; then
    DOWNLOAD_URL=$(curl -s https://net-secondary.web.minecraft-services.net/api/v1.0/download/links | jq -r '.result.links[] | select(.downloadType=="serverBedrockLinux") | .downloadUrl')

    if [ -z "$DOWNLOAD_URL" ] || [ "$DOWNLOAD_URL" == "null" ]; then
        DOWNLOAD_URL="https://minecraft.azureedge.net/bin-linux/bedrock-server-1.21.60.10.zip"
    fi

    echo "Mengunduh dari: $DOWNLOAD_URL"
    wget -q --show-progress -U "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36" "$DOWNLOAD_URL" -O bedrock-server.zip

    # Ekstrak file (tanpa menimpa server.properties dan world jika sudah ada)
    unzip -q -n bedrock-server.zip
    rm -f bedrock-server.zip
    chmod +x bedrock_server
else
    echo "File bedrock_server sudah ada di $BEDROCK_DIR. Melewati download."
fi

# 5. Optimasi konfigurasi server.properties untuk VPS 2GB RAM
echo "[5/6] Mengonfigurasi server.properties..."
if [ ! -f "server.properties.bak" ]; then
    cp server.properties server.properties.bak
fi

# Ubah setting agar hemat RAM dan lancar untuk 2GB RAM
sed -i 's/^server-name=.*/server-name=sasy199/' server.properties
sed -i 's/^server-port=.*/server-port=19132/' server.properties
sed -i 's/^server-portv6=.*/server-portv6=19133/' server.properties
sed -i 's/^view-distance=.*/view-distance=10/' server.properties
sed -i 's/^tick-distance=.*/tick-distance=4/' server.properties
sed -i 's/^max-players=.*/max-players=10/' server.properties
sed -i 's/^max-threads=.*/max-threads=4/' server.properties

# Pastikan transport menggunakan NetherNet (wajib untuk BDS 1.26+)
if grep -q "^transport=" server.properties; then
    sed -i 's/^transport=.*/transport=nethernet/' server.properties
else
    echo "transport=nethernet" >> server.properties
fi

# 6. Pasang Service systemd agar server jalan otomatis & bisa dikontrol Bot
echo "[6/6] Menyiapkan systemd service (minecraft-bedrock.service)..."
SERVICE_FILE="/etc/systemd/system/minecraft-bedrock.service"
CURRENT_USER=$(id -un)
CURRENT_HOME=$(eval echo "~$CURRENT_USER")
BEDROCK_DIR="$CURRENT_HOME/bedrock-server"

sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=Minecraft Bedrock Dedicated Server
After=network.target

[Service]
Type=simple
User=$CURRENT_USER
WorkingDirectory=$BEDROCK_DIR
Environment="LD_LIBRARY_PATH=.:$BEDROCK_DIR"
ExecStart=/usr/bin/screen -L -Logfile $BEDROCK_DIR/server.log -DmS mc-bedrock $BEDROCK_DIR/bedrock_server
Restart=on-failure
RestartSec=5s
KillSignal=SIGINT
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
EOF

# Berikan izin sudo tanpa password untuk perintah systemctl minecraft-bedrock agar Bot bisa menyalakan/mematikan server
SUDOERS_FILE="/etc/sudoers.d/minecraft-bedrock"
sudo tee "$SUDOERS_FILE" > /dev/null <<EOF
$CURRENT_USER ALL=(ALL) NOPASSWD: /bin/systemctl start minecraft-bedrock, /bin/systemctl stop minecraft-bedrock, /bin/systemctl restart minecraft-bedrock, /bin/systemctl is-active minecraft-bedrock, /bin/systemctl status minecraft-bedrock, /bin/journalctl, /usr/bin/journalctl
EOF
sudo chmod 440 "$SUDOERS_FILE"

sudo systemctl daemon-reload
sudo systemctl enable minecraft-bedrock
sudo systemctl restart minecraft-bedrock || sudo systemctl start minecraft-bedrock

echo ""
echo "========================================================"
echo "  SELAMAT! MINECRAFT BEDROCK SERVER SUDAH AKTIF 24/7!   "
echo "========================================================"
echo "Status server saat ini:"
sudo systemctl status minecraft-bedrock --no-pager || true
echo ""
echo "PENTING: Di Tencent Cloud Console, buka menu Firewall / Security Group,"
echo "lalu tambahkan izin (Allow) untuk Port UDP 19132 agar pemain bisa bergabung!"
