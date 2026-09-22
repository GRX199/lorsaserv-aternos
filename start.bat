@echo off
title Minecraft Bedrock Discord Status Bot
color 0A

echo ========================================================
echo   MINECRAFT BEDROCK (ATERNOS) DISCORD STATUS BOT
echo ========================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js tidak ditemukan!
    echo Silakan install Node.js versi 18 ke atas dari https://nodejs.org/
    echo.
    pause
    exit /b
)

if not exist node_modules (
    echo [INFO] Mengunduh dependensi (npm install)...
    call npm install
    echo.
)

if not exist .env (
    if exist .env.example (
        echo [PERHATIAN] File .env belum ditemukan.
        echo Menyalin dari .env.example ke .env...
        copy .env.example .env >nul
        echo.
        echo [PENTING] Silakan buka file .env dengan Notepad dan isi DISCORD_TOKEN Anda!
        echo Setelah diisi, jalankan kembali script start.bat ini.
        echo.
        pause
        exit /b
    )
)

echo [INFO] Menjalankan Bot Discord...
echo.
npm start

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Bot berhenti dengan error.
    pause
)
