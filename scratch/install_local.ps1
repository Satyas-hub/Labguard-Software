Write-Host "Stopping any running LABGUARD processes..." -ForegroundColor Cyan
Stop-Process -Name "LABGUARD" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "LabGuard" -Force -ErrorAction SilentlyContinue

$installDir = "$env:LOCALAPPDATA\Programs\LabGuard"
$assetsDir = "$installDir\Assets"
$progData = "C:\ProgramData\LABGUARD"

Write-Host "Preparing directories..." -ForegroundColor Cyan
$null = New-Item -ItemType Directory -Path $installDir -Force
$null = New-Item -ItemType Directory -Path $assetsDir -Force
$null = New-Item -ItemType Directory -Path "$installDir\server" -Force
$null = New-Item -ItemType Directory -Path "$progData\database" -Force
$null = New-Item -ItemType Directory -Path "$progData\sync" -Force
$null = New-Item -ItemType Directory -Path "$progData\logs" -Force
$null = New-Item -ItemType Directory -Path "$progData\evidence" -Force
$null = New-Item -ItemType Directory -Path "$progData\config" -Force
$null = New-Item -ItemType Directory -Path "$progData\server" -Force

Write-Host "Deploying v2.5.0 binaries..." -ForegroundColor Cyan
Copy-Item "LABGUARD_DEPLOYMENT_PACKAGE\LABGUARD.exe" "$installDir\LabGuard.exe" -Force
Copy-Item "LABGUARD_DEPLOYMENT_PACKAGE\LABGUARD.exe" "$installDir\LABGUARD.exe" -Force
Copy-Item "LABGUARD_DEPLOYMENT_PACKAGE\WebView2Loader.dll" "$installDir\WebView2Loader.dll" -Force
Copy-Item "LABGUARD_DEPLOYMENT_PACKAGE\logo.ico" "$assetsDir\logo.ico" -Force
Copy-Item "LABGUARD_DEPLOYMENT_PACKAGE\Start_LABGUARD.bat" "$installDir\Start_LABGUARD.bat" -Force
Copy-Item "LABGUARD_DEPLOYMENT_PACKAGE\Set_Server_IP.bat" "$installDir\Set_Server_IP.bat" -Force
Copy-Item "LABGUARD_DEPLOYMENT_PACKAGE\server\*" "$installDir\server\" -Force
Copy-Item "LABGUARD_DEPLOYMENT_PACKAGE\server\*" "$progData\server\" -Force

Write-Host "Updating Windows Add/Remove registry to v2.5.0..." -ForegroundColor Cyan
$regKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\LabGuard"
if (-not (Test-Path $regKey)) { $null = New-Item -Path $regKey -Force }
Set-ItemProperty -Path $regKey -Name "DisplayName" -Value "LABGUARD V2 — Computer Lab Management System" -Force
Set-ItemProperty -Path $regKey -Name "DisplayVersion" -Value "2.5.0" -Force
Set-ItemProperty -Path $regKey -Name "Publisher" -Value "LABGUARD Institutional Technologies" -Force
Set-ItemProperty -Path $regKey -Name "InstallLocation" -Value $installDir -Force
Set-ItemProperty -Path $regKey -Name "DisplayIcon" -Value "$assetsDir\logo.ico,0" -Force
Set-ItemProperty -Path $regKey -Name "UninstallString" -Value "`"$installDir\Uninstall.bat`"" -Force

Write-Host "Refreshing desktop shortcut..." -ForegroundColor Cyan
$ws = New-Object -ComObject WScript.Shell
$desktopLnk = $ws.CreateShortcut([System.IO.Path]::Combine([System.Environment]::GetFolderPath('Desktop'), 'LABGUARD.lnk'))
$desktopLnk.TargetPath = "$installDir\Start_LABGUARD.bat"
$desktopLnk.WindowStyle = 7
$desktopLnk.WorkingDirectory = $installDir
$desktopLnk.IconLocation = "$assetsDir\logo.ico,0"
$desktopLnk.Description = "LABGUARD V2 Institutional Laboratory Management System"
$desktopLnk.Save()

Write-Host "SUCCESS: LABGUARD v2.5.0 successfully installed to $installDir" -ForegroundColor Green
