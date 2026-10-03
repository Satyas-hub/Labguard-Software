; ============================================================================
; LABGUARD V2: Professional Inno Setup Script
; Installs to: C:\Program Files\LABGUARD\
; Data Path:   C:\ProgramData\LABGUARD\
; Target OS:   Windows 10, Windows 11 (x64)
; ============================================================================

#define MyAppName "LABGUARD"
#define MyAppVersion "3.5.1"
#define MyAppPublisher "LABGUARD Institutional Engineering"
#define MyAppURL "https://labguard.edu"
#define MyAppExeName "LABGUARD.exe"

[Setup]
AppId={{8F3A29B0-1A4C-4F92-B7E3-5D9E2A8C1100}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputDir=..\dist
OutputBaseFilename=LABGUARD-Setup
SetupIconFile=..\assets\logo.ico
UninstallDisplayIcon={app}\assets\logo.ico
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
CloseApplications=yes
VersionInfoVersion=3.5.0.0
VersionInfoTextVersion=3.5.0
VersionInfoCompany={#MyAppPublisher}
VersionInfoDescription=LABGUARD v3.5.0 Enterprise EDR Endpoint Security & Lab Management Platform
VersionInfoProductVersion=3.5.0
VersionInfoCopyright=Copyright (C) 2026 LABGUARD

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"
Name: "autostart"; Description: "Automatically launch LABGUARD on Windows system startup"; GroupDescription: "System Startup:"; Flags: unchecked

[Files]
Source: "..\dist\LABGUARD.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\dist\WebView2Loader.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\assets\logo.ico"; DestDir: "{app}\assets"; Flags: ignoreversion
Source: "..\assets\logo.png"; DestDir: "{app}\assets"; Flags: ignoreversion
Source: "..\LABGUARD_DEPLOYMENT_PACKAGE\Start_LABGUARD.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\LABGUARD_DEPLOYMENT_PACKAGE\Set_Server_IP.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\dist\server\*"; DestDir: "{app}\server"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\dist\server\*"; DestDir: "{commonappdata}\LABGUARD\server"; Flags: ignoreversion recursesubdirs createallsubdirs; Check: IsAdminInstallMode

[Dirs]
Name: "{commonappdata}\LABGUARD\database"; Check: IsAdminInstallMode; Permissions: users-full
Name: "{commonappdata}\LABGUARD\sync"; Check: IsAdminInstallMode; Permissions: users-full
Name: "{commonappdata}\LABGUARD\logs"; Check: IsAdminInstallMode; Permissions: users-full
Name: "{commonappdata}\LABGUARD\evidence"; Check: IsAdminInstallMode; Permissions: users-full
Name: "{commonappdata}\LABGUARD\config"; Check: IsAdminInstallMode; Permissions: users-full
Name: "{commonappdata}\LABGUARD\database"; Check: not IsAdminInstallMode
Name: "{commonappdata}\LABGUARD\sync"; Check: not IsAdminInstallMode
Name: "{commonappdata}\LABGUARD\logs"; Check: not IsAdminInstallMode
Name: "{commonappdata}\LABGUARD\evidence"; Check: not IsAdminInstallMode
Name: "{commonappdata}\LABGUARD\config"; Check: not IsAdminInstallMode

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\assets\logo.ico"
Name: "{group}\Configure Central Server IP"; Filename: "{app}\Set_Server_IP.bat"; IconFilename: "{app}\assets\logo.ico"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\assets\logo.ico"; Tasks: desktopicon

[Registry]
; Windows Startup configuration: --boot-lock enforces kiosk lock on system power-on
Root: HKA; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "{#MyAppName}"; ValueData: """{app}\{#MyAppExeName}"" --boot-lock"; Flags: uninsdeletevalue; Tasks: autostart

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[Code]
var
  ServerIPPage: TInputQueryWizardPage;

procedure InitializeWizard;
begin
  ServerIPPage := CreateInputQueryPage(wpSelectTasks,
    'Central Server Configuration',
    'Configure Central Server IP for this Workstation',
    'If this workstation connects to a central lab server across the network (LAN), enter the Server IP or Hostname below.' + #13#10#13#10 +
    'If running standalone or on the Server PC itself, leave the default value "localhost".');
  ServerIPPage.Add('Server IP or Hostname (e.g. 192.168.1.100 or localhost):', False);
  ServerIPPage.Values[0] := 'localhost';
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ConfigFile: String;
  WorkstationFile: String;
  ConfigDir: String;
  ServerIP: String;
  CleanIP: String;
  ServerUrl: String;
  ClientId: String;
  JsonContent: String;
  WsJson: String;
begin
  if CurStep = ssPostInstall then
  begin
    ServerIP := Trim(ServerIPPage.Values[0]);
    if ServerIP = '' then
      ServerIP := 'localhost';

    CleanIP := ServerIP;
    StringChange(CleanIP, 'http://', '');
    StringChange(CleanIP, 'https://', '');
    StringChange(CleanIP, '/', '');

    ServerUrl := 'http://' + CleanIP + ':5000';

    ConfigDir := ExpandConstant('{commonappdata}\LABGUARD\config');
    ForceDirectories(ConfigDir);

    // 1. Save Server Configuration
    ConfigFile := ConfigDir + '\server_config.json';
    JsonContent := '{"server_url":"' + ServerUrl + '","server_ip":"' + CleanIP + '","port":5000,"configured_by":"LABGUARD Setup Wizard"}';
    SaveStringToFile(ConfigFile, JsonContent, False);

    // 2. Preserve or initialize Workstation Identity without prompting
    WorkstationFile := ConfigDir + '\workstation.json';
    if not FileExists(WorkstationFile) then
    begin
      ClientId := 'CLIENT-' + GetDateTimeString('yyyymmddhhnnss', #0, #0);
      WsJson := '{"client_id":"' + ClientId + '","lab_code":"UNASSIGNED","pc_code":"UNASSIGNED","is_registered":false,"app_version":"' + ExpandConstant('{#MyAppVersion}') + '","windows_version":"Microsoft Windows"}';
      SaveStringToFile(WorkstationFile, WsJson, False);
    end;

    RegWriteStringValue(HKEY_CURRENT_USER, 'Software\LABGUARD', 'ServerUrl', ServerUrl);
  end;
end;

