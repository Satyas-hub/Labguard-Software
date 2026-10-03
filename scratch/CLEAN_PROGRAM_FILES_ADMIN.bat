@echo off
:: Self-elevating Administrator Cleanup Script for LABGUARD
net session >nul 2>&1
if %errorLevel% NEQ 0 (
    echo Requesting Administrator privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo ========================================================
echo   LABGUARD Complete Administrator Cleanup
echo ========================================================

echo [1/4] Terminating any remaining processes...
taskkill /F /IM node.exe /FI "MODULES eq *LABGUARD*" >nul 2>&1
taskkill /F /IM LABGUARD.exe >nul 2>&1

echo [2/4] Removing Program Files...
if exist "C:\Program Files\LABGUARD" (
    rmdir /S /Q "C:\Program Files\LABGUARD"
    echo   -> Deleted C:\Program Files\LABGUARD
)

echo [3/4] Removing Public Desktop and Start Menu Shortcuts...
if exist "C:\Users\Public\Desktop\LABGUARD.lnk" (
    del /F /Q "C:\Users\Public\Desktop\LABGUARD.lnk" >nul 2>&1
    echo   -> Deleted Public Desktop shortcut
)
if exist "C:\ProgramData\Microsoft\Windows\Start Menu\Programs\LABGUARD" (
    rmdir /S /Q "C:\ProgramData\Microsoft\Windows\Start Menu\Programs\LABGUARD" >nul 2>&1
    echo   -> Deleted Start Menu folder
)

echo [4/4] Removing System Registry Keys...
reg delete "HKLM\Software\Microsoft\Windows\CurrentVersion\Run" /v "LABGUARD" /f >nul 2>&1
reg delete "HKLM\Software\Microsoft\Windows\CurrentVersion\Uninstall\{8F3A29B0-1A4C-4F92-B7E3-5D9E2A8C1100}_is1" /f >nul 2>&1
reg delete "HKLM\Software\LABGUARD" /f >nul 2>&1

echo.
echo ========================================================
echo   [SUCCESS] LABGUARD HAS BEEN 100%% PURGED FROM THE SYSTEM!
echo ========================================================
timeout /t 5
