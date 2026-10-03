use std::env;
use std::fs;
use std::io::{self, Write};
use std::path::PathBuf;
use std::process::Command;

const LABGUARD_BIN: &[u8] = include_bytes!("../../../dist/LABGUARD.exe");
const LOGO_ICO: &[u8] = include_bytes!("../../../assets/logo.ico");

fn main() {
    println!("==========================================================================");
    println!("  LABGUARD V2 — Enterprise Computer Laboratory Management System");
    println!("  Official Windows Standalone Installer");
    println!("  Version: 2.5.1 (Production Release)");
    println!("==========================================================================");
    println!();

    let local_app_data = match env::var("LOCALAPPDATA") {
        Ok(val) => PathBuf::from(val),
        Err(_) => {
            eprintln!("[ERROR] Could not determine LOCALAPPDATA directory.");
            wait_for_keypress();
            return;
        }
    };

    let user_profile = match env::var("USERPROFILE") {
        Ok(val) => PathBuf::from(val),
        Err(_) => {
            eprintln!("[ERROR] Could not determine USERPROFILE directory.");
            wait_for_keypress();
            return;
        }
    };

    let app_data = match env::var("APPDATA") {
        Ok(val) => PathBuf::from(val),
        Err(_) => {
            eprintln!("[ERROR] Could not determine APPDATA directory.");
            wait_for_keypress();
            return;
        }
    };

    let install_dir = local_app_data.join("Programs").join("LabGuard");
    let assets_dir = install_dir.join("Assets");
    let target_exe = install_dir.join("LabGuard.exe");
    let target_ico = assets_dir.join("logo.ico");
    let target_uninstaller = install_dir.join("Uninstall.bat");

    println!("[1/6] Stopping any running LabGuard processes...");
    let _ = Command::new("taskkill")
        .args(["/F", "/IM", "LabGuard.exe", "/T"])
        .output();

    println!("[2/6] Preparing destination directory: {}", install_dir.display());
    if let Err(e) = fs::create_dir_all(&assets_dir) {
        eprintln!("[ERROR] Failed to create installation folder: {}", e);
        wait_for_keypress();
        return;
    }

    println!("[3/6] Deploying LABGUARD V2 binaries and resources...");
    if let Err(e) = fs::write(&target_exe, LABGUARD_BIN) {
        eprintln!("[ERROR] Failed to write executable {}: {}", target_exe.display(), e);
        wait_for_keypress();
        return;
    }
    println!("      -> Installed {}", target_exe.display());

    if let Err(e) = fs::write(&target_ico, LOGO_ICO) {
        eprintln!("[WARNING] Could not write icon {}: {}", target_ico.display(), e);
    } else {
        println!("      -> Installed {}", target_ico.display());
    }

    // Write Uninstaller
    let uninstall_script = format!(
        "@echo off\r\n\
        echo Stopping LabGuard...\r\n\
        taskkill /F /IM LabGuard.exe /T >nul 2>&1\r\n\
        echo Removing shortcuts...\r\n\
        del /F /Q \"{}\\Desktop\\LABGUARD.lnk\" >nul 2>&1\r\n\
        rmdir /S /Q \"{}\\Microsoft\\Windows\\Start Menu\\Programs\\LABGUARD\" >nul 2>&1\r\n\
        echo Removing registry entries...\r\n\
        reg delete \"HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\LabGuard\" /f >nul 2>&1\r\n\
        echo Removing application cache...\r\n\
        rmdir /S /Q \"{}\\LABGUARD\" >nul 2>&1\r\n\
        echo Removing installation folder...\r\n\
        start /b \"\" cmd /c timeout /t 2 /nobreak ^>nul ^& rmdir /S /Q \"{}\"\r\n\
        echo ========================================================\r\n\
        echo  LABGUARD V2 has been uninstalled successfully.\r\n\
        echo ========================================================\r\n\
        pause\r\n",
        user_profile.display(),
        app_data.display(),
        local_app_data.display(),
        install_dir.display()
    );

    let _ = fs::write(&target_uninstaller, uninstall_script.as_bytes());
    println!("      -> Created Uninstaller: {}", target_uninstaller.display());

    println!("[4/6] Initializing enterprise directories in C:\\ProgramData\\LABGUARD...");
    let program_data = PathBuf::from(r"C:\ProgramData\LABGUARD");
    for sub in &["database", "config", "evidence", "logs", "sync"] {
        let sub_path = program_data.join(sub);
        let _ = fs::create_dir_all(&sub_path);
    }
    println!("      -> Initialized database, config, evidence, logs, and sync vaults");

    println!("[5/6] Generating Desktop and Start Menu shortcuts...");
    let desktop_shortcut = user_profile.join("Desktop").join("LABGUARD.lnk");
    let start_menu_dir = app_data
        .join("Microsoft")
        .join("Windows")
        .join("Start Menu")
        .join("Programs")
        .join("LABGUARD");
    let _ = fs::create_dir_all(&start_menu_dir);
    let start_shortcut = start_menu_dir.join("LABGUARD.lnk");

    create_shortcut(&target_exe, &target_ico, &desktop_shortcut);
    create_shortcut(&target_exe, &target_ico, &start_shortcut);
    println!("      -> Created {}", desktop_shortcut.display());
    println!("      -> Created {}", start_shortcut.display());

    println!("[6/6] Registering in Windows Add/Remove Programs...");
    register_in_windows_uninstall(&install_dir, &target_uninstaller, &target_ico);

    println!();
    println!("==========================================================================");
    println!("  [SUCCESS] LABGUARD V2 has been installed successfully!");
    println!("  Executable: {}", target_exe.display());
    println!("  Shortcuts : Desktop & Start Menu");
    println!("==========================================================================");
    println!();

    print!("Launch LABGUARD now? (Y/n): ");
    let _ = io::stdout().flush();
    let mut input = String::new();
    let _ = io::stdin().read_line(&mut input);

    if input.trim().is_empty() || input.trim().eq_ignore_ascii_case("y") {
        println!("Launching LABGUARD V2...");
        let _ = Command::new(&target_exe).spawn();
    }
}

fn create_shortcut(target_exe: &PathBuf, icon_path: &PathBuf, shortcut_path: &PathBuf) {
    let script = format!(
        "$ws = New-Object -ComObject WScript.Shell; \
        $s = $ws.CreateShortcut('{shortcut}'); \
        $s.TargetPath = '{target}'; \
        $s.WorkingDirectory = '{workdir}'; \
        $s.IconLocation = '{icon},0'; \
        $s.Description = 'LABGUARD V2 — Computer Lab Management System'; \
        $s.Save();",
        shortcut = shortcut_path.display(),
        target = target_exe.display(),
        workdir = target_exe.parent().unwrap().display(),
        icon = icon_path.display()
    );

    let _ = Command::new("powershell")
        .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", &script])
        .output();
}

fn register_in_windows_uninstall(
    install_dir: &PathBuf,
    uninstaller_path: &PathBuf,
    icon_path: &PathBuf,
) {
    let reg_key = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\LabGuard";
    let commands = [
        format!("reg add \"{}\" /v \"DisplayName\" /t REG_SZ /d \"LABGUARD V2 — Computer Lab Management System\" /f", reg_key),
        format!("reg add \"{}\" /v \"DisplayVersion\" /t REG_SZ /d \"2.5.1\" /f", reg_key),
        format!("reg add \"{}\" /v \"Publisher\" /t REG_SZ /d \"LABGUARD Technologies\" /f", reg_key),
        format!("reg add \"{}\" /v \"InstallLocation\" /t REG_SZ /d \"{}\" /f", reg_key, install_dir.display()),
        format!("reg add \"{}\" /v \"DisplayIcon\" /t REG_SZ /d \"{},0\" /f", reg_key, icon_path.display()),
        format!("reg add \"{}\" /v \"UninstallString\" /t REG_SZ /d \"\\\"{}\\\"\" /f", reg_key, uninstaller_path.display()),
        format!("reg add \"{}\" /v \"NoModify\" /t REG_DWORD /d 1 /f", reg_key),
        format!("reg add \"{}\" /v \"NoRepair\" /t REG_DWORD /d 1 /f", reg_key),
        format!("reg add \"{}\" /v \"EstimatedSize\" /t REG_DWORD /d 25000 /f", reg_key),
    ];

    for cmd in commands {
        let _ = Command::new("cmd").args(["/c", &cmd]).output();
    }
}

fn wait_for_keypress() {
    println!("Press Enter to continue...");
    let mut buf = String::new();
    let _ = io::stdin().read_line(&mut buf);
}
