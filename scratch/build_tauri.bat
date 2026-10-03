@echo off
set "LLVM_BIN=C:\Users\Sakshit Sai\AppData\Local\Microsoft\WinGet\Packages\MartinStorsjo.LLVM-MinGW.UCRT_Microsoft.Winget.Source_8wekyb3d8bbwe\llvm-mingw-20260616-ucrt-x86_64\bin"
set "PATH=%LLVM_BIN%;%PATH%"
:: Remove 32-bit C:\MinGW\bin from path
set "PATH=%PATH:C:\MinGW\bin;=%"
set "PATH=%PATH:C:\MinGW\bin=%"

echo Using dlltool:
where dlltool

cd /d "c:\Users\Sakshit Sai\Desktop\Labguard\desktop\src-tauri"
cargo build --release
