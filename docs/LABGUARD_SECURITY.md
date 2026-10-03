# LABGUARD v2.5.0: Security & Access Control Architecture

---

## 1. Zero Trust Client Principles
- **No Client Privilege Delegation**: The desktop frontend is treated as an untrusted presentation layer. All authorization decisions are strictly evaluated server-side by the Express API.
- **No Direct Supabase Database Access**: The desktop client communicates exclusively with the Express Central API over HTTP/WebSocket. The Supabase service-role key is never bundled in desktop binaries.
- **Password Protection**: Passwords are hashed using BCrypt (cost factor 10). Plaintext credentials are never written to disk or logged.

---

## 2. Server-Side Scoping Enforcers
- **`enforceFacultyScope`**: Middleware verifying that the authenticated Faculty member has an explicit assignment in `faculty_lab_batch_assignments` or `class_faculty` before returning class rosters or laboratory telemetry.
- **`enforceLabAssistantScope`**: Middleware restricting queries strictly to laboratories listed in `user_lab_assignments` and batches listed in `lab_assistant_batch_assignments`.
- **`enforceStudentSelfScope`**: Middleware verifying that students may only view and mutate their own active session, issues, and equipment indicators.

---

## 3. Auto-Shutdown Security Enforcement
- **Student Restriction**: Automatic Windows shutdown (`request_safe_shutdown`) is strictly restricted to authenticated **`STUDENT`** sessions.
- **Staff Exemption**: Faculty, Lab Assistants, and System Administrators are strictly exempt from automatic machine power-off upon logging out.
- **Native Implementation**: Evaluated natively inside Tauri Rust using Windows Win32 API (`ExitWindowsEx` / `InitiateSystemShutdownExW`) after validating active student session sentinel.
