@echo off
title Konsol VPS ^& Minecraft SASY199
color 0b
chcp 65001 >nul

:MENU
cls
echo ======================================================
echo    🎮 SASY199 • PUSAT KONTROL VPS ^& MINECRAFT
echo ======================================================
echo  [1] Masuk Terminal VPS (SSH Biasa)
echo  [2] Buka Live Konsol Minecraft Bedrock (Screen)
echo  [3] Pantau Log Server Real-Time (tail -f server.log)
echo  [4] Restart Server Minecraft Aman (Countdown 60s)
echo  [5] Cek Status Service ^& Resource VPS
echo  [6] Keluar
echo ======================================================
set /p opt="Pilih menu [1-6]: "

if "%opt%"=="1" (
    cls
    echo Menyambungkan ke VPS...
    ssh vps
    pause
    goto MENU
)
if "%opt%"=="2" (
    cls
    echo ======================================================
    echo  ⚠️ CARA KELUAR:
    echo  Untuk keluar dari konsol game tanpa mematikan server,
    echo  tekan tombol: Ctrl + A lalu tekan tombol D
    echo ======================================================
    timeout /t 2 >nul
    ssh -t vps "screen -r mc-bedrock"
    goto MENU
)
if "%opt%"=="3" (
    cls
    echo Menampilkan log server real-time (Tekan Ctrl+C untuk berhenti)...
    ssh -t vps "tail -f ~/bedrock-server/server.log"
    goto MENU
)
if "%opt%"=="4" (
    cls
    ssh -t vps "cd ~/lorsaserv-aternos && bash scripts/restart_countdown.sh 60"
    pause
    goto MENU
)
if "%opt%"=="5" (
    cls
    ssh -t vps "echo '=== STATUS SERVICE MINECRAFT ===' && sudo systemctl status minecraft-bedrock --no-pager && echo '' && echo '=== STATUS RAM & CPU ===' && free -h && echo '' && uptime"
    pause
    goto MENU
)
if "%opt%"=="6" exit
goto MENU
