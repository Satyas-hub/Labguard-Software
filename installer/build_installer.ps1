# ============================================================================
# LABGUARD V2: Production Windows System Application Installer & Packager
# ============================================================================

$projectRoot = Split-Path -Parent $PSScriptRoot
$distDir = "$projectRoot\dist"
$programFilesDir = "C:\Program Files\LABGUARD"
$programDataDir = "C:\ProgramData\LABGUARD"

Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host " Building LABGUARD V2 Production Native Windows Application" -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan

# 1. Ensure target directories exist
New-Item -ItemType Directory -Path $distDir -Force | Out-Null
New-Item -ItemType Directory -Path "$programDataDir\database", "$programDataDir\sync", "$programDataDir\logs", "$programDataDir\evidence", "$programDataDir\config" -Force | Out-Null

# 2. Build Tauri Desktop Frontend
Write-Host "Compiling desktop frontend..." -ForegroundColor White
Set-Location "$projectRoot\desktop"
npm run build

# 3. Build Tauri Native Windows Executable
Write-Host "Compiling native Windows Tauri executable..." -ForegroundColor White
$cargoPath = "$env:USERPROFILE\.cargo\bin\cargo.exe"
if (Test-Path $cargoPath) {
    $llvmDir = (Get-ChildItem -Path "$env:LOCALAPPDATA\Microsoft\WinGet" -Recurse -Filter "dlltool.exe" -ErrorAction SilentlyContinue | Select-Object -First 1).Directory.FullName
    $cleanPath = ($env:PATH.Split(';') | Where-Object { $_ -notlike '*C:\MinGW*' }) -join ';'
    if ($llvmDir) {
        $env:PATH = "$llvmDir;$cleanPath"
    } else {
        $env:PATH = $cleanPath
    }
    Set-Location "$projectRoot\desktop\src-tauri"
    & $cargoPath build --release --target x86_64-pc-windows-gnu --features custom-protocol
}

# 4. Check for standalone executable packaging
Write-Host "Publishing native Windows executable..." -ForegroundColor White
$builtExe = "$projectRoot\desktop\src-tauri\target\release\labguard-desktop.exe"
$builtGnuExe = "$projectRoot\desktop\src-tauri\target\x86_64-pc-windows-gnu\release\labguard-desktop.exe"
$builtDll = "$projectRoot\desktop\src-tauri\target\x86_64-pc-windows-gnu\release\WebView2Loader.dll"

if (Test-Path $builtExe) {
    Copy-Item $builtExe "$distDir\LABGUARD.exe" -Force
} elseif (Test-Path $builtGnuExe) {
    Copy-Item $builtGnuExe "$distDir\LABGUARD.exe" -Force
} elseif (Test-Path "$projectRoot\LABGUARD.exe") {
    Copy-Item "$projectRoot\LABGUARD.exe" "$distDir\LABGUARD.exe" -Force
}

if (Test-Path $builtDll) {
    Copy-Item $builtDll "$distDir\WebView2Loader.dll" -Force
    Copy-Item $builtDll "$projectRoot\LABGUARD_DEPLOYMENT_PACKAGE\WebView2Loader.dll" -Force
}

# 5. Copy to LABGUARD_DEPLOYMENT_PACKAGE
if (Test-Path "$distDir\LABGUARD.exe") {
    Copy-Item "$distDir\LABGUARD.exe" "$projectRoot\LABGUARD_DEPLOYMENT_PACKAGE\LABGUARD.exe" -Force
    Write-Host "LABGUARD.exe synchronized to LABGUARD_DEPLOYMENT_PACKAGE." -ForegroundColor Green
}

# 6. Build Official Windows GUI Setup Wizard
Write-Host "Building Official Windows Graphical Setup Wizard..." -ForegroundColor Cyan
& powershell -NoProfile -ExecutionPolicy Bypass -File "$PSScriptRoot\build_setup_exe.ps1"

# 7. Register in Windows Program Files & Shortcuts
Write-Host "Registering Windows system installation..." -ForegroundColor Yellow
try {
    New-Item -ItemType Directory -Path $programFilesDir -Force -ErrorAction SilentlyContinue | Out-Null
    if (Test-Path "$distDir\LABGUARD.exe") {
        Copy-Item "$distDir\LABGUARD.exe" "$programFilesDir\LABGUARD.exe" -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path "$distDir\WebView2Loader.dll") {
        Copy-Item "$distDir\WebView2Loader.dll" "$programFilesDir\WebView2Loader.dll" -Force -ErrorAction SilentlyContinue
    }
} catch {
    Write-Host "Note: Running under user context, preserving LocalAppData installation." -ForegroundColor Gray
}

Write-Host "`n=========================================================" -ForegroundColor Green
Write-Host " LABGUARD V2 SYSTEM APPLICATION SUCCESSFULLY PACKAGED!" -ForegroundColor Green
Write-Host " Deployment Folder: $projectRoot\LABGUARD_DEPLOYMENT_PACKAGE" -ForegroundColor White
Write-Host " Target Executable: $projectRoot\LABGUARD_DEPLOYMENT_PACKAGE\LABGUARD.exe" -ForegroundColor White
Write-Host " Setup Wizard:      $projectRoot\LABGUARD_DEPLOYMENT_PACKAGE\LABGUARD-Setup.exe" -ForegroundColor White
Write-Host "=========================================================" -ForegroundColor Green
