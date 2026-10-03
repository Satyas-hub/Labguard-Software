# LABGUARD Troubleshooting & Diagnostics Guide

---

## 1. Common Diagnostics

### Issue: Windows Client displays "Server Unreachable (Retrying...)"
- **Cause:** Network connection dropped or `ServerUrl` in `appsettings.json` is incorrect.
- **Resolution:**
  1. Click **🔒 Admin** in the client header and enter `ITAdmin@9921` to switch to windowed mode.
  2. Open command prompt and ping your backend server: `ping api.yourinstitution.edu`.
  3. Verify port 8080/443 is accessible and firewalls permit outbound TCP traffic.
  4. Ensure `appsettings.json` specifies the correct protocol (`http://` or `https://`).

### Issue: Faculty receives 403 Forbidden when opening a laboratory
- **Cause:** Institutional lab assignment is missing for this faculty member.
- **Resolution:**
  1. Log in as an Administrator (`admin@labguard.local`).
  2. Navigate to **Staff Assignments** tab.
  3. Locate the Faculty member and verify whether a row exists in `user_lab_assignments` for that target laboratory with `status = 'ACTIVE'`.
  4. Assign the faculty member to the required lab.

### Issue: USB Disconnect generated an alert, but the mouse was just moved to a different port
- **Cause:** USB re-enumeration triggers an insertion/removal event.
- **Resolution:**
  1. The LabGuard client automatically transmits an update event: `"Mouse connected and verified."`
  2. The notification deduplication engine suppresses spamming if re-inserted within 15 seconds.
  3. The neutral wording policy ensures no physical damage ticket is automatically generated.

### Issue: IT Administrator locked out of Windows Kiosk
- **Cause:** Forgotten maintenance passcode.
- **Resolution:**
  1. From an administrative workstation, query the database or check the local `appsettings.json` file in `C:\Program Files\LabGuard\appsettings.json`.
  2. Update the `MaintenancePasscode` value and restart the service. Default is `ITAdmin@9921`.
