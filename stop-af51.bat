@echo off
title AF51 ONE — Stop
color 0C

echo.
echo  Sammutetaan AF51 ONE...
echo.

taskkill /F /IM node.exe >nul 2>&1
echo  [OK] Node prosessit sammutettu.

timeout /t 2 /nobreak > nul
echo  [OK] Valmis.
echo.
pause
