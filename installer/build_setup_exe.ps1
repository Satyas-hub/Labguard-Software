$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$distDir = "$projectRoot\dist"

# Ensure output directory exists
New-Item -ItemType Directory -Path $distDir -Force | Out-Null

# 1. Ensure WebView2Loader.dll is present in dist
$builtDll = "$projectRoot\desktop\src-tauri\target\x86_64-pc-windows-gnu\release\WebView2Loader.dll"
if (Test-Path $builtDll) {
    Copy-Item $builtDll "$distDir\WebView2Loader.dll" -Force
}

# 2. Locate Inno Setup Compiler (ISCC.exe)
$isccCandidates = @(
    "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe",
    "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
    "C:\Program Files\Inno Setup 6\ISCC.exe",
    (Get-Command iscc.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue)
) | Where-Object { $_ -and (Test-Path $_) }

$iscc = $isccCandidates | Select-Object -First 1

if (-not $iscc) {
    Write-Host "Inno Setup Compiler not found. Installing via winget..." -ForegroundColor Yellow
    winget install --id JRSoftware.InnoSetup -e --silent --accept-package-agreements --accept-source-agreements
    $iscc = "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe"
}

Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host " Compiling LABGUARD Official Windows Setup Wizard (GUI Installer)" -ForegroundColor Cyan
Write-Host "==========================================================================" -ForegroundColor Cyan

& "$iscc" "$PSScriptRoot\setup_script.iss"

$distSetup = "$distDir\LABGUARD-Setup.exe"
if (Test-Path $distSetup) {
    Copy-Item -Path $distSetup -Destination "$projectRoot\LABGUARD_DEPLOYMENT_PACKAGE\LABGUARD-Setup.exe" -Force
    Write-Host "`n[SUCCESS] Native Graphical Setup Wizard generated:" -ForegroundColor Green
    Write-Host "  -> $projectRoot\LABGUARD_DEPLOYMENT_PACKAGE\LABGUARD-Setup.exe" -ForegroundColor White
    Write-Host "  -> $distDir\LABGUARD-Setup.exe" -ForegroundColor White
} else {
    Write-Error "Installer compilation failed: $distSetup not found."
}

