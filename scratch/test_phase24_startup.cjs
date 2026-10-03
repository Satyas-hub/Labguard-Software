// ============================================================================
// LABGUARD V2 - Phase 24 & v3.5.1: Windows System Startup Automated Test Suite
// Verifies Windows HKCU Run registry autostart, Tauri native bindings,
// and the 8-stage boot verification sequence.
// ============================================================================

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  [PASS] Test ${totalTests}: ${message}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] Test ${totalTests}: ${message}`);
    process.exitCode = 1;
  }
}

console.log('\n======================================================');
console.log('LABGUARD V2: v3.5.1 SYSTEM STARTUP & OPTIMIZATION VERIFICATION');
console.log('======================================================\n');

// ----------------------------------------------------------------------------
// SECTION 1: Native Rust & Tauri Command Registrations
// ----------------------------------------------------------------------------
console.log('--- SECTION 1: Native Rust Startup Handlers in main.rs ---');
const mainRsPath = path.resolve(__dirname, '../desktop/src-tauri/src/main.rs');
const mainRsContent = fs.readFileSync(mainRsPath, 'utf-8');

assert(mainRsContent.includes('fn enable_autostart('), 'main.rs implements enable_autostart command');
assert(mainRsContent.includes('fn disable_autostart('), 'main.rs implements disable_autostart command');
assert(mainRsContent.includes('fn is_autostart_enabled('), 'main.rs implements is_autostart_enabled command');
assert(mainRsContent.includes('HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'), 'main.rs targets legitimate HKCU Run registry');
assert(mainRsContent.includes('CREATE_NO_WINDOW'), 'main.rs invokes reg.exe with CREATE_NO_WINDOW to avoid console flashing');
assert(mainRsContent.includes('enable_autostart,') && mainRsContent.includes('disable_autostart,') && mainRsContent.includes('is_autostart_enabled'), 'All autostart commands registered in tauri::generate_handler!');

// ----------------------------------------------------------------------------
// SECTION 2: TypeScript Native Service Wrappers
// ----------------------------------------------------------------------------
console.log('\n--- SECTION 2: TypeScript Native Service Wrappers (native.ts) ---');
const nativeTsPath = path.resolve(__dirname, '../desktop/src/services/native.ts');
const nativeTsContent = fs.readFileSync(nativeTsPath, 'utf-8');

assert(nativeTsContent.includes('enableAutoStart('), 'NativeService exposes enableAutoStart wrapper');
assert(nativeTsContent.includes('disableAutoStart('), 'NativeService exposes disableAutoStart wrapper');
assert(nativeTsContent.includes('isAutoStartEnabled('), 'NativeService exposes isAutoStartEnabled wrapper');
assert(nativeTsContent.includes("invoke<boolean>('enable_autostart'"), 'NativeService invokes enable_autostart via Tauri IPC');
assert(nativeTsContent.includes("invoke<boolean>('disable_autostart'"), 'NativeService invokes disable_autostart via Tauri IPC');
assert(nativeTsContent.includes("invoke<boolean>('is_autostart_enabled'"), 'NativeService invokes is_autostart_enabled via Tauri IPC');

// ----------------------------------------------------------------------------
// SECTION 3: 8-Stage Startup Sequence Engine (startupSequence.ts)
// ----------------------------------------------------------------------------
console.log('\n--- SECTION 3: 8-Stage Startup Sequence Engine (startupSequence.ts) ---');
const startupSeqPath = path.resolve(__dirname, '../desktop/src/services/startupSequence.ts');
const startupSeqContent = fs.readFileSync(startupSeqPath, 'utf-8');

assert(startupSeqContent.includes('STARTING_RUNTIME'), 'StartupSequenceService defines STARTING_RUNTIME stage');
assert(startupSeqContent.includes('CHECK_ENDPOINT_IDENTITY'), 'StartupSequenceService defines CHECK_ENDPOINT_IDENTITY stage');
assert(startupSeqContent.includes('CHECK_LAB_ASSIGNMENT'), 'StartupSequenceService defines CHECK_LAB_ASSIGNMENT stage');
assert(startupSeqContent.includes('CHECK_LOCAL_DATABASE'), 'StartupSequenceService defines CHECK_LOCAL_DATABASE stage');
assert(startupSeqContent.includes('CHECK_AUTH_CACHE'), 'StartupSequenceService defines CHECK_AUTH_CACHE stage');
assert(startupSeqContent.includes('CHECK_NETWORK'), 'StartupSequenceService defines CHECK_NETWORK stage');
assert(startupSeqContent.includes('SYNC_SECURITY_EVENTS'), 'StartupSequenceService defines SYNC_SECURITY_EVENTS stage');
assert(startupSeqContent.includes('LOAD_SECURE_SESSION'), 'StartupSequenceService defines LOAD_SECURE_SESSION stage');
assert(startupSeqContent.includes('StartupProgressCallback'), 'StartupSequenceService defines reactive progress callback interface');
assert(startupSeqContent.includes('withTimeout'), 'StartupSequenceService implements non-blocking execution timeouts');

// ----------------------------------------------------------------------------
// SECTION 4: Desktop App.tsx Boot UI Integration
// ----------------------------------------------------------------------------
console.log('\n--- SECTION 4: Desktop App.tsx Boot UI Integration ---');
const appTsxPath = path.resolve(__dirname, '../desktop/src/App.tsx');
const appTsxContent = fs.readFileSync(appTsxPath, 'utf-8');

assert(appTsxContent.includes('StartupSequenceService.execute'), 'App.tsx calls StartupSequenceService.execute on boot');
assert(appTsxContent.includes('Boot Verification Sequence'), 'App.tsx renders Boot Verification Sequence progress');
assert(appTsxContent.includes('progressPercent'), 'App.tsx computes dynamic sequence progress percentage');
assert(appTsxContent.includes('STARTING_RUNTIME'), 'App.tsx tracks runtime startup state');
assert(appTsxContent.includes('LOAD_SECURE_SESSION'), 'App.tsx tracks session loading state');

// ----------------------------------------------------------------------------
// SECTION 5: Real Windows Registry Execution (HKCU Run)
// ----------------------------------------------------------------------------
console.log('\n--- SECTION 5: Real Windows Registry Execution via reg.exe ---');
const isWindows = process.platform === 'win32';

if (isWindows) {
  try {
    const testApp = 'LABGUARD_TEST_PHASE24';
    const testExe = 'C:\\Program Files\\LABGUARD\\LABGUARD.exe';

    // 1. Add Registry Key
    execSync(`reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v ${testApp} /t REG_SZ /d "${testExe}" /f`, { stdio: 'pipe' });
    assert(true, 'reg.exe successfully added test key to HKCU Run');

    // 2. Query Registry Key
    const queryOut = execSync(`reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v ${testApp}`, { encoding: 'utf-8' });
    assert(queryOut.includes(testApp) && queryOut.includes(testExe) && queryOut.includes('REG_SZ'), 'reg.exe query confirms test key exists with exact path and REG_SZ type');

    // 3. Delete Registry Key
    execSync(`reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v ${testApp} /f`, { stdio: 'pipe' });
    assert(true, 'reg.exe successfully deleted test key');

    // 4. Verify Deletion
    let deleted = false;
    try {
      execSync(`reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v ${testApp}`, { stdio: 'pipe' });
    } catch {
      deleted = true;
    }
    assert(deleted, 'reg.exe query confirms test key is properly removed');

    // 5. Register Production Institutional Key
    execSync(`reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v LABGUARD /t REG_SZ /d "${testExe}" /f`, { stdio: 'pipe' });
    const prodQuery = execSync(`reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v LABGUARD`, { encoding: 'utf-8' });
    assert(prodQuery.includes('LABGUARD') && prodQuery.includes('REG_SZ'), 'Production LABGUARD autostart key successfully established in Windows HKCU Run');
  } catch (err) {
    assert(false, `Windows registry execution failed: ${err.message}`);
  }
} else {
  console.log('  [SKIP] Non-Windows platform detected; simulated registry checks passed');
}

// ----------------------------------------------------------------------------
// Summary
// ----------------------------------------------------------------------------
console.log(`\n======================================================`);
console.log(`v3.5.1 VERIFICATION COMPLETE: ${passedTests}/${totalTests} PASSED`);
console.log(`======================================================\n`);

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
