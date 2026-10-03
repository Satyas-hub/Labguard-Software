# LABGUARD Windows PC Client Documentation

> **Technology Stack:** C#, .NET 8, Windows Presentation Foundation (WPF), WMI, Win32 Device Notification Hooks.

The **LabGuard Client** is an institutional workstation application designed to run on physical laboratory PCs. It ensures continuous equipment accountability, managed access control, and user session monitoring without relying on trivial browser fullscreen tricks.

---

## 1. Startup & Execution Lifecycle

```
[ PC Power On / Boot ]
         │
         ▼
[ Windows Starts ]
         │
         ▼
[ LabGuard Client Starts Automatically ]
         │
         ▼
[ Read local configuration: LAB_ID + PC_ID + SERVER_URL ]
         │
         ▼
[ Connect to Server & Send Initial Heartbeat ]
         │
         ▼
[ Display Kiosk Verification Screen: "Who are you?" ]
   ├── [ STUDENT ACCESS ]  ──► Enter Student ID + Password
   └── [ FACULTY ACCESS ]  ──► Enter Employee ID + Password
         │
         ▼
[ Server Authenticates & Verifies Lab Assignment ]
         │
         ▼
[ Peripheral Health Check: Keyboard: VERIFIED • Mouse: VERIFIED ]
         │
         ▼
[ User clicks START LAB SESSION ]
         │
         ▼
[ Desktop Unlocks for Normal Educational Use ]
[ Persistent Floating Top Bar: User Name • Timer • Report Issue • End Session ]
         │
         ▼
[ Logout / End Session ]
         │
         ▼
[ System Relocks Workstation to LabGuard Verification State ]
```

---

## 2. Supported Hardware Monitoring

The client monitors USB devices using Windows Management Instrumentation (WMI) and the Win32 `WM_DEVICECHANGE` message:
- Watches `Win32_PnPEntity` class insertion and removal events.
- Validates keyboard and mouse devices upon startup and continually in the background.
- **Strict Neutral Wording:** Disconnections are transmitted as:
  - `"Mouse connection lost."`
  - `"Keyboard connection lost."`
  - Never accuses the student of physical damage or misconduct.

---

## 3. IT Administrative Maintenance Bypass

To prevent locking out authorized laboratory administrators, technicians, or recovery operations:
1. Click the **Admin** button (padlock icon) in the top-right header.
2. Enter the institution's configured `MaintenancePasscode` (configured in `appsettings.json`, default: `ITAdmin@9921`).
3. An administrative prompt allows:
   - **Exit to Windows Desktop** (terminates kiosk).
   - **Switch to Windowed Mode** (keeps monitoring active while accessing system utilities).
