Stop-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*Programs\LabGuard\server*" }

# Find and kill node process on port 5000 if any
$connections = Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue
foreach ($conn in $connections) {
    Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
}

$installDir = "$env:LOCALAPPDATA\Programs\LabGuard\server"
Copy-Item "LABGUARD_DEPLOYMENT_PACKAGE\server\server.bundle.cjs" "$installDir\server.bundle.cjs" -Force
Copy-Item "backend\.env" "$installDir\.env" -Force

Start-Process -FilePath "$installDir\node.exe" -ArgumentList "server.bundle.cjs" -WorkingDirectory $installDir -WindowStyle Hidden
Start-Sleep -Seconds 2

$check = Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue
if ($check) {
    Write-Host "SUCCESS: LABGUARD Server running on port 5000 with Supabase sync enabled!"
} else {
    Write-Host "WARNING: Server did not open port 5000 yet."
}
