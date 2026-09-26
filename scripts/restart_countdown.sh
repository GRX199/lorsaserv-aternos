#!/bin/bash
# ==============================================================================
#  Minecraft Safe Countdown Restarter (Bedrock Dedicated Server & PaperMC)
#  Memberikan notifikasi hitung mundur ke dalam game sebelum server di-restart
# ==============================================================================

COUNTDOWN=${1:-60}
SCREEN_NAME=""
SERVICE_NAME=""

# 1. Deteksi sesi server aktif
if screen -ls | grep -q "mc-bedrock"; then
    SCREEN_NAME="mc-bedrock"
    SERVICE_NAME="minecraft-bedrock"
elif screen -ls | grep -q "mc-paper"; then
    SCREEN_NAME="mc-paper"
    SERVICE_NAME="minecraft-paper"
elif systemctl is-active --quiet minecraft-bedrock; then
    SCREEN_NAME="mc-bedrock"
    SERVICE_NAME="minecraft-bedrock"
elif systemctl is-active --quiet minecraft-paper; then
    SCREEN_NAME="mc-paper"
    SERVICE_NAME="minecraft-paper"
else
    echo "⚠️ Server Minecraft tidak sedang berjalan. Me-restart service langsung..."
    sudo systemctl restart minecraft-bedrock 2>/dev/null || sudo systemctl restart minecraft-paper
    exit 0
fi

# Fungsi kirim perintah ke konsol screen Minecraft
send_cmd() {
    local cmd="$1"
    if [ -n "$SCREEN_NAME" ] && screen -ls | grep -q "$SCREEN_NAME"; then
        screen -S "$SCREEN_NAME" -X stuff "${cmd}\n"
    fi
}

# Trap Ctrl+C (Batalkan restart jika ditekan)
cancel_restart() {
    echo ""
    echo -e "\n\033[1;31m❌ Hitung mundur restart DIBATALKAN oleh pengguna!\033[0m"
    send_cmd 'title @a times 5 40 10'
    send_cmd 'title @a title §a§lRESTART DIBATALKAN'
    send_cmd 'title @a subtitle §eServer tetap berjalan normal.'
    send_cmd 'tellraw @a {"rawtext":[{"text":"§a§l[INFO] §eHitung mundur restart dibatalkan dari konsol VPS. Selamat bermain kembali!"}]}'
    send_cmd 'playsound random.toast @a'
    exit 0
}

trap cancel_restart SIGINT SIGTERM

echo "=========================================================="
echo "  ⏱️  MINECRAFT RESTART COUNTDOWN: ${COUNTDOWN} DETIK"
echo "=========================================================="
echo "Target Service : $SERVICE_NAME ($SCREEN_NAME)"
echo "Tekan [Ctrl + C] kapan saja untuk MEMBATALKAN restart."
echo "=========================================================="
echo ""

# Loop Countdown
SEC=$COUNTDOWN
while [ $SEC -gt 0 ]; do
    # Broadcast in-game events
    if [ $SEC -eq $COUNTDOWN ] || [ $SEC -eq 60 ] || [ $SEC -eq 120 ] || [ $SEC -eq 180 ]; then
        MINS=$(( (SEC + 59) / 60 ))
        send_cmd 'title @a times 10 70 20'
        send_cmd 'title @a title §c§lRESTART SERVER'
        send_cmd "title @a subtitle §eDalam $MINS menit! (Cari tempat aman)"
        send_cmd "tellraw @a {\"rawtext\":[{\"text\":\"§c§l[PERINGATAN] §eServer akan di-restart dalam §c$MINS menit§e! Mohon simpan barang dan cari tempat aman.\"}]}"
        send_cmd 'playsound random.levelup @a'
    elif [ $SEC -eq 45 ]; then
        send_cmd 'tellraw @a {"rawtext":[{"text":"§6§l[RESTART] §eTersisa §c45 detik§e sebelum server di-restart!"}]}'
        send_cmd 'playsound note.bell @a'
    elif [ $SEC -eq 30 ]; then
        send_cmd 'title @a times 5 40 10'
        send_cmd 'title @a actionbar §c§l⚠️ RESTART DALAM 30 DETIK!'
        send_cmd 'tellraw @a {"rawtext":[{"text":"§c§l[PERINGATAN] §eServer akan di-restart dalam §c30 detik§e! Mohon bersiap log out."}]}'
        send_cmd 'playsound block.bell.hit @a'
    elif [ $SEC -eq 15 ]; then
        send_cmd 'title @a actionbar §c§l⚠️ RESTART DALAM 15 DETIK!'
        send_cmd 'tellraw @a {"rawtext":[{"text":"§c§l[PERINGATAN] §eServer akan di-restart dalam §c15 detik§e!"}]}'
        send_cmd 'playsound note.bell @a'
    elif [ $SEC -eq 10 ]; then
        send_cmd 'title @a times 5 25 5'
        send_cmd 'title @a title §c§l10 DETIK'
        send_cmd 'title @a subtitle §eBersiap log out...'
        send_cmd 'playsound random.orb @a'
    elif [ $SEC -le 5 ] && [ $SEC -ge 1 ]; then
        send_cmd 'title @a times 0 25 5'
        send_cmd "title @a title §c§l$SEC"
        send_cmd 'title @a subtitle §eRestarting...'
        send_cmd 'playsound random.click @a'
    fi

    # Progress bar di Terminal VPS
    PERCENT=$(( (COUNTDOWN - SEC) * 100 / COUNTDOWN ))
    FILLED=$(( PERCENT / 5 ))
    EMPTY=$(( 20 - FILLED ))
    BAR="$(printf '%*s' "$FILLED" | tr ' ' '█')$(printf '%*s' "$EMPTY" | tr ' ' '░')"

    printf "\r\033[K⏳ [%s] %2d detik tersisa... (Ctrl+C untuk batalkan)" "$BAR" "$SEC"
    sleep 1
    SEC=$((SEC - 1))
done

printf "\r\033[K🚀 [████████████████████] WAKTU HABIS! Me-restart server...\n\n"

# Simpan data dunia sebelum restart
echo "💾 Menyimpan data dunia (save hold)..."
send_cmd 'title @a title §4§lRESTARTING NOW'
send_cmd 'title @a subtitle §eMenyimpan data dunia...'
send_cmd 'tellraw @a {"rawtext":[{"text":"§a§l[SERVER] §eMenyimpan data dunia dan me-restart server. Silakan bergabung kembali sesaat lagi!"}]}'
send_cmd 'save hold'
sleep 2

# Eksekusi Restart Systemd
echo "🔄 Menjalankan: sudo systemctl restart $SERVICE_NAME..."
sudo systemctl restart "$SERVICE_NAME"

echo ""
echo "=========================================================="
echo "  ✅ RESTART SELESAI! SERVER SEDANG BOOTING KEMBALI"
echo "=========================================================="
