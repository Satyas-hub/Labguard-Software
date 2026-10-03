# ============================================================================
# LABGUARD: Complete System Purge & Uninstallation Script
# ============================================================================
$ErrorActionPreference = "SilentlyContinue"

Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host "  Starting Complete System Cleanup of LABGUARD" -ForegroundColor Cyan
Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host ""

# ----------------------------------------------------------------------------
# Step 1: Terminate All LabGuard Processes
# ----------------------------------------------------------------------------
Write-Host "[1/4] Terminating LabGuard processes..." -ForegroundColor Yellow

Get-Process | Where-Object { 
    $_.ProcessName -match "labguard" -or 
    ($_.Path -and ($_.Path -match "C:\\Program Files\\LABGUARD" -or $_.Path -match "C:\\ProgramData\\LABGUARD")) 
} | ForEach-Object {
    Write-Host "      -> Killing process: $($_.ProcessName) (PID: $($_.Id)) - $($_.Path)" -ForegroundColor Magenta
    Stop-Process -Id $_.Id -Force
}

# Explicitly ensure node.exe running from Program Files\LABGUARD is terminated
Get-Process node -ErrorAction SilentlyContinue | Where-Object {
    $_.Path -and ($_.Path -match "LABGUARD")
} | ForEach-Object {
    Write-Host "      -> Killing LabGuard node server (PID: $($_.Id))" -ForegroundColor Magenta
    Stop-Process -Id $_.Id -Force
}

Start-Sleep -Seconds 2

# ----------------------------------------------------------------------------
# Step 2: Remove Shortcuts and Start Menu Folders
# ----------------------------------------------------------------------------
Write-Host "[2/4] Removing Desktop and Start Menu shortcuts..." -ForegroundColor Yellow

$shortcuts = @(
    "C:\Users\Public\Desktop\LABGUARD.lnk",
    "$env:USERPROFILE\Desktop\LABGUARD.lnk",
    "C:\ProgramData\Microsoft\Windows\Start Menu\Programs\LABGUARD",
    "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\LABGUARD"
)

foreach ($item in $shortcuts) {
    if (Test-Path $item) {
        Remove-Item -Path $item -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "      -> Removed shortcut/menu: $item" -ForegroundColor Green
    }
}

# ----------------------------------------------------------------------------
# Step 3: Remove All Application & Data Directories
# ----------------------------------------------------------------------------
Write-Host "[3/4] Purging application directories & AppData..." -ForegroundColor Yellow

$directories = @(
    "C:\Program Files\LABGUARD",
    "C:\Program Files (x86)\LABGUARD",
    "C:\ProgramData\LABGUARD",
    "$env:LOCALAPPDATA\Programs\LABGUARD",
    "$env:LOCALAPPDATA\Programs\LabGuard",
    "$env:LOCALAPPDATA\edu.labguard.system",
    "$env:LOCALAPPDATA\LabGuardStandaloneProfile",
    "$env:LOCALAPPDATA\LABGUARD",
    "$env:LOCALAPPDATA\labguard",
    "$env:APPDATA\LABGUARD",
    "$env:APPDATA\labguard",
    "$env:LOCALAPPDATA\Temp\.net\LABGUARD"
)

foreach ($dir in $directories) {
    if (Test-Path $dir) {
        try {
            Remove-Item -Path $dir -Recurse -Force -ErrorAction Stop
            Write-Host "      -> Successfully deleted: $dir" -ForegroundColor Green
        } catch {
            Write-Host "      -> Retrying deletion of $dir..." -ForegroundColor Yellow
            Start-Sleep -Seconds 1
            Remove-Item -Path $dir -Recurse -Force -ErrorAction SilentlyContinue
            if (-not (Test-Path $dir)) {
                Write-Host "      -> Deleted on retry: $dir" -ForegroundColor Green
            } else {
                Write-Host "      -> [WARNING] Could not delete ${dir}" -ForegroundColor Red
            }
        }
    }
}

# Also clean any setup temp folders matching *LABGUARD* in Temp
Get-ChildItem -Path "$env:LOCALAPPDATA\Temp" -Filter "*LABGUARD*" -Recurse -Depth 2 -ErrorAction SilentlyContinue | ForEach-Object {
    Remove-Item -Path $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "      -> Cleaned temp artifact: $($_.FullName)" -ForegroundColor DarkGray
}

# ----------------------------------------------------------------------------
# Step 4: Remove Registry Entries
# ----------------------------------------------------------------------------
Write-Host "[4/4] Removing Registry entries..." -ForegroundColor Yellow

# Registry Run keys
$runKeys = @(
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run",
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Run"
)
foreach ($rk in $runKeys) {
    if (Test-Path $rk) {
        $val = Get-ItemProperty -Path $rk -ErrorAction SilentlyContinue
        if ($val.LABGUARD) {
            Remove-ItemProperty -Path $rk -Name "LABGUARD" -Force -ErrorAction SilentlyContinue
            Write-Host "      -> Removed Run value from $rk" -ForegroundColor Green
        }
        if ($val.LabGuard) {
            Remove-ItemProperty -Path $rk -Name "LabGuard" -Force -ErrorAction SilentlyContinue
            Write-Host "      -> Removed Run value from $rk" -ForegroundColor Green
        }
    }
}

# Registry Uninstall keys
$uninstallKeys = @(
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\{8F3A29B0-1A4C-4F92-B7E3-5D9E2A8C1100}_is1",
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\{8F3A29B0-1A4C-4F92-B7E3-5D9E2A8C1100}_is1",
    "HKLM:\Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall\{8F3A29B0-1A4C-4F92-B7E3-5D9E2A8C1100}_is1",
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\LabGuard",
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\LabGuard"
)
foreach ($uk in $uninstallKeys) {
    if (Test-Path $uk) {
        Remove-Item -Path $uk -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "      -> Removed uninstall key: $uk" -ForegroundColor Green
    }
}

# Registry Software keys
$softwareKeys = @(
    "HKCU:\Software\LABGUARD",
    "HKLM:\Software\LABGUARD"
)
foreach ($sk in $softwareKeys) {
    if (Test-Path $sk) {
        Remove-Item -Path $sk -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "      -> Removed software key: $sk" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "==========================================================================" -ForegroundColor Green
Write-Host "  [COMPLETED] LABGUARD SYSTEM PURGE FINISHED!" -ForegroundColor Green
Write-Host "==========================================================================" -ForegroundColor Green
