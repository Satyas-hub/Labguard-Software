# LABGUARD v2.5.0: Production Release Checklist

---

## 1. Pre-Release Verification

- [x] **Zero Data Loss**: Supabase 37 baseline tables verified and preserved.
- [x] **Additive Migration**: `05_production_master_upgrade.sql` prepared.
- [x] **Global Version Synchronization**: All 8 version files upgraded to `2.5.0`.
- [x] **Responsive Scaling**: `LoginView.tsx` optimized for 1366×768 resolution displays.
- [x] **4 Roles Enforced**: `ADMIN`, `FACULTY`, `LAB_ASSISTANT`, `STUDENT`.
- [x] **PC Identity & Rebind**: Uniqueness and rebind capabilities validated.
- [x] **Safe Auto-Shutdown**: Confined strictly to authenticated Student sessions.
- [x] **Offline-First SQLite**: Local SQLite storage and sync queue operational.
- [x] **Automated Tests**: 9/9 backend unit & integration tests passing.
- [x] **Production Compilation**: Desktop Vite bundle builds without errors.

---

## 2. Windows Installer Package Specifications
- **Script**: `installer/setup_script.iss`
- **Output Target**: `dist/LABGUARD-Setup.exe`
- **Installation Directory**: `C:\Program Files\LABGUARD\`
- **Data Directory**: `C:\ProgramData\LABGUARD\`
- **Architecture**: Windows x64 (10/11)
