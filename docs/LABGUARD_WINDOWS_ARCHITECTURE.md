# LABGUARD v2.5.0: Native Windows Platform Architecture

---

## 1. Operating System Targets
- **Supported OS**: Microsoft Windows 10 (Build 19041+) and Windows 11 (64-bit).
- **Process Architecture**: x86_64 / x64.
- **Runtime**: Native Tauri 2 wrapper compiling to `LABGUARD.exe` leveraging Microsoft Edge WebView2.

---

## 2. Directory Layout & File Permissions
- **Binaries (`Read-Only / Protected`)**:
  - Path: `C:\Program Files\LABGUARD\`
  - Contents: `LABGUARD.exe`, `WebView2Loader.dll`, `assets/`, `server/`
- **Application Data (`Read/Write Local Storage`)**:
  - Path: `C:\ProgramData\LABGUARD\`
  - Subdirectories:
    - `database\`: `labguard.db` (Local SQLite database)
    - `config\`: `workstation.json` (Bound hardware identity & registration tokens)
    - `sync\`: Pending offline synchronization queue blobs
    - `logs\`: Structured application and security event logs
    - `evidence\`: Locally captured student issue evidence photos

---

## 3. Windows Native Subsystems & Integrations

### Single Instance Enforcement
- Leverages Win32 Named Mutex `Local\LABGUARD_DESKTOP_SINGLE_INSTANCE_MUTEX`.
- If a secondary instance is launched, the primary window is found via `FindWindowA` and brought to foreground (`SetForegroundWindow` / `ShowWindow SW_RESTORE`), immediately terminating the duplicate process.

### Windows Autostart
- Configurable via `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` or Inno Setup startup task.
- Ensures terminal launches into the LABGUARD login gate upon machine boot before student desktop interaction.

### Hardware PnP Monitoring
- Queries attached Keyboards, Mice, and Monitors via native Windows PnP registry and WMI subsystems.
- Real-time detection of peripheral disconnection and reconnection without false damage attribution.
