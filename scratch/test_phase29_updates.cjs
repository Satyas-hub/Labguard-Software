// ============================================================================
// LABGUARD V2: PHASE 29 APPLICATION UPDATES VERIFICATION TEST SUITE
// Tests:
// 1. Version manifest synchronization across all 8 files (2.2.9)
// 2. Central update check endpoint (GET /api/system/updates/check)
//    - Current client version returns hasUpdate: false
//    - Older supported client returns hasUpdate: true, mandatory: false, SHA-256, notes
//    - Legacy client below minSupportedVersion returns mandatory: true
// 3. Cryptographic integrity verification endpoint (POST /api/system/updates/verify)
//    - Valid checksum returns verified: true and dataPreserved: true
//    - Missing version rejected with HTTP 400 VALIDATION_ERROR
//    - Corrupted checksum rejected with HTTP 422 INTEGRITY_VERIFICATION_FAILED
// 4. Safe local data preservation validation (all 5 ProgramData vaults retained)
// 5. Native Tauri commands in main.rs and TypeScript wrappers in native.ts
// 6. Desktop UpdateService and UpdateNotificationModal component
// ============================================================================

const http = require('http');
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
console.log('LABGUARD V2: PHASE 29 APPLICATION UPDATES VERIFICATION');
console.log('======================================================\n');

const projectRoot = path.resolve(__dirname, '..');

// Import compiled backend app
const { app } = require('../backend/dist/backend/src/server.js');

const TEST_PORT = 5007;
let server;

function makeRequest(method, pathUrl, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const body = data ? JSON.stringify(data) : null;
    if (body) headers['Content-Length'] = Buffer.byteLength(body);

    const req = http.request(
      {
        hostname: 'localhost',
        port: TEST_PORT,
        path: pathUrl,
        method,
        headers
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(raw) });
          } catch {
            resolve({ status: res.statusCode, body: raw });
          }
        });
      }
    );

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function runTests() {
  server = app.listen(TEST_PORT, async () => {
    console.log(`[UpdateTest] Test server mounted on port ${TEST_PORT}\n`);

    try {
      // ------------------------------------------------------------------------
      // SECTION 1: Manifest Version Synchronization (v2.2.9)
      // ------------------------------------------------------------------------
      const backendPkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'backend', 'package.json'), 'utf8'));
      const currentVer = backendPkg.version;
      console.log(`--- SECTION 1: Manifest Version Synchronization (v${currentVer}) ---`);
      assert(!!currentVer, 'backend/package.json defines valid version', currentVer);

      const desktopPkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'desktop', 'package.json'), 'utf8'));
      assert(desktopPkg.version === currentVer, `desktop/package.json version matches backend (${currentVer})`, desktopPkg.version);

      const desktopCargo = fs.readFileSync(path.join(projectRoot, 'desktop', 'src-tauri', 'Cargo.toml'), 'utf8');
      const cargoVerMatch = desktopCargo.match(/^version\s*=\s*"([^"]+)"/m);
      assert(cargoVerMatch && cargoVerMatch[1] === currentVer, `desktop/src-tauri/Cargo.toml version matches backend (${currentVer})`, cargoVerMatch ? cargoVerMatch[1] : null);

      const tauriConf = JSON.parse(fs.readFileSync(path.join(projectRoot, 'desktop', 'src-tauri', 'tauri.conf.json'), 'utf8'));
      assert(tauriConf.version === currentVer, `desktop/src-tauri/tauri.conf.json version matches backend (${currentVer})`, tauriConf.version);

      const issContent = fs.readFileSync(path.join(projectRoot, 'installer', 'setup_script.iss'), 'utf8');
      const issVerMatch = issContent.match(/#define\s+MyAppVersion\s+"([^"]+)"/);
      assert(issVerMatch && issVerMatch[1] === currentVer, `installer/setup_script.iss MyAppVersion matches backend (${currentVer})`, issVerMatch ? issVerMatch[1] : null);
      assert(issContent.includes(`VersionInfoVersion=${currentVer}.0`), `setup_script.iss VersionInfoVersion is ${currentVer}.0`);
      assert(issContent.includes(`VersionInfoProductVersion=${currentVer}`), `setup_script.iss VersionInfoProductVersion is ${currentVer}`);

      const builderCargo = fs.readFileSync(path.join(projectRoot, 'installer', 'setup_builder', 'Cargo.toml'), 'utf8');
      const builderCargoVer = builderCargo.match(/^version\s*=\s*"([^"]+)"/m);
      assert(builderCargoVer && builderCargoVer[1] === currentVer, `setup_builder/Cargo.toml version matches backend (${currentVer})`, builderCargoVer ? builderCargoVer[1] : null);

      const builderMain = fs.readFileSync(path.join(projectRoot, 'installer', 'setup_builder', 'src', 'main.rs'), 'utf8');
      assert(builderMain.includes(`Version: ${currentVer} (Production Release)`), `setup_builder/src/main.rs reports ${currentVer}`);
      assert(new RegExp(`DisplayVersion.*${currentVer}`).test(builderMain), `setup_builder registers ${currentVer} in Windows Uninstall`);

      const installEngine = fs.readFileSync(path.join(projectRoot, 'installer', 'install_engine.ps1'), 'utf8');
      assert(installEngine.includes(`-Name "DisplayVersion" -Value "${currentVer}"`), `install_engine.ps1 registers ${currentVer} in Windows Uninstall`);

      // ------------------------------------------------------------------------
      // SECTION 2: Central Version Checking Endpoint (/api/system/updates/check)
      // ------------------------------------------------------------------------
      console.log('\n--- SECTION 2: Central Version Checking Endpoint ---');

      // 1. Current version -> hasUpdate should be false
      const currentRes = await makeRequest('GET', `/api/system/updates/check?version=${currentVer}&platform=windows`);
      assert(currentRes.status === 200 && currentRes.body.success, 'GET /api/system/updates/check returns HTTP 200', currentRes);
      assert(currentRes.body.data.hasUpdate === false, `Current version ${currentVer} correctly reports hasUpdate: false`, currentRes.body.data);
      assert(currentRes.body.data.latestVersion === currentVer, `Latest version is reported as ${currentVer}`);

      // 2. Older supported version (2.2.0) -> hasUpdate should be true, mandatory: false
      const olderRes = await makeRequest('GET', '/api/system/updates/check?version=2.2.0&platform=windows');
      assert(olderRes.status === 200 && olderRes.body.success, 'Check for older version returns HTTP 200');
      assert(olderRes.body.data.hasUpdate === true, 'Older version 2.2.0 detects available update (hasUpdate: true)');
      assert(olderRes.body.data.mandatory === false, 'Supported older version 2.2.0 is non-mandatory');
      assert(!!olderRes.body.data.downloadUrl, 'Download URL is provided in update info');
      assert(!!olderRes.body.data.sha256Checksum, 'Cryptographic SHA-256 checksum is provided');
      assert(Array.isArray(olderRes.body.data.releaseNotes) && olderRes.body.data.releaseNotes.length > 0, 'Release notes list is populated');
      assert(olderRes.body.data.fileSizeBytes > 0, 'Package file size bytes is reported');

      // 3. Legacy version below minSupportedVersion (1.0.0) -> mandatory: true
      const legacyRes = await makeRequest('GET', '/api/system/updates/check?version=1.0.0&platform=windows');
      assert(legacyRes.status === 200 && legacyRes.body.success, 'Check for legacy version returns HTTP 200');
      assert(legacyRes.body.data.hasUpdate === true, 'Legacy client detects available update');
      assert(legacyRes.body.data.mandatory === true, 'Legacy client below minSupportedVersion triggers mandatory update directive');

      // ------------------------------------------------------------------------
      // SECTION 3: Cryptographic Integrity Verification Endpoint (/api/system/updates/verify)
      // ------------------------------------------------------------------------
      console.log('\n--- SECTION 3: Cryptographic Integrity Verification Endpoint ---');

      const expectedChecksum = olderRes.body.data.sha256Checksum;

      // 1. Missing version in request -> HTTP 400
      const missingVer = await makeRequest('POST', '/api/system/updates/verify', { checksum: expectedChecksum });
      assert(missingVer.status === 400 && !missingVer.body.success, 'Missing version string returns HTTP 400');
      assert(missingVer.body.error === 'VALIDATION_ERROR', 'Rejection code is VALIDATION_ERROR');

      // 2. Corrupted / tampered checksum -> HTTP 422
      const tamperedRes = await makeRequest('POST', '/api/system/updates/verify', {
        version: currentVer,
        platform: 'windows',
        checksum: 'deadbeef00000000000000000000000000000000000000000000000000000000'
      });
      assert(tamperedRes.status === 422 && !tamperedRes.body.success, 'Tampered checksum rejected with HTTP 422');
      assert(tamperedRes.body.error === 'INTEGRITY_VERIFICATION_FAILED', 'Rejection code flags INTEGRITY_VERIFICATION_FAILED');
      assert(tamperedRes.body.data.verified === false, 'Verification result reports verified: false');

      // 3. Valid checksum verification -> HTTP 200
      const validRes = await makeRequest('POST', '/api/system/updates/verify', {
        version: currentVer,
        platform: 'windows',
        checksum: expectedChecksum
      });
      assert(validRes.status === 200 && validRes.body.success, 'Valid checksum verification returns HTTP 200', validRes);
      assert(validRes.body.data.verified === true, 'Integrity verification succeeds (verified: true)');
      assert(validRes.body.data.dataPreserved === true, 'Safe data preservation verified (dataPreserved: true)');
      assert(Array.isArray(validRes.body.data.preservedVaults), 'Preserved vaults array returned');

      const expectedVaults = ['database', 'sync', 'logs', 'evidence', 'config'];
      const allVaultsCovered = expectedVaults.every(v => validRes.body.data.preservedVaults.includes(v));
      assert(allVaultsCovered, 'All 5 enterprise vaults (database, sync, logs, evidence, config) protected for data preservation');

      // ------------------------------------------------------------------------
      // SECTION 4: Native Tauri Command Architecture
      // ------------------------------------------------------------------------
      console.log('\n--- SECTION 4: Native Tauri Command Architecture ---');

      const mainRsPath = path.join(projectRoot, 'desktop', 'src-tauri', 'src', 'main.rs');
      const mainRs = fs.readFileSync(mainRsPath, 'utf8');

      assert(mainRs.includes('fn check_local_data_integrity'), 'main.rs implements check_local_data_integrity command');
      assert(mainRs.includes('fn verify_update_payload'), 'main.rs implements verify_update_payload command');
      assert(mainRs.includes('LocalDataIntegrityReport'), 'main.rs defines LocalDataIntegrityReport structure');
      assert(mainRs.includes('PayloadVerificationReport'), 'main.rs defines PayloadVerificationReport structure');
      assert(mainRs.includes('check_local_data_integrity,'), 'check_local_data_integrity registered in tauri::generate_handler');
      assert(mainRs.includes('verify_update_payload'), 'verify_update_payload registered in tauri::generate_handler');

      // ------------------------------------------------------------------------
      // SECTION 5: Desktop Native Service & Update Service
      // ------------------------------------------------------------------------
      console.log('\n--- SECTION 5: Desktop Native Service & Update Service ---');

      const nativeTsPath = path.join(projectRoot, 'desktop', 'src', 'services', 'native.ts');
      const nativeTs = fs.readFileSync(nativeTsPath, 'utf8');

      assert(nativeTs.includes('checkLocalDataIntegrity(): Promise<NativeLocalDataIntegrityReport>'), 'native.ts exposes checkLocalDataIntegrity wrapper');
      assert(nativeTs.includes('verifyUpdatePayload('), 'native.ts exposes verifyUpdatePayload wrapper');

      const updateServicePath = path.join(projectRoot, 'desktop', 'src', 'services', 'updateService.ts');
      assert(fs.existsSync(updateServicePath), 'desktop/src/services/updateService.ts exists');

      const updateService = fs.readFileSync(updateServicePath, 'utf8');
      assert(updateService.includes('checkForUpdates('), 'UpdateService implements checkForUpdates');
      assert(updateService.includes('verifyUpdateWithServer('), 'UpdateService implements verifyUpdateWithServer');
      assert(updateService.includes('verifyLocalDataIntegrity('), 'UpdateService implements verifyLocalDataIntegrity');

      // ------------------------------------------------------------------------
      // SECTION 6: Desktop UI Component Integration
      // ------------------------------------------------------------------------
      console.log('\n--- SECTION 6: Desktop UI Component Integration ---');

      const modalPath = path.join(projectRoot, 'desktop', 'src', 'components', 'UpdateNotificationModal.tsx');
      assert(fs.existsSync(modalPath), 'UpdateNotificationModal.tsx exists');

      const modalContent = fs.readFileSync(modalPath, 'utf8');
      assert(modalContent.includes('Mandatory Security Update Required'), 'UpdateNotificationModal renders mandatory security update alert');
      assert(modalContent.includes('Release Highlights'), 'UpdateNotificationModal renders release highlights');
      assert(modalContent.includes('SHA-256 Checksum'), 'UpdateNotificationModal renders SHA-256 checksum');
      assert(modalContent.includes('Enterprise local database and vaults safely preserved'), 'UpdateNotificationModal renders vault preservation assurance');

    } catch (err) {
      console.error('[UpdateTest] Unexpected test error:', err);
      process.exitCode = 1;
    } finally {
      if (server) {
        server.close();
      }
      console.log('\n======================================================');
      console.log(`PHASE 29 TESTS COMPLETE: ${passedTests}/${totalTests} PASSED`);
      console.log('======================================================\n');
    }
  });
}

runTests();
