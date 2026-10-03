@echo off
setlocal
cd /d "%~dp0"
title LABGUARD V2 Uninstaller

echo ==========================================================================
echo   LABGUARD V2 -- Clean Application Uninstallation
echo ==========================================================================
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall_engine.ps1"

echo.
pause
exit /b %ERRORLEVEL%
