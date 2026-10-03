# LABGUARD REST & WebSocket API Specification

All backend endpoints use the prefix `/api`. Stateless authentication is established via an encrypted JWT stored in a secure **HttpOnly cookie** (`labguard_token`) or transmitted via `Authorization: Bearer <token>` for API consumers and the Windows PC Kiosk Client.

---

## 1. Authentication Endpoints

### `POST /api/auth/login`
- **Purpose:** Web portal login for Admin, Faculty, Lab Assistant, or Student.
- **Request Body:**
  ```json
  {
    "email": "faculty1@labguard.local",
    "password": "LabGuard@2025"
  }
  ```
- **Response (`200 OK`):**
  Sets `Set-Cookie: labguard_token=...; HttpOnly; SameSite=Lax; Path=/`
  ```json
  {
    "userId": "20000000-0000-0000-0000-000000000002",
    "email": "faculty1@labguard.local",
    "fullName": "Prof. Sarah Jenkins",
    "role": "FACULTY",
    "assignedLabs": ["LAB-01", "LAB-03"]
  }
  ```

### `POST /api/auth/client-authenticate`
- **Purpose:** Windows Client kiosk authentication for Student / Faculty workstation verification.
- **Request Body:**
  ```json
  {
    "labCode": "LAB-03",
    "pcCode": "PC-017",
    "identifier": "STU-2023-0101",
    "password": "LabGuard@2025",
    "role": "STUDENT"
  }
  ```
- **Response (`200 OK`):**
  ```json
  {
    "authenticated": true,
    "token": "eyJhbGciOiJIUzI1NiJ9...",
    "sessionId": "c0000000-0000-0000-0000-000000000001",
    "fullName": "Alex Rivera",
    "identifier": "STU-2023-0101",
    "department": "Computer Science & Engineering",
    "section": "CSE-A",
    "labCode": "LAB-03",
    "pcCode": "PC-017",
    "keyboardVerified": true,
    "mouseVerified": true,
    "message": "Authentication and hardware verification successful."
  }
  ```

---

## 2. Laboratory Endpoints (Strict RBAC Gated)

### `GET /api/labs`
- Returns laboratories available to requester (Admin sees all; Faculty/Assistant see assigned).

### `GET /api/labs/{labId}`
- **Security:** `@PreAuthorize("@labSecurity.hasLabAccess(authentication, #labId)")`
- Returns laboratory details and real-time metrics.
- **Error (`403 Forbidden`):** Returned if Faculty or Lab Assistant is not assigned to `labId`.

### `GET /api/labs/{labId}/who-is-in`
- **Returns:** Active student & faculty sessions in the lab with entry times.

### `GET /api/labs/{labId}/who-left`
- **Returns:** Historical exit records for today with entry, exit, and duration minutes.

---

## 3. Workstation & Device Endpoints

### `POST /api/client/register`
- Registers a physical Windows PC client with hostname, IP, MAC address, and client version.

### `POST /api/client/heartbeat`
- Transmits periodic workstation health (30s interval) and peripheral connectivity status.

---

## 4. Equipment Asset & QR Endpoints

### `GET /api/equipment`
- Lists all asset-tagged peripherals (Keyboards, Mice, Monitors).

### `GET /api/equipment/qr/{assetId}`
- Resolves asset QR data into: asset ID, type, assigned PC, assigned lab, health status, total issue count, and maintenance summary.

---

## 5. Hardware Event Monitoring

### `POST /api/hardware-events/report`
- Emits USB connect/disconnect event from Windows Client with **strictly neutral wording**:
  ```json
  {
    "labCode": "LAB-03",
    "pcCode": "PC-017",
    "slotType": "MOUSE",
    "eventType": "HARDWARE_DISCONNECTED",
    "description": "Mouse connection lost."
  }
  ```

---

## 6. Real-time WebSocket Protocol

- **Endpoint:** `ws://localhost:8080/ws/events`
- Broadcasts real-time events to connected browser dashboards:
  - `{"type":"HARDWARE_ALERT","lab":"LAB-03","pc":"PC-017","title":"Mouse connection lost","severity":"WARNING"}`
  - `{"type":"ISSUE_ALERT","lab":"LAB-03","issueCode":"ISS-1042","title":"Issue resolved"}`
  - `{"type":"SYSTEM_ALERT","lab":"LAB-02","pc":"PC-006","title":"PC-006 is offline"}`
