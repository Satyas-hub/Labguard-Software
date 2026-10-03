@echo off
setlocal
cd /d "%~dp0"
title LABGUARD V2 Setup

echo ==========================================================================
echo   LABGUARD V2 -- Enterprise Computer Laboratory Management System
echo   Launching Official Installation...
echo ==========================================================================
echo.

if exist "%~dp0LABGUARD-Setup.exe" (
    start "" "%~dp0LABGUARD-Setup.exe"
    exit /b 0
) else if exist "%~dp0..\LABGUARD-Setup.exe" (
    start "" "%~dp0..\LABGUARD-Setup.exe"
    exit /b 0
) else (
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0build_setup_exe.ps1"
    if exist "%~dp0LABGUARD-Setup.exe" (
        start "" "%~dp0LABGUARD-Setup.exe"
        exit /b 0
    )
)
