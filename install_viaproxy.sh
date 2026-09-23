#!/bin/bash
set -e

echo "=========================================================="
echo "    MEMASANG VIAPROXY (JAVA PC CROSSPLAY KE BEDROCK)      "
echo "=========================================================="

CURRENT_USER=$(id -un)
CURRENT_HOME=$(eval echo "~$CURRENT_USER")
VIAPROXY_DIR="$CURRENT_HOME/viaproxy"

# 1. Install Java 21 JRE & dependensi
echo "[1/4] Memeriksa & memasang OpenJDK JRE..."
if ! command -v java &> /dev/null; then
  sudo apt-get update -y
  sudo apt-get install -y openjdk-21-jre-headless jq curl wget
else
  echo "Java sudah terpasang: $(java -version 2>&1 | head -n 1)"
fi

# 2. Siapkan direktori ~/viaproxy
echo "[2/4] Menyiapkan direktori $VIAPROXY_DIR..."
mkdir -p "$VIAPROXY_DIR"
cd "$VIAPROXY_DIR"

# 3. Unduh ViaProxy.jar versi terbaru dari GitHub Releases
echo "[3/4] Mengunduh versi terbaru ViaProxy.jar dari GitHub..."
DOWNLOAD_URL=$(curl -s https://api.github.com/repos/ViaVersion/ViaProxy/releases/latest | jq -r '.assets[] | select(.name | test("ViaProxy-.*\\.jar$") and (test("java8") | not)) | .browser_download_url' | head -n 1)

if [ -z "$DOWNLOAD_URL" ] || [ "$DOWNLOAD_URL" == "null" ]; then
  DOWNLOAD_URL="https://github.com/ViaVersion/ViaProxy/releases/download/v3.3.4/ViaProxy-3.3.4.jar"
fi

echo "Mengunduh dari: $DOWNLOAD_URL"
wget -q --show-progress "$DOWNLOAD_URL" -O viaproxy.jar

# 4. Generate & konfigurasi viaproxy.yml
echo "[4/4] Mengonfigurasi viaproxy.yml..."
if [ ! -f "viaproxy.yml" ]; then
  java -jar viaproxy.jar config viaproxy.yml 2>/dev/null || true
fi

if [ -f "viaproxy.yml" ]; then
  # Ubah port bind & target di viaproxy.yml
  sed -i 's|bind-address:.*|bind-address: 0.0.0.0:25565|' viaproxy.yml || true
  sed -i 's|target-address:.*|target-address: 127.0.0.1:19132|' viaproxy.yml || true
else
  cat <<EOF > viaproxy.yml
bind-address: 0.0.0.0:25565
target-address: 127.0.0.1:19132
EOF
fi

# 5. Pasang systemd service agar ViaProxy jalan otomatis 24/7 di background
SERVICE_FILE="/etc/systemd/system/viaproxy.service"
echo "Membuat systemd service: $SERVICE_FILE..."

sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=ViaProxy - Minecraft Java to Bedrock Crossplay Bridge
After=network.target minecraft-bedrock.service

[Service]
Type=simple
User=$CURRENT_USER
WorkingDirectory=$VIAPROXY_DIR
ExecStart=/usr/bin/java -Xmx512M -Xms128M -jar $VIAPROXY_DIR/viaproxy.jar cli
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable viaproxy
sudo systemctl restart viaproxy || sudo systemctl start viaproxy

echo ""
echo "=========================================================="
echo "  SELAMAT! VIAPROXY TELAH BERHASIL DIPASANG & DIAKTIFKAN! "
echo "=========================================================="
echo "Pemain Minecraft Java PC sekarang bisa bergabung ke server Anda:"
echo "• IP: $(curl -s https://api.ipify.org || echo '129.226.95.58')"
echo "• Port Java: 25565"
echo ""
echo "⚠️ PENTING DI TENCENT CLOUD CONSOLE:"
echo "Buka Firewall / Security Group di website Tencent Cloud,"
echo "lalu tambahkan aturan ALLOW untuk Port TCP 25565 agar pemain Java bisa terhubung!"
