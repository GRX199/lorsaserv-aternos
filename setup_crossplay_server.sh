#!/bin/bash
set -e

echo "=========================================================="
echo "    MEMASANG PAPERMC + GEYSER + FLOODGATE (CROSSPLAY)     "
echo "=========================================================="

CURRENT_USER=$(id -un)
CURRENT_HOME=$(eval echo "~$CURRENT_USER")
PAPER_DIR="$CURRENT_HOME/papermc-server"
PLUGINS_DIR="$PAPER_DIR/plugins"

# 1. Install Java 21 JRE & dependensi
echo "[1/6] Memeriksa & memasang OpenJDK 21 JRE..."
if ! command -v java &> /dev/null; then
  sudo apt-get update -y
  sudo apt-get install -y openjdk-21-jre-headless jq curl wget screen
else
  echo "Java sudah terpasang: $(java -version 2>&1 | head -n 1)"
fi

# 2. Siapkan direktori ~/papermc-server
echo "[2/6] Menyiapkan direktori $PAPER_DIR..."
mkdir -p "$PLUGINS_DIR"
cd "$PAPER_DIR"

# 3. Unduh PaperMC 1.21.4
echo "[3/6] Mengunduh PaperMC 1.21.4 (Engine Server)..."
PAPER_URL="https://fill-data.papermc.io/v1/objects/5ee4f542f628a14c644410b08c94ea42e772ef4d29fe92973636b6813d4eaffc/paper-1.21.4-232.jar"
if [ ! -f "paper.jar" ]; then
  wget -q --show-progress "$PAPER_URL" -O paper.jar || curl -L "$PAPER_URL" -o paper.jar
fi

# 4. Unduh Plugin Crossplay (Geyser, Floodgate, ViaVersion)
echo "[4/6] Mengunduh Plugin Geyser, Floodgate, & ViaVersion..."
cd "$PLUGINS_DIR"

echo "Mengunduh Geyser-Spigot (Jembatan Pemain Bedrock)..."
curl -sL "https://download.geysermc.org/v2/projects/geyser/versions/latest/builds/latest/downloads/spigot" -o Geyser-Spigot.jar

echo "Mengunduh Floodgate-Spigot (Login Bedrock tanpa akun Java)..."
curl -sL "https://download.geysermc.org/v2/projects/floodgate/versions/latest/builds/latest/downloads/spigot" -o Floodgate-Spigot.jar

echo "Mengunduh ViaVersion (Dukungan versi client Java terbaru & update)..."
curl -sL "https://github.com/ViaVersion/ViaVersion/releases/download/5.12.0/ViaVersion-5.12.0.jar" -o ViaVersion.jar

echo "Mengunduh ViaBackwards (Dukungan versi client Java lama 1.9 hingga 1.21.3)..."
curl -sL "https://github.com/ViaVersion/ViaBackwards/releases/download/5.12.0/ViaBackwards-5.12.0.jar" -o ViaBackwards.jar

cd "$PAPER_DIR"

# 5. Konfigurasi eula.txt, server.properties & Geyser config
echo "[5/6] Mengonfigurasi server.properties & Geyser..."
echo "eula=true" > eula.txt

cat <<EOF > server.properties
server-port=25565
online-mode=false
white-list=false
motd=\u00a7bSASY199 \u00a7e\u2022 \u00a7aCrossplay Java & Bedrock (24/7)
max-players=10
view-distance=8
simulation-distance=4
network-compression-threshold=256
spawn-protection=0
EOF

# Konfigurasi Geyser-Spigot agar listen di port 19132 Bedrock
mkdir -p "$PLUGINS_DIR/Geyser-Spigot"
cat <<EOF > "$PLUGINS_DIR/Geyser-Spigot/config.yml"
bedrock:
  address: 0.0.0.0
  port: 19132
  clone-remote-port: false
  motd1: "SASY199 Crossplay"
  motd2: "Java & Bedrock (24/7)"
remote:
  address: 127.0.0.1
  port: 25565
  auth-type: floodgate
EOF

# 6. Pasang systemd service minecraft-paper
echo "[6/6] Menyiapkan service systemd (minecraft-paper.service)..."
SERVICE_FILE="/etc/systemd/system/minecraft-paper.service"

sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=Minecraft PaperMC Crossplay Server (Java & Bedrock)
After=network.target

[Service]
Type=simple
User=$CURRENT_USER
WorkingDirectory=$PAPER_DIR
ExecStart=/usr/bin/screen -DmS mc-paper /usr/bin/java -Xmx1400M -Xms512M -XX:+UseG1GC -jar $PAPER_DIR/paper.jar --nogui
Restart=on-failure
RestartSec=5s
KillSignal=SIGINT
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
EOF

# Berikan izin sudoers tanpa password untuk minecraft-paper & switcher
SUDOERS_FILE="/etc/sudoers.d/minecraft-paper"
sudo tee "$SUDOERS_FILE" > /dev/null <<EOF
$CURRENT_USER ALL=(ALL) NOPASSWD: /bin/systemctl start minecraft-paper, /bin/systemctl stop minecraft-paper, /bin/systemctl restart minecraft-paper, /bin/systemctl is-active minecraft-paper, /bin/systemctl status minecraft-paper, /bin/systemctl enable minecraft-paper, /bin/systemctl disable minecraft-paper, /bin/systemctl enable minecraft-bedrock, /bin/systemctl disable minecraft-bedrock, /bin/systemctl start minecraft-bedrock, /bin/systemctl stop minecraft-bedrock, /bin/systemctl restart minecraft-bedrock, /bin/systemctl is-active minecraft-bedrock, /bin/systemctl status minecraft-bedrock
EOF
sudo chmod 440 "$SUDOERS_FILE"

# Berikan izin membaca journalctl tanpa sudo
sudo usermod -aG systemd-journal "$CURRENT_USER" 2>/dev/null || true

# Berikan izin eksekusi script switch
chmod +x "$CURRENT_HOME/lorsaserv-aternos/switch_to_bedrock.sh" 2>/dev/null || true
chmod +x "$CURRENT_HOME/lorsaserv-aternos/switch_to_crossplay.sh" 2>/dev/null || true

sudo systemctl daemon-reload
sudo systemctl enable minecraft-paper

# Hentikan Bedrock dan Viaproxy, lalu jalankan PaperMC Crossplay
echo "Menonaktifkan sementara service Bedrock & Viaproxy..."
sudo systemctl stop minecraft-bedrock 2>/dev/null || true
sudo systemctl disable minecraft-bedrock 2>/dev/null || true
sudo systemctl stop viaproxy 2>/dev/null || true
sudo systemctl disable viaproxy 2>/dev/null || true

echo "Menyalakan PaperMC Crossplay Server..."
sudo systemctl restart minecraft-paper

echo ""
echo "=========================================================="
echo "  SELAMAT! SERVER CROSSPLAY RESMI AKTIF!                  "
echo "=========================================================="
echo "• Pemain Java (PC / TLauncher): 129.226.95.58:25565"
echo "• Pemain Bedrock (HP / Win10):  129.226.95.58:19132"
echo ""
echo "Dunia & file Bedrock Anda yang lama TETAP AMAN di folder ~/bedrock-server/."
echo "Untuk kembali ke server Bedrock kapan saja, cukup jalankan:"
echo "  bash switch_to_bedrock.sh"
echo "Dan untuk kembali ke PaperMC Crossplay:"
echo "  bash switch_to_crossplay.sh"
