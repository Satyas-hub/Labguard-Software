# ============================================================================
# LABGUARD V2: Complete Installation Engine (PowerShell)
# ============================================================================
$ErrorActionPreference = "Stop"

Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host "  LABGUARD V2 — Enterprise Computer Laboratory Management System" -ForegroundColor Cyan
Write-Host "  Official Windows Installation Routine" -ForegroundColor Cyan
Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host ""

$installDir = "$env:LOCALAPPDATA\Programs\LabGuard"
$assetsDir = "$installDir\Assets"
$programDataDir = "C:\ProgramData\LABGUARD"
$projectRoot = Split-Path -Parent $PSScriptRoot

# 1. Stop any running LabGuard instances
Write-Host "[1/6] Stopping any running LabGuard processes..." -ForegroundColor White
Get-Process | Where-Object { $_.ProcessName -like '*LabGuard*' } | Stop-Process -Force -ErrorAction SilentlyContinue

# 2. Create destination directories
Write-Host "[2/6] Preparing installation directory: $installDir" -ForegroundColor White
New-Item -ItemType Directory -Path $assetsDir -Force | Out-Null

# 3. Copy binaries and assets
Write-Host "[3/6] Deploying application files..." -ForegroundColor White
$sourceExe = "$projectRoot\dist\LABGUARD.exe"
if (-not (Test-Path $sourceExe)) {
    $sourceExe = "$projectRoot\LABGUARD.exe"
}
Copy-Item -Path $sourceExe -Destination "$installDir\LabGuard.exe" -Force
Write-Host "      -> Deployed $installDir\LabGuard.exe" -ForegroundColor Green

$sourceDll = "$projectRoot\dist\WebView2Loader.dll"
if (-not (Test-Path $sourceDll)) {
    $sourceDll = "$projectRoot\WebView2Loader.dll"
}
if (Test-Path $sourceDll) {
    Copy-Item -Path $sourceDll -Destination "$installDir\WebView2Loader.dll" -Force
    Write-Host "      -> Deployed $installDir\WebView2Loader.dll" -ForegroundColor Green
}

$sourceIco = "$projectRoot\assets\logo.ico"
if (Test-Path $sourceIco) {
    Copy-Item -Path $sourceIco -Destination "$assetsDir\logo.ico" -Force
    Write-Host "      -> Deployed $assetsDir\logo.ico" -ForegroundColor Green
}

# 4. Initialize ProgramData vaults and configure System Numbers
Write-Host "[4/6] Initializing enterprise vaults in $programDataDir..." -ForegroundColor White
foreach ($sub in @("database", "config", "evidence", "logs", "sync")) {
    New-Item -ItemType Directory -Path "$programDataDir\$sub" -Force | Out-Null
}
Write-Host "      -> Vaults ready (database, config, evidence, logs, sync)" -ForegroundColor Green

Write-Host ""
Write-Host "--- Workstation Security Environment Configuration ---" -ForegroundColor Cyan
$assignedServer = "http://localhost:5000"

$serverConfigFile = "$programDataDir\config\server_config.json"
if (Test-Path $serverConfigFile) {
    try {
        $existingSrv = Get-Content $serverConfigFile -Raw | ConvertFrom-Json
        if ($existingSrv.server_url) { $assignedServer = $existingSrv.server_url }
    } catch {}
}

$wsConfigFile = "$programDataDir\config\workstation.json"
if (Test-Path $wsConfigFile) {
    Write-Host "      -> Preserved existing workstation configuration across installation" -ForegroundColor Green
} else {
    $nowTicks = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $clientId = "CLIENT-$('{0:X}' -f ($nowTicks -band 0xFFFFFFFFFF))"
    $wsObj = @{
        client_id = $clientId
        lab_code = "UNASSIGNED"
        pc_code = "UNASSIGNED"
        is_registered = $false
        app_version = "3.5.1"
        windows_version = "Microsoft Windows"
    }
    $wsJson = $wsObj | ConvertTo-Json -Depth 4
    Set-Content -Path $wsConfigFile -Value $wsJson -Force
    Write-Host "      -> Initialized fresh workstation identity (Registration handled dynamically via login screen)" -ForegroundColor Green
}

$srvClean = $assignedServer.Replace("http://","").Replace("https://","").Split(":")[0]
$srvObj = @{
    server_url = $assignedServer
    server_ip = $srvClean
    port = 5000
    configured_by = "Official Windows Installation Routine"
}
$srvJson = $srvObj | ConvertTo-Json -Depth 4
Set-Content -Path $serverConfigFile -Value $srvJson -Force

Write-Host "      -> Central Server configured: $assignedServer" -ForegroundColor Green
Write-Host ""

# 5. Create Desktop & Start Menu Shortcuts
Write-Host "[5/6] Creating Desktop and Start Menu shortcuts..." -ForegroundColor White
$wsh = New-Object -ComObject WScript.Shell

# Desktop shortcut
$desktopShortcut = $wsh.CreateShortcut("$env:USERPROFILE\Desktop\LABGUARD.lnk")
$desktopShortcut.TargetPath = "$installDir\LabGuard.exe"
$desktopShortcut.WorkingDirectory = $installDir
$desktopShortcut.IconLocation = "$assetsDir\logo.ico,0"
$desktopShortcut.Description = "LABGUARD V2 — Computer Lab Management System"
$desktopShortcut.Save()
Write-Host "      -> Desktop shortcut: $env:USERPROFILE\Desktop\LABGUARD.lnk" -ForegroundColor Green

# Start menu shortcut
$startMenuDir = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\LABGUARD"
New-Item -ItemType Directory -Path $startMenuDir -Force | Out-Null
$startShortcut = $wsh.CreateShortcut("$startMenuDir\LABGUARD.lnk")
$startShortcut.TargetPath = "$installDir\LabGuard.exe"
$startShortcut.WorkingDirectory = $installDir
$startShortcut.IconLocation = "$assetsDir\logo.ico,0"
$startShortcut.Description = "LABGUARD V2 — Computer Lab Management System"
$startShortcut.Save()
Write-Host "      -> Start Menu shortcut: $startMenuDir\LABGUARD.lnk" -ForegroundColor Green

# Write Uninstaller script inside installation directory
$uninstBatContent = @"
@echo off
title LABGUARD V2 Uninstaller
echo Stopping LabGuard...
taskkill /F /IM LabGuard.exe /T >nul 2>&1
echo Removing shortcuts...
del /F /Q "%USERPROFILE%\Desktop\LABGUARD.lnk" >nul 2>&1
rmdir /S /Q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\LABGUARD" >nul 2>&1
echo Removing registry entries...
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\LabGuard" /f >nul 2>&1
echo Removing application cache...
rmdir /S /Q "%LOCALAPPDATA%\LABGUARD" >nul 2>&1
echo Removing installation folder...
start /b "" cmd /c timeout /t 2 /nobreak ^>nul ^& rmdir /S /Q "$installDir"
echo ========================================================
echo  LABGUARD V2 has been uninstalled successfully.
echo ========================================================
pause
"@
Set-Content -Path "$installDir\Uninstall.bat" -Value $uninstBatContent -Force

# 6. Register in Windows Add/Remove Programs
Write-Host "[6/6] Registering in Windows Add/Remove Programs..." -ForegroundColor White
$regKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\LabGuard"
if (-not (Test-Path $regKey)) {
    New-Item -Path $regKey -Force | Out-Null
}
Set-ItemProperty -Path $regKey -Name "DisplayName" -Value "LABGUARD V2 — Computer Lab Management System" -Force
Set-ItemProperty -Path $regKey -Name "DisplayVersion" -Value "3.5.0" -Force
Set-ItemProperty -Path $regKey -Name "Publisher" -Value "LABGUARD Institutional Technologies" -Force
Set-ItemProperty -Path $regKey -Name "InstallLocation" -Value $installDir -Force
Set-ItemProperty -Path $regKey -Name "DisplayIcon" -Value "$assetsDir\logo.ico,0" -Force
Set-ItemProperty -Path $regKey -Name "UninstallString" -Value "`"$installDir\Uninstall.bat`"" -Force
Set-ItemProperty -Path $regKey -Name "NoModify" -Value 1 -Force
Set-ItemProperty -Path $regKey -Name "NoRepair" -Value 1 -Force
Set-ItemProperty -Path $regKey -Name "EstimatedSize" -Value 25000 -Force
Write-Host "      -> Registered in Windows Settings / Apps" -ForegroundColor Green

Write-Host ""
Write-Host "==========================================================================" -ForegroundColor Green
Write-Host "  [SUCCESS] LABGUARD V2 INSTALLATION COMPLETED!" -ForegroundColor Green
Write-Host "  Installed Path: $installDir\LabGuard.exe" -ForegroundColor White
Write-Host "  Desktop Shortcut: Desktop\LABGUARD.lnk" -ForegroundColor White
Write-Host "==========================================================================" -ForegroundColor Green
Write-Host ""
