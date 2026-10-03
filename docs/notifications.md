# LABGUARD Notifications Subsystem

The **LabGuard Notifications** engine delivers real-time, role-scoped, and lab-scoped incident alerts across all user tiers while strictly preventing notification flooding.

---

## 1. Standardized Event Types & Severity Levels

| Severity | Event Type | Description | Target Audience |
| :--- | :--- | :--- | :--- |
| **`CRITICAL`** | `PC_OFFLINE` | Workstation heartbeat timed out (>2 min). | Admin, Lab Assistant |
| **`CRITICAL`** | `CLIENT_OFFLINE` | Physical client ungracefully terminated. | Admin, Lab Assistant |
| **`WARNING`** | `HARDWARE_DISCONNECTED` | USB peripheral disconnected (e.g. Mouse). | Admin, Lab Assistant, Faculty |
| **`WARNING`** | `HARDWARE_MISMATCH` | Unregistered device plugged into USB port. | Admin, Lab Assistant |
| **`WARNING`** | `NEW_ISSUE` | Student or staff submitted a defect ticket. | Admin, Lab Assistant, Faculty |
| **`INFO`** | `HARDWARE_CONNECTED` | Keyboard or mouse re-plugged and verified. | Admin, Lab Assistant |
| **`INFO`** | `SESSION_STARTED` | User logged into workstation. | Lab Assistant, Faculty |
| **`INFO`** | `SESSION_ENDED` | User logged out; PC released to available. | Lab Assistant, Faculty |
| **`INFO`** | `ISSUE_RESOLVED` | Technician completed peripheral replacement. | Student (reporter), Admin, Staff |

---

## 2. Role- & Lab-Scoped Dispatch Rules

Notifications strictly respect institutional assignments:
- **PC-017 in LAB-03 experiences a mouse disconnect:**
  - `assistant1` (assigned to `LAB-03`): **Receives notification.**
  - `faculty1` (supervising active class in `LAB-03`): **Receives notification.**
  - `faculty2` (assigned ONLY to `LAB-02` and `LAB-04`): **MUST NOT receive notification.**
  - `admin`: Receives alert based on system severity rules.
  - `student`: Receives alerts strictly relevant to their own active session or reported tickets.

---

## 3. Anti-Flooding & Spam Prevention

To prevent spamming staff when a loose cable rapidly disconnects/reconnects:
1. **Cooldown Window:** When a hardware event occurs, a deduplication lock (default: 15 seconds) is activated for that workstation and peripheral.
2. **Deduplication:** Subsequent disconnect/connect events within the cooldown window are suppressed from generating multiple notification rows.
3. **Event Grouping:** Multiple rapid toggles are grouped into a single ongoing incident on the timeline.
