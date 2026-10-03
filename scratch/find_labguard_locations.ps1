$ErrorActionPreference = "SilentlyContinue"

Write-Host "=== CHECKING DIRECTORIES ==="
$paths = @(
    "C:\Program Files\LABGUARD",
    "C:\Program Files (x86)\LABGUARD",
    "C:\ProgramData\LABGUARD",
    "$env:LOCALAPPDATA\Programs\LabGuard",
    "$env:LOCALAPPDATA\LABGUARD",
    "$env:LOCALAPPDATA\labguard",
    "$env:APPDATA\LABGUARD",
    "$env:APPDATA\labguard",
    "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\LABGUARD",
    "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\LABGUARD",
    "$env:USERPROFILE\Desktop\LABGUARD.lnk",
    "$env:PUBLIC\Desktop\LABGUARD.lnk"
)

foreach ($p in $paths) {
    if (Test-Path $p) {
        Write-Host "[EXISTS] $p" -ForegroundColor Green
    } else {
        Write-Host "[NOT FOUND] $p" -ForegroundColor DarkGray
    }
}

Write-Host ""
Write-Host "=== SCANNING USERPROFILE APPDATA FOR *LABGUARD* ==="
Get-ChildItem -Path "$env:LOCALAPPDATA" -Filter "*labguard*" -Recurse -Depth 2 | ForEach-Object { Write-Host "[FOUND IN LOCALAPPDATA] $($_.FullName)" }
Get-ChildItem -Path "$env:APPDATA" -Filter "*labguard*" -Recurse -Depth 2 | ForEach-Object { Write-Host "[FOUND IN APPDATA] $($_.FullName)" }

Write-Host ""
Write-Host "=== SCANNING C:\ProgramData FOR *LABGUARD* ==="
Get-ChildItem -Path "C:\ProgramData" -Filter "*labguard*" -Recurse -Depth 2 | ForEach-Object { Write-Host "[FOUND IN PROGRAMDATA] $($_.FullName)" }

Write-Host ""
Write-Host "=== SCANNING PROGRAM FILES ==="
Get-ChildItem -Path "C:\Program Files" -Filter "*labguard*" -Recurse -Depth 2 | ForEach-Object { Write-Host "[FOUND IN PROGRAM FILES] $($_.FullName)" }
Get-ChildItem -Path "C:\Program Files (x86)" -Filter "*labguard*" -Recurse -Depth 2 | ForEach-Object { Write-Host "[FOUND IN PROGRAM FILES (x86)] $($_.FullName)" }

Write-Host ""
Write-Host "=== SCANNING REGISTRY UNINSTALL ==="
$uninstallPaths = @(
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*"
)
foreach ($up in $uninstallPaths) {
    Get-ItemProperty $up | Where-Object { $_.DisplayName -like "*LabGuard*" -or $_.PSChildName -like "*LabGuard*" } | ForEach-Object {
        Write-Host "[REG UNINSTALL] Key: $($_.PSPath) | DisplayName: $($_.DisplayName) | UninstallString: $($_.UninstallString)"
    }
}

Write-Host ""
Write-Host "=== SCANNING REGISTRY RUN / AUTOSTART ==="
@(
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run",
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Run"
) | ForEach-Object {
    $r = Get-ItemProperty -Path $_ -ErrorAction SilentlyContinue
    if ($r.LABGUARD -or $r.LabGuard) {
        Write-Host "[REG RUN FOUND] $_ => Labguard: $($r.LABGUARD)$($r.LabGuard)"
    }
}

Write-Host ""
Write-Host "=== SCANNING RUNNING PROCESSES ==="
Get-Process | Where-Object { 
    $_.ProcessName -match "labguard" -or 
    ($_.Path -and $_.Path -match "LABGUARD") 
} | ForEach-Object { 
    Write-Host "[PROCESS] $($_.Name) (PID: $($_.Id)) - Path: $($_.Path)" 
}

Write-Host ""
Write-Host "=== SCANNING SCHEDULED TASKS ==="
Get-ScheduledTask | Where-Object { $_.TaskName -match "labguard" } | ForEach-Object { Write-Host "[TASK] $($_.TaskName)" }

