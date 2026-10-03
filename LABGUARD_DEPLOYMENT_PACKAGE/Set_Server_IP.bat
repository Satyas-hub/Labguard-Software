@echo off
title LABGUARD V2 - Central Server Configuration Tool
color 0e
echo ===============================================================================
echo   LABGUARD V2 - Workstation Server Connection Setup
echo ===============================================================================
echo.
echo This tool configures which Central Server IP this workstation connects to.
echo Default is: http://localhost:5000
echo.

set /p "SERVER_IP=Enter Central Server IP or Hostname (e.g. 192.168.1.100 or localhost): "
if "%SERVER_IP%"=="" set "SERVER_IP=localhost"

:: Strip http:// if user entered it
set "CLEAN_IP=%SERVER_IP%"
set "CLEAN_IP=%CLEAN_IP:http://=%"
set "CLEAN_IP=%CLEAN_IP:https://=%"
set "CLEAN_IP=%CLEAN_IP:/=%"

set "SERVER_URL=http://%CLEAN_IP%:5000"

echo.
echo Configuring server target: %SERVER_URL%
echo.

:: Ensure config directory exists
if not exist "C:\ProgramData\LABGUARD\config" mkdir "C:\ProgramData\LABGUARD\config"

:: Write server_config.json
echo {"server_url": "%SERVER_URL%", "server_ip": "%CLEAN_IP%", "port": 5000, "updated_at": "%DATE% %TIME%"} > "C:\ProgramData\LABGUARD\config\server_config.json"

:: Also store in Windows Registry so the frontend / native app can pick it up
reg add "HKCU\Software\LABGUARD" /v "ServerUrl" /t REG_SZ /d "%SERVER_URL%" /f >nul 2>&1

echo [Testing Connection to %SERVER_URL%/health...]
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-RestMethod -Uri '%SERVER_URL%/health' -TimeoutSec 4; Write-Host '  [SUCCESS] Server responded: ' $r.status -ForegroundColor Green } catch { Write-Host '  [WARNING] Could not reach server at %SERVER_URL%. Verify that the backend server is running and firewall allows port 5000.' -ForegroundColor Yellow }"

echo.
echo ===============================================================================
echo   Server configuration saved to C:\ProgramData\LABGUARD\config\server_config.json
echo   Workstations will now target %SERVER_URL%
echo ===============================================================================
echo.
pause
exit /b 0
