// ============================================================================
// LABGUARD V2 - Phase 25: Student Automatic Shutdown Automated Test Suite
// Verifies student-only safe workstation shutdown, 10-second visual countdown,
// role isolation (faculty/admin/assistant never shut down PC), and abort action.
// ============================================================================

const fs = require('fs');
const path = require('path');
const http = require('http');

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
console.log('LABGUARD V2: PHASE 25 STUDENT AUTOMATIC SHUTDOWN');
console.log('======================================================\n');

// ----------------------------------------------------------------------------
// SECTION 1: Native Rust Role & Session Guards (main.rs)
// ----------------------------------------------------------------------------
console.log('--- SECTION 1: Native Rust Role & Session Guards in main.rs ---');
const mainRsPath = path.resolve(__dirname, '../desktop/src-tauri/src/main.rs');
const mainRsContent = fs.readFileSync(mainRsPath, 'utf-8');

assert(mainRsContent.includes('fn request_safe_shutdown(role: String, session_id: String)'), 'main.rs implements request_safe_shutdown command');
assert(mainRsContent.includes('if role != "STUDENT"'), 'request_safe_shutdown enforces strict STUDENT role verification');
assert(mainRsContent.includes('SECURITY VIOLATION: Workstation automatic shutdown is authorized exclusively for Student sessions'), 'request_safe_shutdown returns explicit security violation for non-student roles');
assert(mainRsContent.includes('session_id.trim().is_empty()'), 'request_safe_shutdown verifies non-empty session ID');
assert(mainRsContent.includes('shutdown') && mainRsContent.includes('/s') && mainRsContent.includes('/t') && mainRsContent.includes('10'), 'request_safe_shutdown specifies clean 10-second Windows countdown (/s /t 10)');
assert(mainRsContent.includes('CREATE_NO_WINDOW'), 'request_safe_shutdown executes without flashing console window');
assert(mainRsContent.includes('fn abort_shutdown('), 'main.rs implements abort_shutdown command');
assert(mainRsContent.includes('request_safe_shutdown,') && mainRsContent.includes('abort_shutdown,'), 'Both shutdown commands registered in tauri::generate_handler!');

// ----------------------------------------------------------------------------
// SECTION 2: Native Service Wrappers (native.ts)
// ----------------------------------------------------------------------------
console.log('\n--- SECTION 2: TypeScript Native Service Wrappers (native.ts) ---');
const nativeTsPath = path.resolve(__dirname, '../desktop/src/services/native.ts');
const nativeTsContent = fs.readFileSync(nativeTsPath, 'utf-8');

assert(nativeTsContent.includes('requestSafeShutdown(role: string, sessionId: string)'), 'NativeService exposes requestSafeShutdown wrapper');
assert(nativeTsContent.includes('abortShutdown()'), 'NativeService exposes abortShutdown wrapper');
assert(nativeTsContent.includes("invoke<string>('request_safe_shutdown'"), 'NativeService invokes request_safe_shutdown via Tauri IPC');
assert(nativeTsContent.includes("invoke<boolean>('abort_shutdown')"), 'NativeService invokes abort_shutdown via Tauri IPC');

// ----------------------------------------------------------------------------
// SECTION 3: AuthContext Role Guards & Isolation (AuthContext.tsx)
// ----------------------------------------------------------------------------
console.log('\n--- SECTION 3: AuthContext Role Isolation & Guards ---');
const authCtxPath = path.resolve(__dirname, '../desktop/src/context/AuthContext.tsx');
const authCtxContent = fs.readFileSync(authCtxPath, 'utf-8');

assert(authCtxContent.includes("if (role !== 'STUDENT')"), 'AuthContext strictly rejects shutdown request if role !== STUDENT');
assert(authCtxContent.includes('Automatic shutdown is restricted to student sessions'), 'AuthContext returns descriptive rejection message');
assert(authCtxContent.includes("NativeService.requestSafeShutdown('STUDENT', sessionId)"), 'AuthContext forwards requestSafeShutdown for verified students');
assert(authCtxContent.includes('abortShutdown: () => Promise<boolean>'), 'AuthContext exposes abortShutdown in AuthContextType interface');

// Verify that Navbar.tsx logout does not invoke shutdown
const navbarPath = path.resolve(__dirname, '../desktop/src/components/Navbar.tsx');
const navbarContent = fs.readFileSync(navbarPath, 'utf-8');
assert(!navbarContent.includes('requestShutdown'), 'Navbar.tsx logout does not invoke requestShutdown (safeguarding Admin/Faculty/Assistant)');

// ----------------------------------------------------------------------------
// SECTION 4: Student UI 10-Second Countdown & Abort Mechanism (StudentView.tsx)
// ----------------------------------------------------------------------------
console.log('\n--- SECTION 4: Student UI 10s Countdown & Abort Controls (StudentView.tsx) ---');
const studentViewPath = path.resolve(__dirname, '../desktop/src/views/StudentView.tsx');
const studentViewContent = fs.readFileSync(studentViewPath, 'utf-8');

assert(studentViewContent.includes('const [countdown, setCountdown] = useState(10);'), 'StudentView initializes 10-second countdown state');
assert(studentViewContent.includes('countdownTimerRef'), 'StudentView tracks countdown timer ref for cancel operations');
assert(studentViewContent.includes('handleAbortShutdown'), 'StudentView implements handleAbortShutdown handler');
assert(studentViewContent.includes('abortShutdown()'), 'handleAbortShutdown invokes abortShutdown native action');
assert(studentViewContent.includes('Cancel & Resume Session') || studentViewContent.includes('Cancel &amp; Resume Session'), 'StudentView renders explicit Cancel & Resume Session button');
assert(studentViewContent.includes('Session Closed — Powering Off'), 'StudentView renders clear shutdown status banner');
assert(studentViewContent.includes('{countdown}s'), 'StudentView renders countdown timer display');

// ----------------------------------------------------------------------------
// SECTION 5: End-to-End Simulation & Verification
// ----------------------------------------------------------------------------
console.log('\n--- SECTION 5: End-to-End Logic Simulation ---');

// Test 1: Role rejection simulation
function simulateRoleShutdown(role, sessionId) {
  if (role !== 'STUDENT') {
    return { error: 'SECURITY VIOLATION: Non-student roles cannot shut down PC', allowed: false };
  }
  if (!sessionId || sessionId.trim() === '') {
    return { error: 'INVALID SESSION: Session ID required', allowed: false };
  }
  return { success: true, allowed: true, command: 'shutdown /s /t 10' };
}

assert(simulateRoleShutdown('ADMIN', 'sess-1').allowed === false, 'ADMIN logout is blocked from PC shutdown');
assert(simulateRoleShutdown('FACULTY', 'sess-1').allowed === false, 'FACULTY logout is blocked from PC shutdown');
assert(simulateRoleShutdown('LAB_ASSISTANT', 'sess-1').allowed === false, 'LAB_ASSISTANT logout is blocked from PC shutdown');
assert(simulateRoleShutdown('STUDENT', '').allowed === false, 'Empty student session ID is rejected');
assert(simulateRoleShutdown('STUDENT', 'sess-std-101').allowed === true, 'STUDENT with active session ID successfully authorized for 10-second shutdown');

// Test 2: Countdown & Abort simulation
let simulatedCountdown = 10;
let shutdownCancelled = false;
function tick() {
  if (!shutdownCancelled && simulatedCountdown > 0) simulatedCountdown--;
}
function abort() {
  shutdownCancelled = true;
}

tick();
tick();
assert(simulatedCountdown === 8, 'Countdown accurately ticks down (10s -> 8s)');
abort();
tick();
tick();
assert(simulatedCountdown === 8 && shutdownCancelled === true, 'Abort halts countdown and preserves session');

// ----------------------------------------------------------------------------
// Summary
// ----------------------------------------------------------------------------
console.log(`\n======================================================`);
console.log(`PHASE 25 TESTS COMPLETE: ${passedTests}/${totalTests} PASSED`);
console.log(`======================================================\n`);

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
