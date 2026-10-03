$llvmItem = Get-ChildItem -Path "$env:LOCALAPPDATA\Microsoft\WinGet" -Recurse -Filter "dlltool.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
$cleanPath = ($env:PATH.Split(';') | Where-Object { $_ -notlike '*C:\MinGW*' }) -join ';'
if ($llvmItem) {
    $env:PATH = "$($llvmItem.Directory.FullName);$cleanPath"
} else {
    $env:PATH = $cleanPath
}
Set-Location "c:\Users\Sakshit Sai\Desktop\Labguard\desktop\src-tauri"
cargo check --target x86_64-pc-windows-gnu
