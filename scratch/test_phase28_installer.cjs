// ============================================================================
// LABGUARD V2: PHASE 28 PRODUCTION WINDOWS INSTALLER VERIFICATION TEST
// Tests:
// 1. Version synchronization across all manifests to 2.2.8
// 2. Inno Setup script (setup_script.iss) configuration and directives
// 3. ProgramData enterprise vault provisioning (database, sync, logs, evidence, config)
// 4. Desktop & Start Menu shortcut definitions and Windows autostart registry
// 5. Inno Setup PE version resource metadata (2.2.8.0)
// 6. PowerShell installation engine and uninstaller engine routines
// 7. Standalone Rust setup builder configuration and versioning
// ============================================================================

const fs = require('fs');
const path = require('path');

let totalTests = 0;
let passedTests = 0;

function assert(condition, message, context) {
  totalTests++;
  if (condition) {
    console.log(`  [PASS] Test ${totalTests}: ${message}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] Test ${totalTests}: ${message}`);
    if (context !== undefined) {
      console.error('         Context:', typeof context === 'object' ? JSON.stringify(context) : context);
    }
    process.exitCode = 1;
  }
}

console.log('\n======================================================');
console.log('LABGUARD V2: PHASE 28 PRODUCTION WINDOWS INSTALLER');
console.log('======================================================\n');

const projectRoot = path.resolve(__dirname, '..');

// ----------------------------------------------------------------------------
// SECTION 1: Manifest Version Synchronization (v2.2.8)
// ----------------------------------------------------------------------------
console.log('--- SECTION 1: Manifest Version Synchronization (v2.2.8) ---');

// 1. Backend package.json
const backendPkgPath = path.join(projectRoot, 'backend', 'package.json');
const backendPkg = JSON.parse(fs.readFileSync(backendPkgPath, 'utf8'));
const currentVer = backendPkg.version;
assert(!!currentVer, 'backend/package.json defines valid version', currentVer);

// 2. Desktop package.json
const desktopPkgPath = path.join(projectRoot, 'desktop', 'package.json');
const desktopPkg = JSON.parse(fs.readFileSync(desktopPkgPath, 'utf8'));
assert(desktopPkg.version === currentVer, `desktop/package.json version matches backend (${currentVer})`, desktopPkg.version);

// 3. Desktop Cargo.toml
const desktopCargoPath = path.join(projectRoot, 'desktop', 'src-tauri', 'Cargo.toml');
const desktopCargo = fs.readFileSync(desktopCargoPath, 'utf8');
const cargoVerMatch = desktopCargo.match(/^version\s*=\s*"([^"]+)"/m);
assert(cargoVerMatch && cargoVerMatch[1] === currentVer, `desktop/src-tauri/Cargo.toml version matches backend (${currentVer})`, cargoVerMatch ? cargoVerMatch[1] : null);

// 4. Desktop tauri.conf.json
const tauriConfPath = path.join(projectRoot, 'desktop', 'src-tauri', 'tauri.conf.json');
const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
assert(tauriConf.version === currentVer, `desktop/src-tauri/tauri.conf.json version matches backend (${currentVer})`, tauriConf.version);

// 5. Inno Setup script
const issPath = path.join(projectRoot, 'installer', 'setup_script.iss');
const issContent = fs.readFileSync(issPath, 'utf8');
const issVerMatch = issContent.match(/#define\s+MyAppVersion\s+"([^"]+)"/);
assert(issVerMatch && issVerMatch[1] === currentVer, `installer/setup_script.iss MyAppVersion matches backend (${currentVer})`, issVerMatch ? issVerMatch[1] : null);

// 6. Setup builder Cargo.toml
const builderCargoPath = path.join(projectRoot, 'installer', 'setup_builder', 'Cargo.toml');
const builderCargo = fs.readFileSync(builderCargoPath, 'utf8');
const builderCargoVer = builderCargo.match(/^version\s*=\s*"([^"]+)"/m);
assert(builderCargoVer && builderCargoVer[1] === currentVer, `installer/setup_builder/Cargo.toml version matches backend (${currentVer})`, builderCargoVer ? builderCargoVer[1] : null);

// 7. Setup builder main.rs
const builderMainPath = path.join(projectRoot, 'installer', 'setup_builder', 'src', 'main.rs');
const builderMain = fs.readFileSync(builderMainPath, 'utf8');
assert(builderMain.includes(`Version: ${currentVer} (Production Release)`), `setup_builder/src/main.rs reports release ${currentVer}`);
assert(new RegExp(`DisplayVersion.*${currentVer}`).test(builderMain), `setup_builder/src/main.rs registers ${currentVer} in Windows Uninstall`);

// 8. PowerShell install engine
const installEnginePath = path.join(projectRoot, 'installer', 'install_engine.ps1');
const installEngine = fs.readFileSync(installEnginePath, 'utf8');
assert(installEngine.includes(`-Name "DisplayVersion" -Value "${currentVer}"`), `install_engine.ps1 registers ${currentVer} in Windows Uninstall`);

// ----------------------------------------------------------------------------
// SECTION 2: Inno Setup Production Script Directives & Quality
// ----------------------------------------------------------------------------
console.log('\n--- SECTION 2: Inno Setup Production Script Directives ---');

// App identity
assert(issContent.includes('#define MyAppName "LABGUARD"'), 'setup_script.iss defines MyAppName as LABGUARD');
assert(issContent.includes('#define MyAppExeName "LABGUARD.exe"'), 'setup_script.iss targets LABGUARD.exe');
assert(issContent.includes('AppId={{8F3A29B0-1A4C-4F92-B7E3-5D9E2A8C1100}'), 'setup_script.iss defines valid AppId GUID');

// Installation location & packaging
assert(issContent.includes('DefaultDirName={autopf}\\{#MyAppName}'), 'setup_script.iss installs to Program Files ({autopf}\\LABGUARD)');
assert(issContent.includes('OutputDir=..\\dist'), 'setup_script.iss outputs setup package to ..\\dist');
assert(issContent.includes('OutputBaseFilename=LABGUARD-Setup'), 'setup_script.iss names package LABGUARD-Setup');
assert(issContent.includes('Compression=lzma2/ultra64'), 'setup_script.iss specifies maximum lzma2/ultra64 compression');
assert(issContent.includes('SolidCompression=yes'), 'setup_script.iss specifies solid compression');
assert(issContent.includes('WizardStyle=modern'), 'setup_script.iss uses modern wizard style');
assert(issContent.includes('ArchitecturesInstallIn64BitMode=x64compatible'), 'setup_script.iss enforces 64-bit native mode');

// ProgramData Enterprise Vault Directories
assert(issContent.includes('{commonappdata}\\LABGUARD\\database'), 'setup_script.iss provisions {commonappdata}\\LABGUARD\\database vault');
assert(issContent.includes('{commonappdata}\\LABGUARD\\sync'), 'setup_script.iss provisions {commonappdata}\\LABGUARD\\sync vault');
assert(issContent.includes('{commonappdata}\\LABGUARD\\logs'), 'setup_script.iss provisions {commonappdata}\\LABGUARD\\logs vault');
assert(issContent.includes('{commonappdata}\\LABGUARD\\evidence'), 'setup_script.iss provisions {commonappdata}\\LABGUARD\\evidence vault');
assert(issContent.includes('{commonappdata}\\LABGUARD\\config'), 'setup_script.iss provisions {commonappdata}\\LABGUARD\\config vault');
assert(issContent.includes('Permissions: users-full'), 'setup_script.iss grants users-full permissions on enterprise vaults');

// Shortcuts & Autostart
assert(issContent.includes('Name: "{autodesktop}\\{#MyAppName}"'), 'setup_script.iss defines Desktop shortcut');
assert(issContent.includes('Name: "{group}\\{#MyAppName}"'), 'setup_script.iss defines Start Menu shortcut');
assert(issContent.includes('Name: "{group}\\{cm:UninstallProgram,{#MyAppName}}"'), 'setup_script.iss defines Start Menu Uninstaller shortcut');
assert(issContent.includes('Subkey: "Software\\Microsoft\\Windows\\CurrentVersion\\Run"'), 'setup_script.iss configures Windows autostart Run key');

// PE Version Resource Metadata
assert(issContent.includes(`VersionInfoVersion=${currentVer}.0`), `setup_script.iss includes VersionInfoVersion=${currentVer}.0`);
assert(issContent.includes(`VersionInfoTextVersion=${currentVer}`), `setup_script.iss includes VersionInfoTextVersion=${currentVer}`);
assert(issContent.includes(`VersionInfoProductVersion=${currentVer}`), `setup_script.iss includes VersionInfoProductVersion=${currentVer}`);
assert(issContent.includes('VersionInfoCompany='), 'setup_script.iss includes VersionInfoCompany');
assert(issContent.includes('VersionInfoDescription='), 'setup_script.iss includes VersionInfoDescription');
assert(issContent.includes('VersionInfoCopyright='), 'setup_script.iss includes VersionInfoCopyright');

// ----------------------------------------------------------------------------
// SECTION 3: PowerShell Installation & Uninstallation Engine
// ----------------------------------------------------------------------------
console.log('\n--- SECTION 3: PowerShell Installation & Uninstaller Engine ---');

assert(installEngine.includes('Get-Process | Where-Object { $_.ProcessName -like \'*LabGuard*\' } | Stop-Process'), 'install_engine.ps1 gracefully halts running instances');
assert(installEngine.includes('foreach ($sub in @("database", "config", "evidence", "logs", "sync"))'), 'install_engine.ps1 creates all 5 enterprise vaults');
assert(installEngine.includes('CreateShortcut("$env:USERPROFILE\\Desktop\\LABGUARD.lnk")'), 'install_engine.ps1 creates Desktop shortcut');
assert(installEngine.includes('Start Menu\\Programs\\LABGUARD'), 'install_engine.ps1 creates Start Menu program group');
assert(installEngine.includes('Uninstall.bat'), 'install_engine.ps1 generates standalone Uninstall.bat');

const uninstallEnginePath = path.join(projectRoot, 'installer', 'uninstall_engine.ps1');
const uninstallEngine = fs.readFileSync(uninstallEnginePath, 'utf8');
assert(uninstallEngine.includes('taskkill /F') || uninstallEngine.includes('Stop-Process'), 'uninstall_engine.ps1 terminates running processes');
assert(uninstallEngine.includes('Remove-Item -Path $desktopLnk') || uninstallEngine.includes('del /F /Q'), 'uninstall_engine.ps1 cleans up desktop shortcut');
assert(uninstallEngine.includes('Remove-Item -Path $startMenu') || uninstallEngine.includes('rmdir /S /Q'), 'uninstall_engine.ps1 cleans up Start Menu');
assert(uninstallEngine.includes('Uninstall\\LabGuard'), 'uninstall_engine.ps1 deletes Windows registry uninstall registration');

// ----------------------------------------------------------------------------
// SECTION 4: Standalone Setup Builder (Rust Native)
// ----------------------------------------------------------------------------
console.log('\n--- SECTION 4: Standalone Setup Builder (Rust Native) ---');

assert(builderMain.includes('include_bytes!("../../../dist/LABGUARD.exe")'), 'setup_builder embeds LABGUARD.exe');
assert(builderMain.includes('include_bytes!("../../../assets/logo.ico")'), 'setup_builder embeds logo.ico');
assert(builderMain.includes('database", "config", "evidence", "logs", "sync'), 'setup_builder initializes all 5 enterprise vaults');
assert(builderMain.includes('create_shortcut(&target_exe, &target_ico, &desktop_shortcut)'), 'setup_builder creates desktop shortcut');
assert(builderMain.includes('create_shortcut(&target_exe, &target_ico, &start_shortcut)'), 'setup_builder creates Start Menu shortcut');
assert(builderMain.includes('register_in_windows_uninstall'), 'setup_builder registers in Windows Add/Remove Programs');

// ----------------------------------------------------------------------------
// SECTION 5: Distribution Assets & Packaging Infrastructure
// ----------------------------------------------------------------------------
console.log('\n--- SECTION 5: Distribution Assets & Packaging Infrastructure ---');

assert(fs.existsSync(path.join(projectRoot, 'assets', 'logo.ico')), 'assets/logo.ico icon exists');
assert(fs.existsSync(path.join(projectRoot, 'assets', 'logo.png')), 'assets/logo.png branding exists');

const buildInstallerPath = path.join(projectRoot, 'installer', 'build_installer.ps1');
const buildInstaller = fs.readFileSync(buildInstallerPath, 'utf8');
assert(buildInstaller.includes('New-Item -ItemType Directory -Path "$programDataDir\\database"'), 'build_installer.ps1 provisions ProgramData vaults');
assert(buildInstaller.includes('build_setup_exe.ps1'), 'build_installer.ps1 invokes graphical setup wizard build');

const buildSetupExePath = path.join(projectRoot, 'installer', 'build_setup_exe.ps1');
const buildSetupExe = fs.readFileSync(buildSetupExePath, 'utf8');
assert(buildSetupExe.includes('setup_script.iss'), 'build_setup_exe.ps1 compiles setup_script.iss');

// ----------------------------------------------------------------------------
// SUMMARY
// ----------------------------------------------------------------------------
console.log('\n======================================================');
console.log(`PHASE 28 TESTS COMPLETE: ${passedTests}/${totalTests} PASSED`);
console.log('======================================================\n');
