# LABGUARD Role-Based Access Control (RBAC) & Security Specification

LABGUARD implements strict, multi-layered institutional access control. Authorization is enforced directly at the **Spring Security API layer** and the **database query layer**—never relying solely on frontend route masking.

---

## 1. The Four Application Roles

There are **EXACTLY FOUR** roles supported in the system:
1. `ADMIN`
2. `FACULTY`
3. `LAB_ASSISTANT`
4. `STUDENT`

> [!CAUTION]
> **No Super Admin:** The system architecture forbids a `SUPER_ADMIN` role. `ADMIN` is the highest-level authority in the institution.

---

## 2. Permission Matrix

| Capability / API Scope | ADMIN | FACULTY | LAB_ASSISTANT | STUDENT |
| :--- | :---: | :---: | :---: | :---: |
| View All 7 Laboratories | ✅ | ❌ | ❌ | ❌ |
| View Assigned Laboratories | ✅ | ✅ | ✅ | ❌ |
| Access Unassigned Labs | ✅ | ❌ (403) | ❌ (403) | ❌ (403) |
| Manage User Accounts | ✅ | ❌ | ❌ | ❌ |
| Assign Staff to Labs (`user_lab_assignments`) | ✅ | ❌ | ❌ | ❌ |
| Start / End Class Sessions | ✅ | ✅ (Own Class) | ❌ | ❌ |
| View "Who Is In" & "Who Left" | ✅ | ✅ (Assigned) | ✅ (Assigned) | ❌ |
| Monitor Hardware Events | ✅ | ✅ (Assigned) | ✅ (Assigned) | ❌ |
| Report Workstation Issue | ✅ | ✅ | ✅ | ✅ (Own PC) |
| Verify Issue & Request Maintenance | ✅ | ✅ (Assigned) | ✅ (Assigned) | ❌ |
| View Own Active Session & History | ✅ | ✅ | ✅ | ✅ |
| View Other Students' Private Data | ✅ | ❌ | ❌ | ❌ |
| System Settings & Audit Logs | ✅ | ❌ | ❌ | ❌ |

---

## 3. Server-Side Enforcement: `LabSecurityEvaluator`

Every laboratory-scoped request is validated by the Spring Security component `LabSecurityEvaluator`:

```java
@PreAuthorize("@labSecurity.hasLabAccess(authentication, #labId)")
@GetMapping("/{labId}")
public ResponseEntity<LabSummaryDto> getLabDetail(@PathVariable UUID labId) { ... }
```

### Execution Flow for Faculty or Lab Assistant:
1. Extracts JWT identity from the secure HttpOnly cookie.
2. If role is `ADMIN`, returns `true`.
3. If role is `FACULTY` or `LAB_ASSISTANT`:
   - Queries `user_lab_assignments` where `user_id = :userId` AND `lab_id = :labId` AND `status = 'ACTIVE'`.
   - If not found, immediately terminates request with `403 FORBIDDEN` and logs the security violation attempt to `audit_logs`.

---

## 4. Zero LocalStorage Credentials Policy

- Access tokens and passwords are **never** stored in browser `localStorage` or `sessionStorage` (which are vulnerable to Cross-Site Scripting / XSS).
- The web application relies exclusively on secure, `HttpOnly`, `SameSite=Lax` cookies issued by `/api/auth/login`.
- The Windows PC Client communicates over TLS with session tokens stored strictly in process memory.
