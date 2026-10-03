@echo off
title LABGUARD V2 Launcher - Auto-Start Engine
color 0b

:: ===============================================================================
:: LABGUARD V2 - Intelligent Auto-Start Launcher
:: Ensures Central Backend Server is active on port 5000 before opening GUI
:: ===============================================================================

echo [1/2] Checking Central Backend Server status on port 5000...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$c = Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue; if ($c) { exit 0 } else { exit 1 }"
if %ERRORLEVEL% EQU 0 goto :SERVER_ALREADY_ACTIVE

echo [LABGUARD Launcher] Backend server is not running. Launching background server...

set "SERVER_DIR="

if exist "%~dp0server\node.exe" (
    set "SERVER_DIR=%~dp0server"
) else if exist "%LOCALAPPDATA%\Programs\LabGuard\server\node.exe" (
    set "SERVER_DIR=%LOCALAPPDATA%\Programs\LabGuard\server"
) else if exist "C:\ProgramData\LABGUARD\server\node.exe" (
    set "SERVER_DIR=C:\ProgramData\LABGUARD\server"
)

if defined SERVER_DIR (
    echo       Starting embedded backend server from %SERVER_DIR%...
    pushd "%SERVER_DIR%"
    start "LABGUARD Backend Server" /min node.exe server.bundle.cjs
    popd
    
    :: Wait up to 6 seconds for port 5000 to be open
    for /L %%i in (1,1,12) do (
        powershell -NoProfile -ExecutionPolicy Bypass -Command "$c = Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue; if ($c) { exit 0 } else { exit 1 }" && goto :SERVER_READY
        timeout /t 1 /nobreak >nul 2>&1
    )
)

echo [WARNING] Embedded server bundle not found or node runtime missing. Workstation will connect to configured LAN server IP.
goto :LAUNCH_GUI

:SERVER_ALREADY_ACTIVE
echo [LABGUARD Launcher] Central Backend Server is already active on port 5000.
goto :LAUNCH_GUI

:SERVER_READY
echo       -> Backend server verified on port 5000.

:LAUNCH_GUI
echo [2/2] Launching LABGUARD Workstation Interface...
if exist "%~dp0LABGUARD.exe" (
    start "" "%~dp0LABGUARD.exe"
) else if exist "%~dp0LabGuard.exe" (
    start "" "%~dp0LabGuard.exe"
) else if exist "%LOCALAPPDATA%\Programs\LabGuard\LABGUARD.exe" (
    start "" "%LOCALAPPDATA%\Programs\LabGuard\LABGUARD.exe"
) else if exist "%LOCALAPPDATA%\Programs\LabGuard\LabGuard.exe" (
    start "" "%LOCALAPPDATA%\Programs\LabGuard\LabGuard.exe"
) else (
    echo [ERROR] LABGUARD application executable not found!
    pause
)
exit /b 0
