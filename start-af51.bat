@echo off
title AF51 ONE — Launcher
color 0A

echo.
echo  =====================================
echo   AF51 ONE ^| Segerman Area51 Factory
echo  =====================================
echo.

:: Tarkista sijainti
if not exist "%~dp0server.js" (
    echo [VIRHE] Tama scripti pitaa ajaa af51_one-kansiosta.
    echo         Sijainti: %~dp0
    pause
    exit /b 1
)

:: Aseta tyokansio
cd /d "%~dp0"

:: Tarkista .env
if not exist ".env" (
    echo [INFO] .env puuttuu — luodaan...
    echo OLLAMA_ENDPOINT=http://127.0.0.1:11434 > .env
    echo OLLAMA_MODEL=llama3.2:latest >> .env
    echo [OK] .env luotu.
)

:: Tarkista GUARDIAN_HMAC_SECRET
findstr /C:"GUARDIAN_HMAC_SECRET" .env >nul 2>&1
if errorlevel 1 (
    echo [INFO] GUARDIAN_HMAC_SECRET puuttuu — lisataan automaattisesti...
    node -e "var c=require('crypto');var f=require('fs');var s=c.randomBytes(32).toString('hex');f.appendFileSync('.env','GUARDIAN_HMAC_SECRET='+s+'\n');" 2>nul
    echo [OK] Secret lisatty .env:aan.
)

echo.
echo Kaynnistetaan palvelut...
echo.

:: 1. Ollama
echo [1/3] Ollama...
start "AF51 — Ollama" cmd /k "ollama serve && pause"
timeout /t 3 /nobreak > nul

:: 2. AF51 Server
echo [2/3] AF51 Server...
start "AF51 — Server" cmd /k "cd /d "%~dp0" && node server.js"
timeout /t 4 /nobreak > nul

:: 3. Expo Web
echo [3/3] Expo Web...
start "AF51 — Expo" cmd /k "cd /d "%~dp0" && npx expo start --web --clear"

echo.
echo  =====================================
echo   Kaikki kaynnissa!
echo.
echo   ALX Factory  ^> http://localhost:3000
echo   Expo UI      ^> http://localhost:8081
echo   Ollama       ^> http://localhost:11434
echo  =====================================
echo.
echo  Sulje kaikki: sulje avautuneet ikkunat.
echo.
pause
