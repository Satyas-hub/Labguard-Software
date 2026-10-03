@echo off
title LABGUARD V2 - Automated Installation Engine
color 0b
echo ===============================================================================
echo   LABGUARD V2 - Enterprise Computer Laboratory Access Management System
echo   Official Deployment ^& Installation Script
echo   Version: 3.5.1 Enterprise EDR Endpoint Security Release
echo ===============================================================================
echo.

:: 1. Check & Terminate running processes
echo [1/6] Checking for running LABGUARD instances...
taskkill /F /IM LABGUARD.exe /T >nul 2>&1
taskkill /F /IM LabGuard.exe /T >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq LABGUARD Backend Server*" >nul 2>&1
echo       -> Clean process state verified.

:: 2. Target Installation Directory
set "INSTALL_DIR=%LOCALAPPDATA%\Programs\LabGuard"
set "ASSETS_DIR=%INSTALL_DIR%\Assets"
set "PROGRAM_DATA=C:\ProgramData\LABGUARD"

echo [2/6] Preparing destination directories:
echo       App Directory: %INSTALL_DIR%
echo       Data Vaults:   %PROGRAM_DATA%

if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
if not exist "%ASSETS_DIR%" mkdir "%ASSETS_DIR%"

:: 3. Create Enterprise ProgramData Vaults
echo [3/6] Initializing enterprise vaults in %PROGRAM_DATA%...
if not exist "%PROGRAM_DATA%" mkdir "%PROGRAM_DATA%"
if not exist "%PROGRAM_DATA%\database" mkdir "%PROGRAM_DATA%\database"
if not exist "%PROGRAM_DATA%\config" mkdir "%PROGRAM_DATA%\config"
if not exist "%PROGRAM_DATA%\evidence" mkdir "%PROGRAM_DATA%\evidence"
if not exist "%PROGRAM_DATA%\logs" mkdir "%PROGRAM_DATA%\logs"
if not exist "%PROGRAM_DATA%\sync" mkdir "%PROGRAM_DATA%\sync"

:: Grant full permissions so student accounts do not crash on database access
icacls "%PROGRAM_DATA%" /grant Everyone:(OI)(CI)F /T /Q /C >nul 2>&1
icacls "%PROGRAM_DATA%" /grant Users:(OI)(CI)F /T /Q /C >nul 2>&1
echo       -> Enterprise vaults initialized (database, config, evidence, logs, sync).

:: 4. Deploy binaries and libraries
echo [4/6] Copying application files...
if exist "%~dp0LABGUARD.exe" (
    copy /Y "%~dp0LABGUARD.exe" "%INSTALL_DIR%\LabGuard.exe" >nul
    copy /Y "%~dp0LABGUARD.exe" "%INSTALL_DIR%\LABGUARD.exe" >nul
    echo       -> Deployed LabGuard.exe
) else (
    echo [ERROR] LABGUARD.exe not found in installer folder!
    pause
    exit /b 1
)

if exist "%~dp0WebView2Loader.dll" (
    copy /Y "%~dp0WebView2Loader.dll" "%INSTALL_DIR%\WebView2Loader.dll" >nul
    echo       -> Deployed WebView2Loader.dll
)

if exist "%~dp0logo.ico" (
    copy /Y "%~dp0logo.ico" "%ASSETS_DIR%\logo.ico" >nul
    echo       -> Deployed logo.ico
)

if exist "%~dp0server" (
    echo       Deploying central backend server engine...
    if not exist "%INSTALL_DIR%\server" mkdir "%INSTALL_DIR%\server"
    copy /Y "%~dp0server\*" "%INSTALL_DIR%\server\" >nul
    if not exist "%PROGRAM_DATA%\server" mkdir "%PROGRAM_DATA%\server"
    copy /Y "%~dp0server\*" "%PROGRAM_DATA%\server\" >nul
    echo       -> Deployed server engine runtime (node.exe, server.bundle.cjs)
)

if exist "%~dp0Start_LABGUARD.bat" (
    copy /Y "%~dp0Start_LABGUARD.bat" "%INSTALL_DIR%\Start_LABGUARD.bat" >nul
    echo       -> Deployed Start_LABGUARD.bat (Auto-Start Engine)
)

:: 5. Create Desktop and Start Menu Shortcuts
echo [5/6] Creating Desktop and Start Menu shortcuts...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut([System.IO.Path]::Combine([System.Environment]::GetFolderPath('Desktop'), 'LABGUARD.lnk')); if (Test-Path '%INSTALL_DIR%\Start_LABGUARD.bat') { $s.TargetPath = '%INSTALL_DIR%\Start_LABGUARD.bat'; $s.WindowStyle = 7 } else { $s.TargetPath = '%INSTALL_DIR%\LabGuard.exe' }; $s.WorkingDirectory = '%INSTALL_DIR%'; if (Test-Path '%ASSETS_DIR%\logo.ico') { $s.IconLocation = '%ASSETS_DIR%\logo.ico,0' }; $s.Description = 'LABGUARD V2 Institutional Laboratory Management System'; $s.Save()"

set "START_MENU=%APPDATA%\Microsoft\Windows\Start Menu\Programs\LABGUARD"
if not exist "%START_MENU%" mkdir "%START_MENU%"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%START_MENU%\LABGUARD.lnk'); if (Test-Path '%INSTALL_DIR%\Start_LABGUARD.bat') { $s.TargetPath = '%INSTALL_DIR%\Start_LABGUARD.bat'; $s.WindowStyle = 7 } else { $s.TargetPath = '%INSTALL_DIR%\LabGuard.exe' }; $s.WorkingDirectory = '%INSTALL_DIR%'; if (Test-Path '%ASSETS_DIR%\logo.ico') { $s.IconLocation = '%ASSETS_DIR%\logo.ico,0' }; $s.Description = 'LABGUARD V2 Institutional Laboratory Management System'; $s.Save()"
echo       -> Shortcuts created successfully.

:: 6. Windows Registry Registration
echo [6/6] Registering in Windows Add/Remove Programs...
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\LabGuard" /v "DisplayName" /t REG_SZ /d "LABGUARD V2 — Computer Lab Management System" /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\LabGuard" /v "DisplayVersion" /t REG_SZ /d "3.5.0" /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\LabGuard" /v "Publisher" /t REG_SZ /d "LABGUARD Institutional Technologies" /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\LabGuard" /v "InstallLocation" /t REG_SZ /d "%INSTALL_DIR%" /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\LabGuard" /v "DisplayIcon" /t REG_SZ /d "%ASSETS_DIR%\logo.ico,0" /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\LabGuard" /v "UninstallString" /t REG_SZ /d "\"%INSTALL_DIR%\Uninstall.bat\"" /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\LabGuard" /v "NoModify" /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\LabGuard" /v "NoRepair" /t REG_DWORD /d 1 /f >nul 2>&1

:: Create internal uninstaller in app folder
(
  echo @echo off
  echo title LABGUARD V2 - Uninstaller
  echo color 0c
  echo echo ===============================================================================
  echo echo   LABGUARD V2 - Workstation Application Uninstaller
  echo echo ===============================================================================
  echo echo Stopping running LABGUARD processes...
  echo taskkill /F /IM LABGUARD.exe /T ^>nul 2^>^&1
  echo taskkill /F /IM LabGuard.exe /T ^>nul 2^>^&1
  echo echo Removing Desktop and Start Menu shortcuts...
  echo del /F /Q "%%USERPROFILE%%\Desktop\LABGUARD.lnk" ^>nul 2^>^&1
  echo del /F /Q "%%PUBLIC%%\Desktop\LABGUARD.lnk" ^>nul 2^>^&1
  echo rmdir /S /Q "%%APPDATA%%\Microsoft\Windows\Start Menu\Programs\LABGUARD" ^>nul 2^>^&1
  echo echo Removing Windows registry entries...
  echo reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\LabGuard" /f ^>nul 2^>^&1
  echo echo Removing application cache...
  echo rmdir /S /Q "%%LOCALAPPDATA%%\LABGUARD" ^>nul 2^>^&1
  echo rmdir /S /Q "%%LOCALAPPDATA%%\edu.labguard.system" ^>nul 2^>^&1
  echo echo Removing program files...
  echo start /b "" cmd /c timeout /t 2 /nobreak ^^>nul ^^^& rmdir /S /Q "%INSTALL_DIR%"
  echo echo [SUCCESS] LABGUARD V2 has been uninstalled.
  echo pause
  echo exit /b 0
) > "%INSTALL_DIR%\Uninstall.bat"

echo.
echo ===============================================================================
echo   [SUCCESS] LABGUARD V2 HAS BEEN INSTALLED SUCCESSFULLY!
echo   Installation Path: %INSTALL_DIR%\LabGuard.exe
echo   Desktop Shortcut:  LABGUARD.lnk
echo ===============================================================================
echo.

set /p "LAUNCH=Would you like to launch LABGUARD now? (Y/n): "
if /i "%LAUNCH%"=="n" goto :DONE

echo Starting LABGUARD V2...
start "" "%INSTALL_DIR%\LabGuard.exe"

:DONE
echo Done. Press any key to exit installer.
pause >nul
exit /b 0
