import React, { useState, useEffect } from 'react';
import {
  ShieldAlert, Lock, Monitor, ArrowRight, CheckCircle2, AlertTriangle, KeyRound,
  Building2, User, ShieldCheck, RefreshCw, Cpu, Wifi, HardDrive, Keyboard, Mouse, Server, X
} from 'lucide-react';
import { ApiClient, getServerUrl, setServerUrl } from '../services/api';
import { APP_VERSION } from '../config/version';

interface UnregisteredLockScreenProps {
  initialIdentity?: any;
  onRegistered: (newIdentity: any) => void;
  onGoToAdminLogin?: () => void;
  onBackToLogin?: () => void;
}

export const UnregisteredLockScreen: React.FC<UnregisteredLockScreenProps> = ({
  initialIdentity,
  onRegistered,
  onGoToAdminLogin,
  onBackToLogin
}) => {
  const [identity, setIdentity] = useState<any>(initialIdentity || {
    client_id: 'CLIENT-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
    lab_code: 'UNASSIGNED',
    pc_code: 'UNASSIGNED',
    app_version: APP_VERSION,
    windows_version: 'Microsoft Windows 11 Pro 64-bit',
    is_registered: false
  });

  const [hardware, setHardware] = useState<any>({
    keyboard_connected: false,
    mouse_connected: false,
    monitor_connected: false,
    keyboard_name: 'Checking...',
    mouse_name: 'Checking...',
    monitor_name: 'Checking...',
    timestamp: new Date().toISOString()
  });

  // Provisioning Form State - Start blank so user enters details
  const [adminPassword, setAdminPassword] = useState('');
  const [labs, setLabs] = useState<any[]>([]);
  const [selectedLabCode, setSelectedLabCode] = useState('');
  const [targetPcCode, setTargetPcCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Server Settings Modal State
  const [showServerModal, setShowServerModal] = useState(false);
  const [serverInput, setServerInput] = useState(getServerUrl());
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testingServer, setTestingServer] = useState(false);

  // Load hardware status & identity & available labs
  useEffect(() => {
    const fetchTauriIdentity = async () => {
      try {
        if ((window as any).__TAURI_INTERNALS__) {
          const { invoke } = await import('@tauri-apps/api/core');
          const idRes: any = await invoke('get_pc_identity');
          if (idRes) {
            setIdentity(idRes);
          }

          const hwRes: any = await invoke('get_hardware_status');
          if (hwRes) setHardware(hwRes);
        } else {
          // Fetch from live system peripherals API
          try {
            const periRes = await ApiClient.request('/system/peripherals');
            if (periRes.success && periRes.data) {
              setHardware(periRes.data);
            }
          } catch {}
        }
      } catch (e) {
        console.warn('Running outside native Tauri shell or fallback:', e);
      }
    };

    const fetchAvailableLabs = async () => {
      try {
        const res = await ApiClient.request('/clients/available-labs');
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          setLabs(res.data);
        } else {
          setLabs([]);
        }
      } catch {
        setLabs([]);
      }
    };

    fetchTauriIdentity();
    fetchAvailableLabs();
  }, []);

  const [refreshingHw, setRefreshingHw] = useState(false);
  const handleRescanHardware = async () => {
    setRefreshingHw(true);
    try {
      if ((window as any).__TAURI_INTERNALS__) {
        const { invoke } = await import('@tauri-apps/api/core');
        const hwRes: any = await invoke('get_hardware_status');
        if (hwRes) setHardware(hwRes);
      } else {
        const periRes = await ApiClient.request('/system/peripherals');
        if (periRes.success && periRes.data) {
          setHardware(periRes.data);
        }
      }
    } catch {}
    finally {
      setRefreshingHw(false);
    }
  };

  // Handle Lab change in provisioning form
  const handleLabSelect = (labCode: string) => {
    setSelectedLabCode(labCode);
  };

  // Submit terminal binding to Central Server
  const handleBindTerminal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLabCode || !targetPcCode.trim()) {
      setError('Please select a laboratory and provide a workstation code.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Authenticate administrator credentials
      const authRes = await ApiClient.request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          identifier: 'admin@labguard.edu',
          password: adminPassword.trim()
        })
      });

      if (!authRes.success || !authRes.data?.accessToken) {
        setError('Invalid Administrator password. Authorization required to bind terminal.');
        setLoading(false);
        return;
      }

      const formattedPc = targetPcCode.trim().toUpperCase().startsWith('PC-')
        ? targetPcCode.trim().toUpperCase()
        : `PC-${targetPcCode.trim().toUpperCase().padStart(2, '0')}`;

      // 2. Register terminal with central server
      const payload = {
        clientId: identity.client_id,
        labCode: selectedLabCode.toUpperCase(),
        pcCode: formattedPc,
        hostname: identity.hostname || `${selectedLabCode}-${formattedPc}`,
        appVersion: identity.app_version || APP_VERSION,
        hardwareInfo: {
          keyboard: hardware.keyboard_name,
          mouse: hardware.mouse_name,
          monitor: hardware.monitor_name,
          osVersion: identity.windows_version || 'Microsoft Windows 11 Pro 64-bit'
        }
      };

      const regRes = await ApiClient.request('/clients/register', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authRes.data.accessToken}` },
        body: JSON.stringify(payload)
      });

      if (regRes.success) {
        const newIdentity = {
          client_id: identity.client_id,
          lab_code: selectedLabCode.toUpperCase(),
          pc_code: formattedPc,
          is_registered: true,
          app_version: identity.app_version || APP_VERSION,
          windows_version: identity.windows_version || 'Microsoft Windows 11 Pro 64-bit',
          hostname: identity.hostname || `${selectedLabCode}-${formattedPc}`,
          ip_address: identity.ip_address || '127.0.0.1'
        };

        // Persist to native Tauri storage
        if ((window as any).__TAURI_INTERNALS__) {
          const { invoke } = await import('@tauri-apps/api/core');
          await invoke('set_pc_identity', { identity: newIdentity });
        }

        setSuccessMessage(`Terminal successfully registered and bound as ${selectedLabCode} - ${formattedPc}! Launching...`);
        setTimeout(() => {
          onRegistered(newIdentity);
        }, 800);
      } else {
        setError(regRes.message || regRes.error || 'Failed to bind workstation node.');
      }
    } catch (err: any) {
      setError(err.message || 'Terminal binding failed due to network error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 w-full h-full bg-slate-950 text-slate-100 flex flex-col justify-between overflow-hidden relative select-none">
      {/* Background Security Grid & Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-blue-950/40 via-slate-950 to-slate-950 pointer-events-none" />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Branding */}
      <header className="relative z-10 px-6 sm:px-8 py-3.5 border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-xl flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 p-1 shadow-lg flex items-center justify-center overflow-hidden">
            <img
              src="/assets/logo.png"
              alt="LABGUARD Logo"
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-tight text-white text-base">LABGUARD</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 tracking-wide uppercase">
                Setup Wizard
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-400 border border-slate-700">
                v{APP_VERSION}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Institutional Workstation Registration & Fleet Provisioning</p>
          </div>
        </div>

        {/* Server Config Action */}
        <div className="flex items-center gap-3">
          {onGoToAdminLogin && (
            <button
              type="button"
              onClick={onGoToAdminLogin}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600/20 border border-blue-500/40 text-blue-300 hover:text-white hover:bg-blue-600/40 text-xs font-semibold transition-colors cursor-pointer"
            >
              <span>Go to Login Screen →</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setServerInput(getServerUrl());
              setTestResult(null);
              setShowServerModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Configure Central Server IP"
          >
            <Server className="w-3.5 h-3.5 text-blue-400" />
            <span>Server IP</span>
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="font-semibold text-amber-400">Setup Pending</span>
          </div>
        </div>
      </header>

      {/* Main Lock Content - Perfectly Centered & Fixed */}
      <main className="relative z-10 flex-1 w-full px-4 py-2 flex items-center justify-center overflow-y-auto no-scrollbar min-h-0">
        <div className="w-full max-w-lg bg-slate-900/95 border border-slate-800 rounded-2xl p-5 shadow-2xl backdrop-blur-xl space-y-3 shrink-0">
          {/* Header */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shadow-md">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white tracking-tight">Workstation Registration</h2>
                <p className="text-[11px] text-slate-400">Bind terminal hardware to campus laboratory</p>
              </div>
            </div>
            <div className="text-right font-mono text-[10px] text-slate-400">
              ID: <span className="text-amber-400 font-bold">{identity.client_id}</span>
            </div>
          </div>

          {/* Compact Auto-Detected System & Peripherals Status Bar */}
          <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl px-3 py-2 flex items-center justify-between text-[11px] gap-2">
            <div className="flex items-center gap-2 truncate">
              <span className="font-mono font-bold text-white flex items-center gap-1 shrink-0 text-xs">
                <Cpu className="w-3.5 h-3.5 text-blue-400" />
                {identity.hostname || 'Detecting...'}
              </span>
              <span className="text-slate-600">•</span>
              <span className="font-mono text-emerald-400 shrink-0 text-xs">{identity.ip_address || '127.0.0.1'}</span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px]" title={`Keyboard: ${hardware.keyboard_name}`}>
                <Keyboard className="w-3 h-3 text-blue-400" />
                <span className={`w-1.5 h-1.5 rounded-full ${hardware.keyboard_connected ? 'bg-emerald-400' : 'bg-rose-500'}`} />
              </div>
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px]" title={`Mouse: ${hardware.mouse_name}`}>
                <Mouse className="w-3 h-3 text-blue-400" />
                <span className={`w-1.5 h-1.5 rounded-full ${hardware.mouse_connected ? 'bg-emerald-400' : 'bg-rose-500'}`} />
              </div>
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px]" title={`Monitor: ${hardware.monitor_name}`}>
                <Monitor className="w-3 h-3 text-blue-400" />
                <span className={`w-1.5 h-1.5 rounded-full ${hardware.monitor_connected ? 'bg-emerald-400' : 'bg-rose-500'}`} />
              </div>
              <button
                type="button"
                onClick={handleRescanHardware}
                disabled={refreshingHw}
                className="p-1 text-slate-400 hover:text-blue-400 transition-colors cursor-pointer"
                title="Re-scan hardware"
              >
                <RefreshCw className={`w-3 h-3 ${refreshingHw ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {error && (
            <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Direct Provisioning Form */}
          <form onSubmit={handleBindTerminal} className="space-y-3">
            {/* Laboratory Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                <span>Select Laboratory <span className="text-rose-400">*</span></span>
                {onGoToAdminLogin ? (
                  <button
                    type="button"
                    onClick={onGoToAdminLogin}
                    className="text-[11px] text-blue-400 hover:text-blue-300 font-medium underline cursor-pointer transition-colors"
                    title="Open Administrator Login Screen"
                  >
                    From Admin Panel →
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-500 font-normal">From Admin Panel</span>
                )}
              </label>
              {labs.length === 0 && (
                <div className="mb-1.5 p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[11px] text-amber-300 flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400 mt-0.5" />
                  <p className="text-[10px] text-amber-300/90 leading-tight">
                    No active labs found on server. Enter a Lab Code manually (e.g. LAB-01) or create labs via Admin Dashboard.
                  </p>
                </div>
              )}
              {labs.length > 0 ? (
                <select
                  value={selectedLabCode}
                  onChange={(e) => handleLabSelect(e.target.value)}
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-blue-500"
                >
                  <option value="">-- Choose Laboratory --</option>
                  {labs.map((l) => (
                    <option key={l.id || l.code} value={l.code}>
                      {l.code} — {l.name} ({l.building || 'Main'} {l.room || ''})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  required
                  value={selectedLabCode}
                  onChange={(e) => setSelectedLabCode(e.target.value.toUpperCase())}
                  placeholder="e.g. LAB-01"
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 font-mono text-white focus:outline-hidden focus:border-blue-500 uppercase"
                />
              )}
            </div>

            {/* System Number Input & Admin Password */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Workstation Number <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={targetPcCode}
                  onChange={(e) => setTargetPcCode(e.target.value.toUpperCase())}
                  placeholder="e.g. PC-01"
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 font-mono font-bold text-white uppercase focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Admin Password <span className="text-rose-400">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Admin Password"
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-blue-500"
                />
              </div>
            </div>

            {/* Binding Target Preview */}
            <div className="px-3 py-1.5 bg-slate-950/60 border border-slate-800/80 rounded-xl text-[11px] text-slate-400 flex items-center justify-between">
              <span>Binding Preview:</span>
              <span className="font-mono font-bold text-blue-400">
                {selectedLabCode || 'LAB-XX'} ➔ {targetPcCode || 'PC-XX'}
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !selectedLabCode || !targetPcCode.trim() || !adminPassword.trim()}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/30 disabled:opacity-50 cursor-pointer"
            >
              {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>Register & Activate Workstation</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            {(onBackToLogin || onGoToAdminLogin) && (
              <button
                type="button"
                onClick={onBackToLogin || onGoToAdminLogin}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-900/60 hover:bg-slate-900 border border-slate-800 transition-all cursor-pointer"
              >
                <span>Go to User Login Screen →</span>
              </button>
            )}
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 px-6 sm:px-8 py-2.5 border-t border-slate-800/60 bg-slate-950/40 text-[11px] text-slate-500 flex items-center justify-between shrink-0">
        <span>LABGUARD Institutional Laboratory Management System</span>
        <span>Fleet Provisioning Engine</span>
      </footer>

      {/* Server Modal */}
      {showServerModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-blue-500/10 text-blue-400 rounded-lg">
                  <Server className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">Central Server IP Configuration</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowServerModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Server URL / Hostname
                </label>
                <input
                  type="text"
                  value={serverInput}
                  onChange={(e) => setServerInput(e.target.value)}
                  placeholder="http://192.168.1.100:5000"
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:outline-hidden focus:border-blue-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Target Central Server IP on campus network (e.g. <code className="text-blue-400">http://192.168.1.100:5000</code>).
                </p>
              </div>

              {testResult && (
                <div className={`p-3 rounded-lg text-xs flex items-start space-x-2 ${testResult.success ? 'bg-emerald-950/50 border border-emerald-800 text-emerald-300' : 'bg-rose-950/50 border border-rose-800 text-rose-300'}`}>
                  {testResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                  <span>{testResult.message}</span>
                </div>
              )}

              <button
                type="button"
                onClick={async () => {
                  setTestingServer(true);
                  setTestResult(null);
                  try {
                    const res = await fetch(`${serverInput}/health`, { signal: AbortSignal.timeout(3000) });
                    if (res.ok) {
                      setTestResult({ success: true, message: 'Connected successfully to LABGUARD Central API!' });
                    } else {
                      setTestResult({ success: false, message: `Server returned HTTP ${res.status}` });
                    }
                  } catch (e: any) {
                    setTestResult({ success: false, message: `Cannot reach server: ${e.message}` });
                  } finally {
                    setTestingServer(false);
                  }
                }}
                disabled={testingServer}
                className="w-full px-3 py-2 border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-lg flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testingServer ? 'animate-spin' : ''}`} />
                <span>Test Connection</span>
              </button>
            </div>

            <div className="px-6 py-3.5 bg-slate-950/50 border-t border-slate-800 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowServerModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setServerUrl(serverInput.trim());
                  setShowServerModal(false);
                  window.location.reload();
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg"
              >
                Save & Reload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
