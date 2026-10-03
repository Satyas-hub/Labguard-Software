// ============================================================================
// LABGUARD V2 - Phase 26: Security Hardening Automated Test Suite
// Verifies Zod schema validation, SQL injection defense, token expiration enforcement,
// algorithm pinning (HS256), and desktop bundle secret hygiene.
// ============================================================================

const fs = require('fs');
const path = require('path');
const http = require('http');
const jwt = require('../backend/node_modules/jsonwebtoken');

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
console.log('LABGUARD V2: PHASE 26 SECURITY HARDENING VERIFICATION');
console.log('======================================================\n');

// Import compiled backend app
const { app } = require('../backend/dist/backend/src/server.js');
const { ENV } = require('../backend/dist/backend/src/config/env.js');

const TEST_PORT = 5005;
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
    console.log(`[SecurityTest] Test server mounted on port ${TEST_PORT}\n`);

    try {
      // ------------------------------------------------------------------------
      // SECTION 1: Input Validation with Zod Schemas
      // ------------------------------------------------------------------------
      console.log('--- SECTION 1: Input Validation with Zod Schemas ---');

      // Test 1: Empty Login Payload
      const emptyLogin = await makeRequest('POST', '/api/auth/login', {});
      assert(emptyLogin.status === 400, 'Empty login payload returns HTTP 400');
      assert(emptyLogin.body.error === 'VALIDATION_ERROR', 'Rejection code is VALIDATION_ERROR');
      assert(Array.isArray(emptyLogin.body.details), 'Details array provided with field errors');

      // Test 2: Invalid Role Enum
      const invalidRole = await makeRequest('POST', '/api/auth/login', {
        identifier: 'admin@labguard.edu',
        password: 'Password@123',
        targetRole: 'SUPER_HACKER'
      });
      assert(invalidRole.status === 400, 'Invalid targetRole enum rejected with HTTP 400');
      assert(invalidRole.body.details.some(d => d.field === 'targetRole'), 'Validation details identify invalid targetRole field');

      // Test 3: Short identifier
      const shortId = await makeRequest('POST', '/api/auth/login', {
        identifier: 'a',
        password: 'Password@123'
      });
      assert(shortId.status === 400, 'Identifier shorter than 3 characters rejected with HTTP 400');

      // Test 4: Valid Login Succeeds
      const validLogin = await makeRequest('POST', '/api/auth/login', {
        identifier: 'admin@labguard.edu',
        password: 'Admin@123456',
        targetRole: 'ADMIN'
      });
      assert(validLogin.status === 200 && validLogin.body.success, 'Valid login payload passes validation and authenticates');
      const adminToken = validLogin.body.data.accessToken;

      // Test 5: Invalid Email Format in User Creation
      const invalidEmail = await makeRequest('POST', '/api/users', {
        email: 'not-an-email',
        fullName: 'Test User',
        role: 'STUDENT'
      }, adminToken);
      assert(invalidEmail.status === 400, 'Invalid email format rejected with HTTP 400');
      assert(invalidEmail.body.details.some(d => d.field === 'email'), 'Validation error flags email field');

      // Test 6: Missing required fields in Issue Report
      const invalidIssue = await makeRequest('POST', '/api/issues', {
        description: 'Broken monitor'
      }, adminToken);
      assert(invalidIssue.status === 400, 'Missing labCode and pcCode in issue report rejected with HTTP 400');

      // Test 7: Missing required fields in Session Start (with Student Token)
      const studentLogin = await makeRequest('POST', '/api/auth/login', {
        identifier: 'student@labguard.edu',
        password: 'Student@123456',
        targetRole: 'STUDENT'
      });
      const studentToken = studentLogin.body.data?.accessToken;

      const invalidSession = await makeRequest('POST', '/api/sessions/start', {
        pcCode: 'PC-01'
      }, studentToken);
      assert(invalidSession.status === 400, 'Missing labCode in session start rejected with HTTP 400');

      // ------------------------------------------------------------------------
      // SECTION 2: SQL Injection Defense
      // ------------------------------------------------------------------------
      console.log('\n--- SECTION 2: SQL Injection Defense ---');

      // Test 8: Classical SQL Injection ' OR 1=1 --
      const sqli1 = await makeRequest('POST', '/api/auth/login', {
        identifier: "' OR '1'='1",
        password: "password' OR '1'='1"
      });
      assert(sqli1.status === 401 || sqli1.status === 400, "SQL injection ' OR '1'='1 safely rejected without server exception");
      assert(!sqli1.body.data?.accessToken, 'SQL injection fails to bypass authentication');

      // Test 9: UNION SELECT attempt
      const sqliUnion = await makeRequest('POST', '/api/auth/login', {
        identifier: "admin' UNION SELECT * FROM users --",
        password: 'somepassword'
      });
      assert(sqliUnion.status === 401 || sqliUnion.status === 400, 'UNION SELECT attempt safely handled without data leakage');

      // Test 10: Stacked query injection ; DROP TABLE
      const sqliDrop = await makeRequest('POST', '/api/auth/login', {
        identifier: "admin'; DROP TABLE users;--",
        password: 'somepassword'
      });
      assert(sqliDrop.status === 401 || sqliDrop.status === 400, 'Stacked DROP TABLE attempt safely handled');

      // ------------------------------------------------------------------------
      // SECTION 3: Token Expiration & Cryptographic Hardening
      // ------------------------------------------------------------------------
      console.log('\n--- SECTION 3: Token Expiration & Cryptographic Hardening ---');

      // Test 11: Expired Token Rejection
      const expiredPayload = {
        id: '11111111-1111-1111-1111-111111111111',
        email: 'admin@labguard.edu',
        fullName: 'Administrator',
        role: 'ADMIN',
        iat: Math.floor(Date.now() / 1000) - 3600,
        exp: Math.floor(Date.now() / 1000) - 60 // Expired 1 minute ago
      };
      const expiredToken = jwt.sign(expiredPayload, ENV.JWT_SECRET);
      const expiredRes = await makeRequest('GET', '/api/auth/profile', null, expiredToken);
      assert(expiredRes.status === 401, 'Expired JWT token rejected with HTTP 401');
      assert(expiredRes.body.error === 'TOKEN_EXPIRED', 'Error code explicitly flags TOKEN_EXPIRED');

      // Test 12: Tampered Token Rejection
      const tamperedToken = adminToken.slice(0, -5) + 'AAAAA';
      const tamperedRes = await makeRequest('GET', '/api/auth/profile', null, tamperedToken);
      assert(tamperedRes.status === 401, 'Cryptographically tampered token rejected with HTTP 401');
      assert(tamperedRes.body.error === 'INVALID_TOKEN', 'Tampered token flags INVALID_TOKEN');

      // Test 13: Forged None-Algorithm Token Rejection
      const unsignedToken = jwt.sign({ ...expiredPayload, exp: Math.floor(Date.now() / 1000) + 3600 }, '', { algorithm: 'none' });
      const noneAlgRes = await makeRequest('GET', '/api/auth/profile', null, unsignedToken);
      assert(noneAlgRes.status === 401, 'Algorithm "none" bypass attack rejected with HTTP 401');

      // ------------------------------------------------------------------------
      // SECTION 4: Desktop Bundle Secret Hygiene Audit
      // ------------------------------------------------------------------------
      console.log('\n--- SECTION 4: Desktop Bundle Secret Hygiene Audit ---');

      const desktopSrc = path.resolve(__dirname, '../desktop/src');
      function scanDirForSecrets(dir) {
        const files = fs.readdirSync(dir);
        let leakedKeys = [];
        for (const file of files) {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            leakedKeys = leakedKeys.concat(scanDirForSecrets(fullPath));
          } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.html')) {
            const content = fs.readFileSync(fullPath, 'utf-8');
            if (content.includes('postgresql://') || content.includes('postgres://')) {
              leakedKeys.push({ file, leak: 'Database connection string' });
            }
            if (content.includes('service_role') && !content.includes('//')) {
              leakedKeys.push({ file, leak: 'Service role secret key' });
            }
          }
        }
        return leakedKeys;
      }

      const desktopLeaks = scanDirForSecrets(desktopSrc);
      assert(desktopLeaks.length === 0, 'Desktop frontend source contains 0 private database or service role secrets');

      // Verify Desktop ApiClient uses only local/institutional base path
      const apiClientContent = fs.readFileSync(path.join(desktopSrc, 'services/api.ts'), 'utf-8');
      assert(!apiClientContent.includes('secret') && !apiClientContent.includes('private_key'), 'ApiClient contains no hardcoded private credentials');

      // ------------------------------------------------------------------------
      // Summary
      // ------------------------------------------------------------------------
      console.log(`\n======================================================`);
      console.log(`PHASE 26 TESTS COMPLETE: ${passedTests}/${totalTests} PASSED`);
      console.log(`======================================================\n`);

      server.close();
      if (passedTests === totalTests) {
        process.exit(0);
      } else {
        process.exit(1);
      }
    } catch (err) {
      console.error('[SecurityTest] Unexpected test failure:', err);
      server.close();
      process.exit(1);
    }
  });
}

runTests();
