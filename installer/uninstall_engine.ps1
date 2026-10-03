# ============================================================================
# LABGUARD V2: Complete Uninstaller Engine (PowerShell)
# ============================================================================
$ErrorActionPreference = "SilentlyContinue"

Write-Host "==========================================================================" -ForegroundColor Yellow
Write-Host "  LABGUARD V2 — Clean Uninstallation" -ForegroundColor Yellow
Write-Host "==========================================================================" -ForegroundColor Yellow
Write-Host ""

# 1. Stop processes
Write-Host "Stopping any running LabGuard processes..." -ForegroundColor White
Get-Process | Where-Object { $_.ProcessName -like '*LabGuard*' } | Stop-Process -Force

# 2. Remove Installation Folder
$installDir = "$env:LOCALAPPDATA\Programs\LabGuard"
if (Test-Path $installDir) {
    Remove-Item -Path $installDir -Recurse -Force
    Write-Host "Removed application files: $installDir" -ForegroundColor Green
}

# 3. Remove Desktop Shortcut
$desktopLnk = "$env:USERPROFILE\Desktop\LABGUARD.lnk"
if (Test-Path $desktopLnk) {
    Remove-Item -Path $desktopLnk -Force
    Write-Host "Removed Desktop shortcut: $desktopLnk" -ForegroundColor Green
}

# 4. Remove Start Menu
$startMenu = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\LABGUARD"
if (Test-Path $startMenu) {
    Remove-Item -Path $startMenu -Recurse -Force
    Write-Host "Removed Start Menu shortcuts: $startMenu" -ForegroundColor Green
}

# 5. Remove AppData Local Cache
$appDataLocal = "$env:LOCALAPPDATA\LABGUARD"
if (Test-Path $appDataLocal) {
    Remove-Item -Path $appDataLocal -Recurse -Force
    Write-Host "Removed application cache: $appDataLocal" -ForegroundColor Green
}

# 6. Remove ProgramData (Optional prompt or cleanup)
$programData = "C:\ProgramData\LABGUARD"
if (Test-Path $programData) {
    Remove-Item -Path $programData -Recurse -Force
    Write-Host "Removed ProgramData folder: $programData" -ForegroundColor Green
}

# 7. Remove Registry Entry
$regKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\LabGuard"
if (Test-Path $regKey) {
    Remove-Item -Path $regKey -Recurse -Force
    Write-Host "Removed Windows Registry uninstall key" -ForegroundColor Green
}

Write-Host ""
Write-Host "==========================================================================" -ForegroundColor Green
Write-Host "  [SUCCESS] LABGUARD V2 HAS BEEN COMPLETELY UNINSTALLED" -ForegroundColor Green
Write-Host "==========================================================================" -ForegroundColor Green
Write-Host ""
