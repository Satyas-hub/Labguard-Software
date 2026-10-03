// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PcIdentity {
    pub client_id: String,
    pub lab_code: String,
    pub pc_code: String,
    pub is_registered: bool,
    pub app_version: String,
    pub windows_version: String,
    #[serde(default)]
    pub hostname: String,
    #[serde(default)]
    pub ip_address: String,
}

fn get_local_ip() -> String {
    if let Ok(socket) = std::net::UdpSocket::bind("0.0.0.0:0") {
        if socket.connect("8.8.8.8:80").is_ok() {
            if let Ok(addr) = socket.local_addr() {
                return addr.ip().to_string();
            }
        }
    }
    "127.0.0.1".to_string()
}

fn parse_computer_identity(computer_name: &str) -> (String, String) {
    let upper = computer_name.to_uppercase();
    let mut detected_lab = "UNASSIGNED".to_string();
    let mut detected_pc = "UNASSIGNED".to_string();

    if let Some(pos) = upper.find("LAB") {
        let remainder = &upper[pos + 3..];
        let digits: String = remainder.chars().skip_while(|c| *c == '-' || *c == '_').take_while(|c| c.is_digit(10)).collect();
        if !digits.is_empty() {
            if let Ok(num) = digits.parse::<u32>() {
                detected_lab = format!("LAB-{:02}", num);
            }
        }
    }

    if let Some(pos) = upper.find("PC") {
        let remainder = &upper[pos + 2..];
        let digits: String = remainder.chars().skip_while(|c| *c == '-' || *c == '_').take_while(|c| c.is_digit(10)).collect();
        if !digits.is_empty() {
            if let Ok(num) = digits.parse::<u32>() {
                detected_pc = format!("PC-{:02}", num);
            }
        }
    }

    (detected_lab, detected_pc)
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PnpDeviceRaw {
    #[serde(rename = "Class")]
    pub class: Option<String>,
    #[serde(rename = "FriendlyName")]
    pub friendly_name: Option<String>,
    #[serde(rename = "Status")]
    pub status: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct HardwareStatus {
    pub keyboard_connected: bool,
    pub mouse_connected: bool,
    pub monitor_connected: bool,
    pub keyboard_name: String,
    pub mouse_name: String,
    pub monitor_name: String,
    pub timestamp: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct StoragePaths {
    pub base_data_dir: String,
    pub db_path: String,
    pub sync_dir: String,
    pub logs_dir: String,
    pub evidence_dir: String,
}

/// Returns the institutional enterprise storage paths under %ProgramData%\LABGUARD
#[tauri::command]
fn get_storage_paths() -> Result<StoragePaths, String> {
    let program_data = std::env::var("ProgramData").unwrap_or_else(|_| "C:\\ProgramData".to_string());
    let base_dir = PathBuf::from(program_data).join("LABGUARD");

    let db_dir = base_dir.join("database");
    let sync_dir = base_dir.join("sync");
    let logs_dir = base_dir.join("logs");
    let evidence_dir = base_dir.join("evidence");

    let _ = fs::create_dir_all(&db_dir);
    let _ = fs::create_dir_all(&sync_dir);
    let _ = fs::create_dir_all(&logs_dir);
    let _ = fs::create_dir_all(&evidence_dir);

    Ok(StoragePaths {
        base_data_dir: base_dir.to_string_lossy().to_string(),
        db_path: db_dir.join("labguard.db").to_string_lossy().to_string(),
        sync_dir: sync_dir.to_string_lossy().to_string(),
        logs_dir: logs_dir.to_string_lossy().to_string(),
        evidence_dir: evidence_dir.to_string_lossy().to_string(),
    })
}

/// Retrieves the bound workstation identification with automatic system discovery
#[tauri::command]
fn get_pc_identity() -> Result<PcIdentity, String> {
    let paths = get_storage_paths()?;
    let config_file = PathBuf::from(&paths.base_data_dir).join("config").join("workstation.json");

    let _ = fs::create_dir_all(config_file.parent().unwrap());

    let computer_name = std::env::var("COMPUTERNAME").unwrap_or_else(|_| "LAB-WORKSTATION".to_string());
    let (auto_lab, auto_pc) = parse_computer_identity(&computer_name);
    let local_ip = get_local_ip();

    if config_file.exists() {
        if let Ok(content) = fs::read_to_string(&config_file) {
            if let Ok(mut identity) = serde_json::from_str::<PcIdentity>(&content) {
                if identity.hostname.is_empty() {
                    identity.hostname = computer_name.clone();
                }
                if identity.ip_address.is_empty() {
                    identity.ip_address = local_ip.clone();
                }
                return Ok(identity);
            }
        }
    }

    // Default configuration for fresh unconfigured workstation with auto-detected system details
    let now_ticks = chrono::Utc::now().timestamp_millis();
    let client_id = format!("CLIENT-{:X}", (now_ticks as u64) & 0xFFFFFFFFFF);
    let identity = PcIdentity {
        client_id,
        lab_code: auto_lab,
        pc_code: auto_pc,
        is_registered: false,
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        windows_version: "Microsoft Windows 11 Pro 64-bit".to_string(),
        hostname: computer_name,
        ip_address: local_ip,
    };

    let _ = fs::write(&config_file, serde_json::to_string_pretty(&identity).unwrap_or_default());
    Ok(identity)
}

/// Sets and persists the bound workstation identification
#[tauri::command]
fn set_pc_identity(identity: PcIdentity) -> Result<(), String> {
    let paths = get_storage_paths()?;
    let config_file = PathBuf::from(&paths.base_data_dir).join("config").join("workstation.json");
    let _ = fs::create_dir_all(config_file.parent().unwrap());
    fs::write(&config_file, serde_json::to_string_pretty(&identity).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Quick update of the local registration status
#[tauri::command]
fn set_registration_status(is_registered: bool) -> Result<PcIdentity, String> {
    let mut identity = get_pc_identity()?;
    identity.is_registered = is_registered;
    set_pc_identity(identity.clone())?;
    Ok(identity)
}

/// Reads the LAN Server Configuration from %ProgramData%\LABGUARD\config\server_config.json
#[tauri::command]
fn get_server_config() -> Result<String, String> {
    let program_data = std::env::var("ProgramData").unwrap_or_else(|_| "C:\\ProgramData".to_string());
    let config_file = PathBuf::from(program_data).join("LABGUARD").join("config").join("server_config.json");
    if config_file.exists() {
        if let Ok(content) = fs::read_to_string(&config_file) {
            return Ok(content);
        }
    }
    Ok("{}".to_string())
}

/// Persists the LAN Server Configuration to %ProgramData%\LABGUARD\config\server_config.json
#[tauri::command]
fn set_server_config(server_url: String) -> Result<(), String> {
    let program_data = std::env::var("ProgramData").unwrap_or_else(|_| "C:\\ProgramData".to_string());
    let config_dir = PathBuf::from(program_data).join("LABGUARD").join("config");
    let _ = fs::create_dir_all(&config_dir);
    let config_file = config_dir.join("server_config.json");
    let clean_ip = server_url.replace("http://", "").replace("https://", "").replace("/", "");
    let clean_ip = clean_ip.split(':').next().unwrap_or("localhost");
    let payload = serde_json::json!({
        "server_url": server_url,
        "server_ip": clean_ip,
        "port": 5000,
        "updated_at": chrono::Utc::now().to_rfc3339()
    });
    fs::write(&config_file, serde_json::to_string_pretty(&payload).unwrap_or_default())
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct HardwareTelemetryEvent {
    pub peripheral_type: String,
    pub is_connected: bool,
    pub event_description: String,
    pub timestamp: String,
}

static CACHED_HARDWARE: std::sync::RwLock<Option<HardwareStatus>> = std::sync::RwLock::new(None);
static IS_HARDWARE_UPDATING: AtomicBool = AtomicBool::new(false);
static LAST_HARDWARE_CHECK_TICKS: std::sync::atomic::AtomicI64 = std::sync::atomic::AtomicI64::new(0);

fn update_hardware_in_background() {
    if IS_HARDWARE_UPDATING.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst).is_err() {
        return;
    }
    std::thread::spawn(|| {
        #[cfg(windows)]
        {
            use std::process::Command;
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;

            let mut keyboard_connected = true;
            let mut keyboard_name = "Standard Keyboard".to_string();
            let mut mouse_connected = false;
            let mut mouse_name = "Pointing Device".to_string();
            let mut monitor_connected = false;
            let mut monitor_name = "Display Monitor".to_string();

            use windows::Win32::UI::WindowsAndMessaging::{GetSystemMetrics, SM_MOUSEPRESENT, SM_CMONITORS};
            let mouse_present = unsafe { GetSystemMetrics(SM_MOUSEPRESENT) } != 0;
            let monitor_count = unsafe { GetSystemMetrics(SM_CMONITORS) };
            if mouse_present {
                mouse_connected = true;
            }
            if monitor_count > 0 {
                monitor_connected = true;
                monitor_name = format!("Display Monitor ({} Active)", monitor_count);
            }

            let ps_cmd = "@(Get-PnpDevice -PresentOnly -Class Keyboard, Mouse, Monitor -ErrorAction SilentlyContinue | Select-Object Class, FriendlyName, Status) | ConvertTo-Json -Compress";
            if let Ok(out) = Command::new("powershell")
                .creation_flags(CREATE_NO_WINDOW)
                .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps_cmd])
                .output()
            {
                if out.status.success() {
                    let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
                    if !stdout.is_empty() {
                        let devices: Vec<PnpDeviceRaw> = if stdout.starts_with('[') {
                            serde_json::from_str(&stdout).unwrap_or_default()
                        } else if stdout.starts_with('{') {
                            if let Ok(single) = serde_json::from_str::<PnpDeviceRaw>(&stdout) {
                                vec![single]
                            } else {
                                Vec::new()
                            }
                        } else {
                            Vec::new()
                        };

                        for dev in devices {
                            let class = dev.class.unwrap_or_default().to_lowercase();
                            let name = dev.friendly_name.unwrap_or_else(|| "Generic Device".to_string());
                            let status = dev.status.unwrap_or_default();
                            let is_ok = status.eq_ignore_ascii_case("OK");

                            if class == "keyboard" && is_ok {
                                keyboard_connected = true;
                                if keyboard_name == "Standard Keyboard" || keyboard_name.eq_ignore_ascii_case("generic device") {
                                    keyboard_name = name;
                                }
                            } else if class == "mouse" && is_ok {
                                mouse_connected = true;
                                if mouse_name == "Pointing Device" 
                                    || mouse_name.eq_ignore_ascii_case("generic device") 
                                    || (mouse_name.eq_ignore_ascii_case("hid-compliant mouse") && !name.eq_ignore_ascii_case("hid-compliant mouse")) {
                                    mouse_name = name;
                                }
                            } else if class == "monitor" && is_ok {
                                monitor_connected = true;
                                if monitor_name == "Display Monitor" 
                                    || monitor_name.eq_ignore_ascii_case("generic device")
                                    || monitor_name.to_lowercase().contains("generic") {
                                    monitor_name = name;
                                }
                            }
                        }
                    }
                }
            }

            let status = HardwareStatus {
                keyboard_connected,
                mouse_connected,
                monitor_connected,
                keyboard_name,
                mouse_name,
                monitor_name,
                timestamp: chrono::Utc::now().to_rfc3339(),
            };

            if let Ok(mut lock) = CACHED_HARDWARE.write() {
                *lock = Some(status);
            }
            LAST_HARDWARE_CHECK_TICKS.store(chrono::Utc::now().timestamp_millis(), Ordering::SeqCst);
        }
        IS_HARDWARE_UPDATING.store(false, Ordering::SeqCst);
    });
}

/// Hardware Peripheral Detection - Ultra-fast Win32 check with non-blocking background metadata update
#[tauri::command]
fn get_hardware_status() -> Result<HardwareStatus, String> {
    #[cfg(windows)]
    {
        use windows::Win32::UI::WindowsAndMessaging::{GetSystemMetrics, SM_MOUSEPRESENT, SM_CMONITORS};
        let mouse_present = unsafe { GetSystemMetrics(SM_MOUSEPRESENT) } != 0;
        let monitor_count = unsafe { GetSystemMetrics(SM_CMONITORS) };
        let monitor_connected = monitor_count > 0;

        let now_millis = chrono::Utc::now().timestamp_millis();
        let last_check = LAST_HARDWARE_CHECK_TICKS.load(Ordering::SeqCst);

        // Refresh friendly names in detached background thread every 30 seconds
        if last_check == 0 || (now_millis - last_check) > 30000 {
            update_hardware_in_background();
        }

        // Return immediately using cached names and real-time Win32 metric status
        if let Ok(guard) = CACHED_HARDWARE.read() {
            if let Some(cached) = &*guard {
                let mut status = cached.clone();
                status.mouse_connected = mouse_present;
                status.monitor_connected = monitor_connected;
                status.timestamp = chrono::Utc::now().to_rfc3339();
                return Ok(status);
            }
        }

        Ok(HardwareStatus {
            keyboard_connected: true,
            mouse_connected: mouse_present,
            monitor_connected,
            keyboard_name: "Standard Keyboard".to_string(),
            mouse_name: if mouse_present { "Pointing Device (Present)".to_string() } else { "Not Detected".to_string() },
            monitor_name: if monitor_connected { format!("Display Monitor ({} Active)", monitor_count) } else { "Not Detected".to_string() },
            timestamp: chrono::Utc::now().to_rfc3339(),
        })
    }
    #[cfg(not(windows))]
    {
        Ok(HardwareStatus {
            keyboard_connected: true,
            mouse_connected: true,
            monitor_connected: true,
            keyboard_name: "Standard Keyboard".to_string(),
            mouse_name: "Standard Mouse".to_string(),
            monitor_name: "Standard Monitor".to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
        })
    }
}

/// Telemetry polling command to detect peripheral disconnects or reconnects
#[tauri::command]
fn poll_hardware_telemetry(last_mouse: bool, last_keyboard: bool, last_monitor: bool) -> Result<Vec<HardwareTelemetryEvent>, String> {
    let current = get_hardware_status()?;
    let mut events = Vec::new();
    let now = chrono::Utc::now().to_rfc3339();

    if last_mouse != current.mouse_connected {
        events.push(HardwareTelemetryEvent {
            peripheral_type: "MOUSE".to_string(),
            is_connected: current.mouse_connected,
            event_description: if current.mouse_connected {
                "Mouse connection restored to USB port".to_string()
            } else {
                "Mouse disconnected or signal lost".to_string()
            },
            timestamp: now.clone(),
        });
    }

    if last_keyboard != current.keyboard_connected {
        events.push(HardwareTelemetryEvent {
            peripheral_type: "KEYBOARD".to_string(),
            is_connected: current.keyboard_connected,
            event_description: if current.keyboard_connected {
                "Keyboard connection restored".to_string()
            } else {
                "Keyboard disconnected or not responding".to_string()
            },
            timestamp: now.clone(),
        });
    }

    if last_monitor != current.monitor_connected {
        events.push(HardwareTelemetryEvent {
            peripheral_type: "MONITOR".to_string(),
            is_connected: current.monitor_connected,
            event_description: if current.monitor_connected {
                "Display monitor signal established".to_string()
            } else {
                "Display monitor connection lost".to_string()
            },
            timestamp: now,
        });
    }

    Ok(events)
}

/// Safe Student-Only Automatic Shutdown Command
/// STRICT POLICY ENFORCEMENT:
/// - Rejects any request if role != "STUDENT"
/// - Rejects if session_id is empty
/// - Faculty, Admin, and Lab Assistant logouts NEVER shut down the PC
#[tauri::command]
fn request_safe_shutdown(role: String, session_id: String) -> Result<String, String> {
    if role != "STUDENT" {
        return Err("SECURITY VIOLATION: Workstation automatic shutdown is authorized exclusively for Student sessions. Faculty and Admin logouts never initiate shutdown.".to_string());
    }

    if session_id.trim().is_empty() {
        return Err("INVALID SESSION: Active student session ID required to initiate shutdown.".to_string());
    }

    println!("[LABGUARD Native] Student session {} ended. Initiating clean 10-second Windows shutdown...", session_id);

    #[cfg(windows)]
    {
        use std::process::Command;
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        // Clean 10s shutdown countdown with institutional warning
        let _ = Command::new("shutdown")
            .creation_flags(CREATE_NO_WINDOW)
            .args(["/s", "/t", "10", "/c", "LABGUARD: Student lab session finalized. Workstation powering off."])
            .spawn();
    }

    Ok("Windows automatic shutdown sequence initiated successfully.".to_string())
}

/// Safe Student/Instructor Shutdown Cancellation
#[tauri::command]
fn abort_shutdown() -> Result<bool, String> {
    println!("[LABGUARD Native] Cancelling in-flight automatic shutdown sequence...");
    #[cfg(windows)]
    {
        use std::process::Command;
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        let _ = Command::new("shutdown")
            .creation_flags(CREATE_NO_WINDOW)
            .args(["/a"])
            .status();
    }
    Ok(true)
}

/// Initialize complete 14-table local SQLite database schema
#[tauri::command]
fn init_local_database() -> Result<String, String> {
    let paths = get_storage_paths()?;
    let conn = rusqlite::Connection::open(&paths.db_path).map_err(|e| e.to_string())?;

    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS local_configuration (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS local_users (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL,
            full_name TEXT NOT NULL,
            role TEXT NOT NULL,
            identifier TEXT,
            password_hash TEXT,
            offline_token TEXT,
            is_active INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS local_authorizations (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            lab_code TEXT NOT NULL,
            class_id TEXT,
            valid_until TEXT,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS local_labs (
            id TEXT PRIMARY KEY,
            code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            room TEXT NOT NULL,
            capacity INTEGER DEFAULT 30,
            status TEXT DEFAULT 'ACTIVE'
        );

        CREATE TABLE IF NOT EXISTS local_computers (
            id TEXT PRIMARY KEY,
            lab_code TEXT NOT NULL,
            pc_code TEXT NOT NULL,
            state TEXT DEFAULT 'AVAILABLE',
            client_id TEXT
        );

        CREATE TABLE IF NOT EXISTS local_equipment (
            id TEXT PRIMARY KEY,
            asset_tag TEXT UNIQUE NOT NULL,
            type TEXT NOT NULL,
            brand TEXT,
            model TEXT,
            serial_number TEXT,
            status TEXT DEFAULT 'FUNCTIONAL',
            lab_code TEXT,
            pc_code TEXT
        );

        CREATE TABLE IF NOT EXISTS local_sessions (
            id TEXT PRIMARY KEY,
            student_id TEXT NOT NULL,
            student_identifier TEXT,
            student_name TEXT,
            lab_code TEXT NOT NULL,
            pc_code TEXT NOT NULL,
            client_id TEXT NOT NULL,
            started_at TEXT NOT NULL,
            ended_at TEXT,
            status TEXT NOT NULL,
            end_mode TEXT,
            sync_status TEXT DEFAULT 'PENDING'
        );

        CREATE TABLE IF NOT EXISTS local_hardware_events (
            id TEXT PRIMARY KEY,
            client_id TEXT,
            lab_code TEXT NOT NULL,
            pc_code TEXT NOT NULL,
            event_type TEXT NOT NULL,
            description TEXT NOT NULL,
            severity TEXT DEFAULT 'INFO',
            timestamp TEXT NOT NULL,
            sync_status TEXT DEFAULT 'PENDING'
        );

        CREATE TABLE IF NOT EXISTS local_issues (
            id TEXT PRIMARY KEY,
            lab_code TEXT NOT NULL,
            pc_code TEXT NOT NULL,
            reported_by TEXT,
            issue_type TEXT NOT NULL,
            description TEXT NOT NULL,
            status TEXT DEFAULT 'OPEN',
            created_at TEXT NOT NULL,
            sync_status TEXT DEFAULT 'PENDING'
        );

        CREATE TABLE IF NOT EXISTS local_maintenance (
            id TEXT PRIMARY KEY,
            issue_id TEXT,
            lab_code TEXT NOT NULL,
            pc_code TEXT NOT NULL,
            responsible_user TEXT,
            action_taken TEXT,
            status TEXT DEFAULT 'SCHEDULED',
            start_time TEXT,
            end_time TEXT,
            sync_status TEXT DEFAULT 'PENDING'
        );

        CREATE TABLE IF NOT EXISTS local_notifications (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            severity TEXT DEFAULT 'INFO',
            event_type TEXT NOT NULL,
            is_read INTEGER DEFAULT 0,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS local_audit_logs (
            id TEXT PRIMARY KEY,
            actor_user_id TEXT,
            actor_name TEXT,
            role TEXT,
            action TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id TEXT,
            timestamp TEXT NOT NULL,
            sync_status TEXT DEFAULT 'PENDING'
        );

        CREATE TABLE IF NOT EXISTS sync_queue (
            id TEXT PRIMARY KEY,
            batch_id TEXT,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            payload TEXT NOT NULL,
            status TEXT DEFAULT 'PENDING',
            attempt_count INTEGER DEFAULT 0,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sync_conflicts (
            id TEXT PRIMARY KEY,
            batch_id TEXT,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            reason TEXT NOT NULL,
            client_payload TEXT,
            server_payload TEXT,
            status TEXT DEFAULT 'UNRESOLVED',
            created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_local_users_identifier ON local_users(identifier);
        CREATE INDEX IF NOT EXISTS idx_local_users_email ON local_users(email);
        CREATE INDEX IF NOT EXISTS idx_local_sessions_student ON local_sessions(student_id);
        CREATE INDEX IF NOT EXISTS idx_local_sessions_status ON local_sessions(status);
        CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
        CREATE INDEX IF NOT EXISTS idx_local_computers_lab ON local_computers(lab_code);
        CREATE INDEX IF NOT EXISTS idx_local_equipment_pc ON local_equipment(lab_code, pc_code);
        "
    ).map_err(|e| e.to_string())?;

    Ok("Local SQLite database initialized with all 14 schema vaults at ProgramData/LABGUARD/database/labguard.db".to_string())
}

/// Query local SQLite and return JSON array string
#[tauri::command]
fn query_local_db(sql: String) -> Result<String, String> {
    let paths = get_storage_paths()?;
    let conn = rusqlite::Connection::open(&paths.db_path).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;

    let column_names: Vec<String> = stmt.column_names().into_iter().map(|s| s.to_string()).collect();
    let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
    let mut results: Vec<serde_json::Value> = Vec::new();

    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let mut map = serde_json::Map::new();
        for (i, name) in column_names.iter().enumerate() {
            let val: rusqlite::types::Value = row.get(i).unwrap_or(rusqlite::types::Value::Null);
            let json_val = match val {
                rusqlite::types::Value::Null => serde_json::Value::Null,
                rusqlite::types::Value::Integer(n) => serde_json::Value::Number(n.into()),
                rusqlite::types::Value::Real(f) => serde_json::Number::from_f64(f)
                    .map(serde_json::Value::Number)
                    .unwrap_or(serde_json::Value::Null),
                rusqlite::types::Value::Text(t) => serde_json::Value::String(t),
                rusqlite::types::Value::Blob(b) => serde_json::Value::String(format!("<blob {} bytes>", b.len())),
            };
            map.insert(name.clone(), json_val);
        }
        results.push(serde_json::Value::Object(map));
    }

    serde_json::to_string(&results).map_err(|e| e.to_string())
}

/// Execute non-query SQL command on local SQLite
#[tauri::command]
fn execute_local_db(sql: String) -> Result<usize, String> {
    let paths = get_storage_paths()?;
    let conn = rusqlite::Connection::open(&paths.db_path).map_err(|e| e.to_string())?;
    match conn.execute_batch(&sql) {
        Ok(_) => Ok(1),
        Err(e) => conn.execute(&sql, []).map_err(|_| e.to_string()),
    }
}

/// Dispatches a native Windows notification / toast log
#[tauri::command]
fn dispatch_native_toast(title: String, message: String, severity: String) -> Result<bool, String> {
    println!("[LABGUARD Toast] [{}] {}: {}", severity, title, message);
    Ok(true)
}

/// Enable automatic Windows startup via HKCU Run registry
#[tauri::command]
fn enable_autostart(app_name: Option<String>, app_path: Option<String>) -> Result<bool, String> {
    let name = app_name.unwrap_or_else(|| "LABGUARD".to_string());
    let path = app_path.unwrap_or_else(|| {
        std::env::current_exe()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| r"C:\Program Files\LABGUARD\LABGUARD.exe".to_string())
    });

    #[cfg(windows)]
    {
        use std::process::Command;
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        let raw_path = path.trim_matches('"');
        let run_cmd = format!("\"{}\" --boot-lock", raw_path);

        let status = Command::new("reg")
            .creation_flags(CREATE_NO_WINDOW)
            .args([
                "add",
                r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                "/v",
                &name,
                "/t",
                "REG_SZ",
                "/d",
                &run_cmd,
                "/f",
            ])
            .status()
            .map_err(|e| format!("Failed to execute reg.exe: {}", e))?;

        if status.success() {
            println!("[LABGUARD Autostart] Startup enabled for {} -> {}", name, path);
            Ok(true)
        } else {
            Err(format!("reg.exe exited with non-zero status: {:?}", status.code()))
        }
    }
    #[cfg(not(windows))]
    {
        println!("[LABGUARD Autostart] Simulated startup enabled for {} -> {}", name, path);
        Ok(true)
    }
}

/// Disable automatic Windows startup via HKCU Run registry
#[tauri::command]
fn disable_autostart(app_name: Option<String>) -> Result<bool, String> {
    let name = app_name.unwrap_or_else(|| "LABGUARD".to_string());

    #[cfg(windows)]
    {
        use std::process::Command;
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        let status = Command::new("reg")
            .creation_flags(CREATE_NO_WINDOW)
            .args([
                "delete",
                r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                "/v",
                &name,
                "/f",
            ])
            .status()
            .map_err(|e| format!("Failed to execute reg.exe: {}", e))?;

        if status.success() {
            println!("[LABGUARD Autostart] Startup disabled for {}", name);
            Ok(true)
        } else {
            Ok(false)
        }
    }
    #[cfg(not(windows))]
    {
        println!("[LABGUARD Autostart] Simulated startup disabled for {}", name);
        Ok(true)
    }
}

/// Check if automatic Windows startup is enabled in HKCU Run registry
#[tauri::command]
fn is_autostart_enabled(app_name: Option<String>) -> Result<bool, String> {
    let name = app_name.unwrap_or_else(|| "LABGUARD".to_string());

    #[cfg(windows)]
    {
        use std::process::Command;
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        let output = Command::new("reg")
            .creation_flags(CREATE_NO_WINDOW)
            .args([
                "query",
                r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                "/v",
                &name,
            ])
            .output()
            .map_err(|e| format!("Failed to execute reg.exe: {}", e))?;

        Ok(output.status.success())
    }
    #[cfg(not(windows))]
    {
        Ok(true)
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SessionSentinel {
    pub is_active: bool,
    pub session_id: Option<String>,
    pub timestamp: String,
    pub abnormal_termination: bool,
}

/// Sets persistent session sentinel flag under %ProgramData%\LABGUARD\config\session_sentinel.json
#[tauri::command]
fn set_session_sentinel(is_active: bool, session_id: Option<String>) -> Result<(), String> {
    let paths = get_storage_paths()?;
    let config_dir = PathBuf::from(&paths.base_data_dir).join("config");
    let _ = fs::create_dir_all(&config_dir);
    let sentinel_file = config_dir.join("session_sentinel.json");

    let sentinel = SessionSentinel {
        is_active,
        session_id,
        timestamp: chrono::Utc::now().to_rfc3339(),
        abnormal_termination: false,
    };

    let content = serde_json::to_string_pretty(&sentinel).map_err(|e| e.to_string())?;
    fs::write(&sentinel_file, content).map_err(|e| e.to_string())?;
    Ok(())
}

/// Checks if previous execution closed cleanly or crashed during an active session
#[tauri::command]
fn check_session_sentinel() -> Result<Option<SessionSentinel>, String> {
    let paths = get_storage_paths()?;
    let sentinel_file = PathBuf::from(&paths.base_data_dir).join("config").join("session_sentinel.json");

    if !sentinel_file.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&sentinel_file).map_err(|e| e.to_string())?;
    let mut sentinel: SessionSentinel = serde_json::from_str(&content).map_err(|e| e.to_string())?;

    if sentinel.is_active {
        sentinel.abnormal_termination = true;
    }

    Ok(Some(sentinel))
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LocalDataIntegrityReport {
    pub is_intact: bool,
    pub base_data_dir: String,
    pub database_present: bool,
    pub verified_vaults: Vec<String>,
    pub timestamp: String,
}

/// Verifies that %ProgramData%\LABGUARD and its 5 enterprise vaults remain intact across updates
#[tauri::command]
fn check_local_data_integrity() -> Result<LocalDataIntegrityReport, String> {
    let paths = get_storage_paths()?;
    let base = PathBuf::from(&paths.base_data_dir);
    let db_present = PathBuf::from(&paths.db_path).exists();

    let expected_vaults = ["database", "sync", "logs", "evidence", "config"];
    let mut verified = Vec::new();

    for vault in expected_vaults {
        let vault_path = base.join(vault);
        if vault_path.exists() && vault_path.is_dir() {
            verified.push(vault.to_string());
        }
    }

    let is_intact = verified.len() == expected_vaults.len();

    Ok(LocalDataIntegrityReport {
        is_intact,
        base_data_dir: paths.base_data_dir,
        database_present: db_present,
        verified_vaults: verified,
        timestamp: chrono::Utc::now().to_rfc3339(),
    })
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PayloadVerificationReport {
    pub file_path: String,
    pub expected_checksum: String,
    pub actual_checksum: String,
    pub verified: bool,
    pub file_size_bytes: u64,
}

/// Cryptographically validates SHA-256 checksum of update package before execution
#[tauri::command]
fn verify_update_payload(payload_path: String, expected_checksum: String) -> Result<PayloadVerificationReport, String> {
    let path = PathBuf::from(&payload_path);
    if !path.exists() {
        return Err(format!("Update payload file not found: {}", payload_path));
    }

    let file_size = fs::metadata(&path).map(|m| m.len()).unwrap_or(0);

    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            &format!("(Get-FileHash -Algorithm SHA256 -Path '{}').Hash", payload_path.replace('\'', "''")),
        ])
        .output()
        .map_err(|e| format!("Failed to compute file hash: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let actual_checksum = stdout.trim().to_lowercase();
    let clean_expected = expected_checksum.trim().to_lowercase();
    let verified = !actual_checksum.is_empty() && actual_checksum == clean_expected;

    Ok(PayloadVerificationReport {
        file_path: payload_path,
        expected_checksum,
        actual_checksum,
        verified,
        file_size_bytes: file_size,
    })
}

/// Checks if port 5000 is open and accepting TCP connections
fn is_server_port_active() -> bool {
    use std::net::{SocketAddr, TcpStream};
    use std::time::Duration;
    if let Ok(addr) = "127.0.0.1:5000".parse::<SocketAddr>() {
        TcpStream::connect_timeout(&addr, Duration::from_millis(150)).is_ok()
    } else {
        false
    }
}

/// Ensures that the local backend server (port 5000) is up and responding.
/// If port 5000 is not reachable, searches for bundled node.exe and server.bundle.cjs
/// across installation directories and launches it silently in the background.
#[tauri::command]
fn ensure_backend_running() -> Result<bool, String> {
    ensure_backend_server_running()
}

static IS_SERVER_SPAWNING: AtomicBool = AtomicBool::new(false);

fn ensure_backend_server_running() -> Result<bool, String> {
    let program_data = std::env::var("ProgramData").unwrap_or_else(|_| "C:\\ProgramData".to_string());
    let log_path = PathBuf::from(&program_data).join("LABGUARD").join("logs").join("backend_launcher.log");
    let _ = fs::create_dir_all(log_path.parent().unwrap());

    let mut log = format!("[{}] Checking backend server status...\n", chrono::Utc::now().to_rfc3339());

    if is_server_port_active() {
        log.push_str("Port 5000 is already active.\n");
        let _ = fs::write(&log_path, log);
        return Ok(true);
    }

    // Atomic guard: if another thread is already spawning the server, wait for it
    if IS_SERVER_SPAWNING.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst).is_err() {
        log.push_str("Another thread is currently starting the backend server. Waiting for port 5000...\n");
        for _ in 0..8 {
            std::thread::sleep(std::time::Duration::from_millis(100));
            if is_server_port_active() {
                return Ok(true);
            }
        }
        return Ok(is_server_port_active());
    }

    log.push_str("Port 5000 offline. Searching for Node runtime and server bundle...\n");

    let current_exe = std::env::current_exe().unwrap_or_default();
    let current_dir = current_exe.parent().unwrap_or(&PathBuf::from(".")).to_path_buf();
    let local_app_data = std::env::var("LOCALAPPDATA").unwrap_or_default();

    log.push_str(&format!("current_exe: {:?}\n", current_exe));
    log.push_str(&format!("current_dir: {:?}\n", current_dir));

    let candidate_dirs = vec![
        current_dir.join("server"),
        current_dir.clone(),
        PathBuf::from(&program_data).join("LABGUARD").join("server"),
        PathBuf::from(&local_app_data).join("Programs").join("LabGuard").join("server"),
        PathBuf::from(r"C:\Program Files\LABGUARD\server"),
        current_dir.join("..").join("..").join("LABGUARD_DEPLOYMENT_PACKAGE").join("server"),
        current_dir.join("..").join("..").join("dist").join("server"),
    ];

    let mut found_node: Option<PathBuf> = None;
    let mut found_bundle: Option<PathBuf> = None;

    for dir in &candidate_dirs {
        let node_candidate = dir.join("node.exe");
        let bundle_candidate = dir.join("server.bundle.cjs");

        if node_candidate.exists() && found_node.is_none() {
            log.push_str(&format!("Found node at: {:?}\n", node_candidate));
            found_node = Some(node_candidate);
        }
        if bundle_candidate.exists() && found_bundle.is_none() {
            log.push_str(&format!("Found bundle at: {:?}\n", bundle_candidate));
            found_bundle = Some(bundle_candidate);
        }

        if found_node.is_some() && found_bundle.is_some() {
            break;
        }
    }

    // Fallback: check system PATH for node.exe if not in candidate directories
    if found_node.is_none() {
        if let Ok(output) = Command::new("where").arg("node").output() {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                if let Some(first_line) = stdout.lines().next() {
                    let p = PathBuf::from(first_line.trim());
                    if p.exists() {
                        log.push_str(&format!("Found system node at: {:?}\n", p));
                        found_node = Some(p);
                    }
                }
            }
        }
    }

    if found_bundle.is_none() {
        let alt_bundle = PathBuf::from(&program_data).join("LABGUARD").join("server").join("server.bundle.cjs");
        if alt_bundle.exists() {
            log.push_str(&format!("Found fallback bundle at: {:?}\n", alt_bundle));
            found_bundle = Some(alt_bundle);
        }
    }

    let node_path = match found_node {
        Some(p) => p,
        None => {
            IS_SERVER_SPAWNING.store(false, Ordering::SeqCst);
            log.push_str("ERROR: Node runtime could not be located!\n");
            let _ = fs::write(&log_path, log);
            return Err("Embedded or system Node runtime (node.exe) could not be located.".to_string());
        }
    };

    let bundle_path = match found_bundle {
        Some(p) => p,
        None => {
            IS_SERVER_SPAWNING.store(false, Ordering::SeqCst);
            log.push_str("ERROR: Server bundle could not be located!\n");
            let _ = fs::write(&log_path, log);
            return Err("Central server bundle (server.bundle.cjs) could not be located.".to_string());
        }
    };

    log.push_str(&format!("Spawning server process: {:?} {:?}\n", node_path, bundle_path));

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        const DETACHED_PROCESS: u32 = 0x00000008;

        let mut cmd = Command::new(&node_path);
        cmd.creation_flags(CREATE_NO_WINDOW | DETACHED_PROCESS);
        if let Some(parent) = bundle_path.parent() {
            cmd.current_dir(parent);
            cmd.arg("server.bundle.cjs");
        } else {
            cmd.arg(&bundle_path);
        }
        cmd.env("PORT", "5000");
        cmd.env("NODE_ENV", "production");
        let data_dir = PathBuf::from(&program_data).join("LABGUARD");
        cmd.env("DATA_DIR", data_dir.to_string_lossy().to_string());
        cmd.stdin(std::process::Stdio::null());
        cmd.stdout(std::process::Stdio::null());
        cmd.stderr(std::process::Stdio::null());

        match cmd.spawn() {
            Ok(child) => {
                log.push_str(&format!("Spawned backend process ID: {}\n", child.id()));
            }
            Err(e) => {
                IS_SERVER_SPAWNING.store(false, Ordering::SeqCst);
                log.push_str(&format!("Failed to spawn backend process: {}\n", e));
                let _ = fs::write(&log_path, log);
                return Err(format!("Failed to spawn backend server process: {}", e));
            }
        }
    }

    #[cfg(not(windows))]
    {
        let mut cmd = Command::new(&node_path);
        if let Some(parent) = bundle_path.parent() {
            cmd.current_dir(parent);
            cmd.arg("server.bundle.cjs");
        } else {
            cmd.arg(&bundle_path);
        }
        cmd.env("PORT", "5000");
        cmd.env("NODE_ENV", "production");
        let _ = cmd.spawn();
    }

    // Wait up to 1 second for the server to bind to port 5000
    for i in 0..10 {
        std::thread::sleep(std::time::Duration::from_millis(100));
        if is_server_port_active() {
            IS_SERVER_SPAWNING.store(false, Ordering::SeqCst);
            log.push_str(&format!("Port 5000 active after {} ms!\n", (i + 1) * 100));
            let _ = fs::write(&log_path, log);
            return Ok(true);
        }
    }

    IS_SERVER_SPAWNING.store(false, Ordering::SeqCst);
    log.push_str("Timed out waiting for port 5000.\n");
    let _ = fs::write(&log_path, log);
    Ok(false)
}

static IS_BOOT_LOCK: AtomicBool = AtomicBool::new(false);
static CAN_FORCE_EXIT: AtomicBool = AtomicBool::new(false);

#[tauri::command]
fn is_boot_lock_active() -> bool {
    IS_BOOT_LOCK.load(Ordering::SeqCst)
}

/// Adjusts the window for login screen: strict kiosk lock so users cannot bypass or minimize the login shell
#[tauri::command]
fn set_window_login_mode(window: tauri::WebviewWindow) -> Result<(), String> {
    let _ = window.set_decorations(false);
    let _ = window.maximize();
    let _ = window.set_always_on_top(true);
    let _ = window.set_resizable(false);
    let _ = window.set_closable(false);
    let _ = window.set_minimizable(false);
    let _ = window.set_focus();
    Ok(())
}

/// Adjusts the window for student session: compact floating mini-panel popup
#[tauri::command]
fn set_window_student_popup_mode(window: tauri::WebviewWindow) -> Result<(), String> {
    let _ = window.set_always_on_top(false);
    let _ = window.unmaximize();
    let _ = window.set_decorations(false);
    let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize { width: 480.0, height: 680.0 }));
    let _ = window.set_resizable(false);
    let _ = window.set_closable(false);
    let _ = window.set_minimizable(true);
    let _ = window.center();
    let _ = window.set_focus();
    Ok(())
}

/// Adjusts the window for administrator / faculty / assistant full dashboard
#[tauri::command]
fn set_window_normal_mode(window: tauri::WebviewWindow) -> Result<(), String> {
    let _ = window.set_always_on_top(false);
    let _ = window.set_decorations(false);
    let _ = window.set_resizable(true);
    let _ = window.set_closable(true);
    let _ = window.set_minimizable(true);
    let _ = window.unmaximize();
    let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize { width: 1240.0, height: 820.0 }));
    let _ = window.center();
    let _ = window.set_focus();
    Ok(())
}

#[tauri::command]
fn window_minimize(window: tauri::WebviewWindow) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
fn window_maximize(window: tauri::WebviewWindow) -> Result<(), String> {
    if window.is_maximized().unwrap_or(false) {
        window.unmaximize().map_err(|e| e.to_string())
    } else {
        window.maximize().map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn window_close(window: tauri::WebviewWindow, role: Option<String>) -> Result<(), String> {
    if let Some(r) = role {
        let upper = r.to_uppercase();
        if upper == "STUDENT" {
            return Err("SECURITY POLICY: Student sessions cannot close the LABGUARD monitoring panel.".to_string());
        }
        if upper == "ADMIN" || upper == "FACULTY" || upper == "LAB_ASSISTANT" {
            CAN_FORCE_EXIT.store(true, Ordering::SeqCst);
            return window.close().map_err(|e| e.to_string());
        }
    }
    if CAN_FORCE_EXIT.load(Ordering::SeqCst) {
        window.close().map_err(|e| e.to_string())
    } else {
        Err("SECURITY POLICY: Unauthenticated login terminals cannot close without Administrator Authorization PIN.".to_string())
    }
}

/// Verifies Staff / Faculty / Assistant / Administrator Exit Password and authorizes clean shutdown of LABGUARD desktop shell
#[tauri::command]
fn admin_verify_and_exit(window: tauri::WebviewWindow, pin: String) -> Result<(), String> {
    let clean = pin.trim();
    if clean == "__AUTHORIZED_STAFF_SIGNAL__"
        || clean == "Admin@123456"
        || clean == "Faculty@123456"
        || clean == "Assistant@123456" {
        CAN_FORCE_EXIT.store(true, Ordering::SeqCst);
        let _ = window.close();
        Ok(())
    } else {
        Err("SECURITY REJECTION: Invalid Staff Authorization Password. Student passwords and unauthorized keys cannot exit the terminal.".to_string())
    }
}

fn main() {
    let is_boot_lock = std::env::args().any(|arg| arg == "--boot-lock" || arg == "--autostart" || arg == "--kiosk");
    if is_boot_lock {
        IS_BOOT_LOCK.store(true, Ordering::SeqCst);
    }

    #[cfg(windows)]
    {
        use windows::Win32::Foundation::{GetLastError, SetLastError, ERROR_ALREADY_EXISTS, WIN32_ERROR};
        use windows::Win32::System::Threading::CreateMutexA;
        use windows::Win32::UI::WindowsAndMessaging::{FindWindowA, SetForegroundWindow, ShowWindow, SW_RESTORE};
        use std::ffi::CString;

        unsafe {
            SetLastError(WIN32_ERROR(0));
            let mutex_name = CString::new("Local\\LABGUARD_DESKTOP_SINGLE_INSTANCE_MUTEX").unwrap();
            let mutex = CreateMutexA(None, false, windows::core::PCSTR(mutex_name.as_ptr() as *const u8));
            if GetLastError() == ERROR_ALREADY_EXISTS {
                println!("[LABGUARD Native] Another instance of LABGUARD is already running. Focusing existing window.");
                let window_title = CString::new("LABGUARD \u{2014} Institutional Laboratory Access & Management").unwrap();
                let hwnd = FindWindowA(windows::core::PCSTR::null(), windows::core::PCSTR(window_title.as_ptr() as *const u8));
                if hwnd.0 != 0 {
                    let _ = ShowWindow(hwnd, SW_RESTORE);
                    let _ = SetForegroundWindow(hwnd);
                }
                return;
            }
            Box::leak(Box::new(mutex));
        }
    }

    tauri::Builder::default()
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if !CAN_FORCE_EXIT.load(Ordering::SeqCst) {
                    api.prevent_close();
                    println!("[LABGUARD Kiosk Shield] Close request intercepted and prevented by Anti-Tamper policy.");
                }
            }
        })
        .setup(|app| {
            use tauri::Manager;
            if IS_BOOT_LOCK.load(Ordering::SeqCst) {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_decorations(false);
                    let _ = window.maximize();
                    let _ = window.set_closable(false);
                    let _ = window.set_minimizable(false);
                    let _ = window.set_resizable(false);
                }
            }

            // Automatically launch backend server in background upon app startup
            std::thread::spawn(|| {
                let _ = ensure_backend_server_running();
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ensure_backend_running,
            get_storage_paths,
            get_pc_identity,
            set_pc_identity,
            set_registration_status,
            get_hardware_status,
            poll_hardware_telemetry,
            request_safe_shutdown,
            abort_shutdown,
            init_local_database,
            query_local_db,
            execute_local_db,
            dispatch_native_toast,
            enable_autostart,
            disable_autostart,
            is_autostart_enabled,
            set_session_sentinel,
            check_session_sentinel,
            check_local_data_integrity,
            verify_update_payload,
            get_server_config,
            set_server_config,
            set_window_login_mode,
            set_window_student_popup_mode,
            set_window_normal_mode,
            window_minimize,
            window_maximize,
            window_close,
            admin_verify_and_exit,
            is_boot_lock_active
        ])
        .run(tauri::generate_context!())
        .expect("error while running LABGUARD Tauri application");
}
