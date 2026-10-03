import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../../../shared/types';
import { Shield, Keyboard, Mouse, Monitor, AlertCircle, ArrowRight, Settings, Server, CheckCircle2, X, RefreshCw, Building2, CheckCircle, XCircle, Wrench } from 'lucide-react';
import { NativeService, NativeHardwareStatus } from '../services/native';
import { getServerUrl, setServerUrl, ApiClient } from '../services/api';
import { APP_VERSION } from '../config/version';

export interface LoginViewProps {
  initialRole?: UserRole;
  onBackToLockScreen?: () => void;
  onOpenSetupWizard?: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ initialRole, onBackToLockScreen, onOpenSetupWizard }) => {
  const { login, isOnline, pcIdentity } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole>(initialRole || 'STUDENT');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hwStatus, setHwStatus] = useState<NativeHardwareStatus | null>(null);
  const [refreshingHw, setRefreshingHw] = useState(false);
  const [logoError, setLogoError] = useState(false);

  // Server Settings Modal State
  const [showServerModal, setShowServerModal] = useState(false);
  const [serverInput, setServerInput] = useState(getServerUrl());
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testingServer, setTestingServer] = useState(false);

  // Workstation Reconfigure Modal State
  const [showReconfigModal, setShowReconfigModal] = useState(false);
  const [reconfigAdminPassword, setReconfigAdminPassword] = useState('');
  const [reconfigLab, setReconfigLab] = useState(pcIdentity?.lab_code || '');
  const [reconfigPc, setReconfigPc] = useState(pcIdentity?.pc_code || '');
  const [availableLabs, setAvailableLabs] = useState<any[]>([]);
  const [reconfigError, setReconfigError] = useState<string | null>(null);
  const [reconfigLoading, setReconfigLoading] = useState(false);

  const handleRefreshHardware = async () => {
    setRefreshingHw(true);
    try {
      const status = await NativeService.getHardwareStatus();
      setHwStatus(status);
    } catch {
      // Ignored
    } finally {
      setRefreshingHw(false);
    }
  };

  const handleOpenReconfigModal = async () => {
    setReconfigError(null);
    setReconfigAdminPassword('');
    setReconfigLab(pcIdentity?.lab_code || '');
    setReconfigPc(pcIdentity?.pc_code || '');
    setShowReconfigModal(true);

    try {
      const res = await ApiClient.request('/clients/available-labs');
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setAvailableLabs(res.data);
        if (!reconfigLab) {
          setReconfigLab(res.data[0].code);
        }
      } else {
        // Strictly empty array if 0 labs exist in DB
        setAvailableLabs([]);
      }
    } catch {
      setAvailableLabs([]);
    }
  };

  const handleSaveReconfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reconfigLab.trim() || !reconfigPc.trim()) {
      setReconfigError('Please specify both Laboratory and Workstation Number.');
      return;
    }

    setReconfigLoading(true);
    setReconfigError(null);

    try {
      // Authenticate admin password
      const authRes = await ApiClient.request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          identifier: 'admin@labguard.edu',
          password: reconfigAdminPassword.trim()
        })
      });

      if (!authRes.success || !authRes.data?.accessToken) {
        setReconfigError('Invalid Administrator password. Authorization required.');
        setReconfigLoading(false);
        return;
      }

      const formattedPc = reconfigPc.trim().toUpperCase().startsWith('PC-')
        ? reconfigPc.trim().toUpperCase()
        : `PC-${reconfigPc.trim().toUpperCase().padStart(2, '0')}`;

      // Register with server
      await ApiClient.request('/clients/register', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authRes.data.accessToken}` },
        body: JSON.stringify({
          clientId: pcIdentity?.client_id || 'CLIENT-UNKNOWN',
          labCode: reconfigLab.trim().toUpperCase(),
          pcCode: formattedPc
        })
      });

      // Persist to local config
      const updatedIdentity = {
        client_id: pcIdentity?.client_id || 'CLIENT-UNKNOWN',
        app_version: pcIdentity?.app_version || APP_VERSION,
        windows_version: pcIdentity?.windows_version || 'Microsoft Windows 11 Pro 64-bit',
        lab_code: reconfigLab.trim().toUpperCase(),
        pc_code: formattedPc,
        is_registered: true
      };

      await NativeService.setPcIdentity(updatedIdentity);
      setShowReconfigModal(false);
      window.location.reload();
    } catch (err: any) {
      setReconfigError(err.message || 'Failed to reconfigure workstation.');
    } finally {
      setReconfigLoading(false);
    }
  };

  useEffect(() => {
    NativeService.getHardwareStatus().then(setHwStatus);
    setIdentifier('');
    setPassword('');
    setError(null);
  }, [selectedRole]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) {
      setError('Please provide your institutional identifier and password');
      return;
    }

    setError(null);
    setLoading(true);
    const res = await login(identifier, password, selectedRole);
    setLoading(false);

    if (!res.success) {
      setError(res.message || 'Authentication failed. Please verify your credentials.');
    }
  };

function normalizeServerUrl(input: string): string {
  let clean = input.trim();
  if (!clean) return 'http://localhost:5000';
  if (!/^https?:\/\//i.test(clean)) {
    clean = `http://${clean}`;
  }
  try {
    const parsed = new URL(clean);
    if (!parsed.port) {
      parsed.port = '5000';
    }
    return parsed.origin;
  } catch {
    if (!clean.includes(':', 7)) {
      clean = `${clean}:5000`;
    }
    return clean.replace(/\/+$/, '');
  }
}

  const handleTestServer = async (overrideUrl?: string) => {
    setTestingServer(true);
    setTestResult(null);
    try {
      const url = normalizeServerUrl(overrideUrl || serverInput);
      setServerInput(url);

      let res;
      try {
        res = await fetch(`${url}/health`, { 
          signal: AbortSignal.timeout(3000),
          headers: { 'Accept': 'application/json' },
          cache: 'no-store'
        });
      } catch (firstErr) {
        // If local server and connection failed, attempt to start the background server and retry
        if (url.includes('localhost') || url.includes('127.0.0.1')) {
          await NativeService.ensureBackendRunning();
          res = await fetch(`${url}/health`, { 
            signal: AbortSignal.timeout(4000),
            headers: { 'Accept': 'application/json' },
            cache: 'no-store'
          });
        } else {
          throw firstErr;
        }
      }

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        setTestResult({ 
          success: false, 
          message: `Port reachable, but returned HTML instead of LABGUARD API. Ensure port 5000 is open and backend server is running.` 
        });
        return;
      }
      if (res.ok) {
        const json = await res.json();
        setTestResult({ success: true, message: `Connected! Server responded ${json.status || 'OK'}` });
      } else {
        setTestResult({ success: false, message: `Server returned HTTP ${res.status}` });
      }
    } catch (e: any) {
      setTestResult({ success: false, message: `Connection failed: ${e.message || 'Host unreachable (is backend running?)'}` });
    } finally {
      setTestingServer(false);
    }
  };

  const handleAutoDetectAndReset = async () => {
    let resolvedUrl = 'http://localhost:5000';
    try {
      const nativeCfg = await NativeService.getServerConfig();
      if (nativeCfg && (nativeCfg as any).server_url) {
        resolvedUrl = (nativeCfg as any).server_url;
      }
    } catch {
      // Fallback to localhost
    }
    setServerInput(resolvedUrl);
    if (resolvedUrl.includes('localhost') || resolvedUrl.includes('127.0.0.1')) {
      await NativeService.ensureBackendRunning();
    }
    await handleTestServer(resolvedUrl);
  };

  const handleSaveServer = () => {
    const url = normalizeServerUrl(serverInput);
    setServerUrl(url);
    setShowServerModal(false);
    window.location.reload();
  };

  return (
    <div className="flex-1 w-full bg-gradient-to-br from-slate-100 via-blue-50/20 to-slate-200 flex flex-col items-center justify-start sm:justify-center p-3 sm:p-6 py-4 overflow-y-auto min-h-0 relative">
      {/* Abstract background graphics */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-400/15 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-400/15 rounded-full blur-[100px]" />
      </div>
      <div className="w-full max-w-md glass-panel rounded-2xl p-4 sm:p-6 relative my-auto shrink-0 transition-all z-10 shadow-xl border border-white/80">
        {onBackToLockScreen && (
          <div className="mb-2.5 text-left">
            <button
              type="button"
              onClick={onBackToLockScreen}
              className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer transition-colors bg-blue-50/80 hover:bg-blue-100/80 px-2 py-1 rounded-md border border-blue-200/60"
            >
              ← Return to Setup Wizard
            </button>
          </div>
        )}
        {/* Card Header */}
        <div className="text-center mb-2.5 sm:mb-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center mx-auto mb-1.5 shadow-xs overflow-hidden p-1">
            {!logoError ? (
              <img
                src="/assets/logo.png"
                alt="LABGUARD Logo"
                className="w-full h-full object-contain"
                onError={() => setLogoError(true)}
              />
            ) : (
              <div className="w-full h-full bg-blue-600 rounded-lg flex items-center justify-center text-white">
                <Shield className="w-5 h-5" />
              </div>
            )}
          </div>
          <div className="flex items-center justify-center space-x-2">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">Workstation Access</h1>
            <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200">
              v{APP_VERSION}
            </span>
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5">Institutional Computer Laboratory Sign-In</p>
          <div className="mt-1 flex items-center justify-center space-x-2">
            <span className={`inline-block w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span className={`text-[10px] font-semibold tracking-wide uppercase ${isOnline ? 'text-emerald-700' : 'text-amber-700'}`}>
              {isOnline ? 'Campus Network Connected' : 'Offline Operation Mode'}
            </span>
            <button
              type="button"
              onClick={() => {
                setServerInput(getServerUrl());
                setTestResult(null);
                setShowServerModal(true);
              }}
              className="p-1 text-slate-400 hover:text-blue-600 rounded-md hover:bg-slate-100 transition-colors"
              title="Configure Central Server IP / URL"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Detected Workstation Information Banner */}
        <div className="mb-2.5 p-2.5 bg-slate-50 border border-slate-200/90 rounded-xl flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <Monitor className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Terminal:</span>
                <span className="text-xs font-mono font-bold text-slate-900 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                  {pcIdentity?.is_registered && pcIdentity?.lab_code && pcIdentity.lab_code !== 'UNASSIGNED'
                    ? `${pcIdentity.lab_code} • ${pcIdentity.pc_code}`
                    : 'UNASSIGNED • UNREGISTERED'}
                </span>
                {pcIdentity?.is_registered ? (
                  <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1 py-0.2 rounded font-semibold">
                    Bound ✓
                  </span>
                ) : (
                  <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-1 py-0.2 rounded font-semibold">
                    Setup Required
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-1.5 truncate">
                <span>{pcIdentity?.hostname || 'LOCAL-PC'}</span>
                <span>•</span>
                <span>{pcIdentity?.ip_address || '127.0.0.1'}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenSetupWizard || handleOpenReconfigModal}
            className="px-2 py-1 text-[10px] font-semibold text-blue-600 hover:text-white bg-blue-50 hover:bg-blue-600 rounded-md border border-blue-200 hover:border-blue-600 transition-colors cursor-pointer shrink-0 flex items-center gap-1"
            title="Launch Setup Wizard"
          >
            <Wrench className="w-3 h-3" />
            <span>Setup Wizard</span>
          </button>
        </div>

        {/* Segmented Role Selector */}
        <div className="mb-2.5 sm:mb-3">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Institutional Role
          </label>
          <div className="grid grid-cols-4 gap-1 p-0.5 bg-slate-100 border border-slate-200 rounded-lg">
            {(['STUDENT', 'FACULTY', 'LAB_ASSISTANT', 'ADMIN'] as UserRole[]).map((r) => {
              const labelMap: Record<UserRole, string> = {
                STUDENT: 'Student',
                FACULTY: 'Faculty',
                LAB_ASSISTANT: 'Assistant',
                ADMIN: 'Admin'
              };
              const isSelected = selectedRole === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setSelectedRole(r)}
                  className={`py-1 sm:py-1.5 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  {labelMap[r]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Offline notice if offline */}
        {!isOnline && (
          <div className="mb-2 p-1.5 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-800 leading-relaxed">
            <span className="font-bold">Offline Security Policy:</span> Initial sign-in requires online connection. Cached offline logins available for authorized workstations.
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-2 sm:space-y-2.5">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              {selectedRole === 'STUDENT' ? 'Student ID / Roll Number' : 'Institutional Email / ID'}
            </label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={selectedRole === 'STUDENT' ? 'e.g. STU-2026-001' : 'user@labguard.edu'}
              className="w-full px-3 py-1.5 sm:py-2 bg-white border border-slate-300 rounded-lg text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 transition-all"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-1.5 sm:py-2 bg-white border border-slate-300 rounded-lg text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 transition-all"
            />
          </div>

          {/* Hardware Peripheral Verification Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs">
            <div className="flex items-center justify-between text-slate-600 mb-1">
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-slate-700 text-[10px] sm:text-[11px]">Peripherals Health</span>
                <span className="text-[9px] bg-blue-50 text-blue-700 border border-blue-200 px-1 py-0.2 rounded font-semibold">
                  Device Manager
                </span>
              </div>
              <button
                type="button"
                onClick={handleRefreshHardware}
                disabled={refreshingHw}
                className="p-0.5 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-200/60 transition-colors flex items-center space-x-1 text-[10px] cursor-pointer"
                title="Re-scan Windows Device Manager hardware"
              >
                <RefreshCw className={`w-3 h-3 ${refreshingHw ? 'animate-spin text-blue-600' : ''}`} />
                <span className="text-[9px] font-medium">Re-scan</span>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1 sm:gap-1.5">
              {/* Keyboard */}
              <div className="flex flex-col items-center justify-center p-1 sm:p-1.5 rounded-lg bg-white border border-slate-200/80 text-[10px] text-center">
                <div className="flex items-center space-x-1 mb-0.5">
                  <Keyboard className={`w-3 h-3 shrink-0 ${hwStatus?.keyboard_connected ? 'text-emerald-600' : 'text-rose-500'}`} />
                  <span className="font-medium text-slate-800 truncate" title={hwStatus?.keyboard_name || 'Standard Keyboard'}>
                    Keyboard
                  </span>
                </div>
                <span className={`px-1 py-0.2 rounded text-[9px] font-bold ${
                  hwStatus?.keyboard_connected
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}>
                  {hwStatus?.keyboard_connected ? 'Connected ✓' : 'Missing ✕'}
                </span>
              </div>

              {/* Mouse */}
              <div className="flex flex-col items-center justify-center p-1 sm:p-1.5 rounded-lg bg-white border border-slate-200/80 text-[10px] text-center">
                <div className="flex items-center space-x-1 mb-0.5">
                  <Mouse className={`w-3 h-3 shrink-0 ${hwStatus?.mouse_connected ? 'text-emerald-600' : 'text-rose-500'}`} />
                  <span className="font-medium text-slate-800 truncate" title={hwStatus?.mouse_name || 'Pointing Device'}>
                    Mouse
                  </span>
                </div>
                <span className={`px-1 py-0.2 rounded text-[9px] font-bold ${
                  hwStatus?.mouse_connected
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}>
                  {hwStatus?.mouse_connected ? 'Connected ✓' : 'Missing ✕'}
                </span>
              </div>

              {/* Monitor */}
              <div className="flex flex-col items-center justify-center p-1 sm:p-1.5 rounded-lg bg-white border border-slate-200/80 text-[10px] text-center">
                <div className="flex items-center space-x-1 mb-0.5">
                  <Monitor className={`w-3 h-3 shrink-0 ${hwStatus?.monitor_connected ? 'text-emerald-600' : 'text-rose-500'}`} />
                  <span className="font-medium text-slate-800 truncate" title={hwStatus?.monitor_name || 'Display Monitor'}>
                    Monitor
                  </span>
                </div>
                <span className={`px-1 py-0.2 rounded text-[9px] font-bold ${
                  hwStatus?.monitor_connected
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}>
                  {hwStatus?.monitor_connected ? 'Connected ✓' : 'Missing ✕'}
                </span>
              </div>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="flex items-start space-x-2 bg-rose-50 border border-rose-200 p-2.5 rounded-lg text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center space-x-2 py-2 sm:py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs sm:text-sm transition-all shadow-xs cursor-pointer disabled:opacity-50"
          >
            <span>{loading ? 'Authorizing Credentials...' : 'Authorize & Sign In'}</span>
            <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </form>

        {/* Footer info */}
        <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-slate-100 text-center text-[11px] sm:text-xs text-slate-400 flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <span>Workstation:</span>
            <span className="font-semibold text-slate-700 font-mono">
              {pcIdentity?.is_registered && pcIdentity?.lab_code && pcIdentity.lab_code !== 'UNASSIGNED'
                ? `${pcIdentity.lab_code} • ${pcIdentity.pc_code}`
                : 'UNASSIGNED • UNREGISTERED'}
            </span>
            <button
              type="button"
              onClick={onOpenSetupWizard || handleOpenReconfigModal}
              className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-100 transition-colors cursor-pointer"
              title="Launch Setup Wizard"
            >
              <Wrench className="w-3.5 h-3.5" />
            </button>
            {!isOnline && <span className="text-amber-600 font-bold ml-1">(Offline)</span>}
          </div>
          <button
            type="button"
            onClick={() => {
              setServerInput(getServerUrl());
              setTestResult(null);
              setShowServerModal(true);
            }}
            className="text-[10px] sm:text-[11px] text-blue-600 hover:text-blue-700 font-medium hover:underline flex items-center space-x-1 cursor-pointer"
          >
            <Server className="w-3 h-3" />
            <span>Server IP</span>
          </button>
        </div>
      </div>

      {/* Server Network Configuration Modal */}
      {showServerModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                  <Server className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Central Server Configuration</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowServerModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Server Base URL / IP Address
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={serverInput}
                    onChange={(e) => setServerInput(e.target.value)}
                    placeholder="http://192.168.1.100:5000"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Set this to your lab's teacher or central server IP (e.g. <code className="text-blue-600">http://192.168.1.100:5000</code>). Use <code className="text-blue-600">http://localhost:5000</code> if running locally.
                </p>
              </div>

              {testResult && (
                <div className={`p-3 rounded-lg text-xs flex items-start space-x-2 ${testResult.success ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-rose-50 border border-rose-200 text-rose-800'}`}>
                  {testResult.success ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
                  <span>{testResult.message}</span>
                </div>
              )}

              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleTestServer()}
                  disabled={testingServer || !serverInput.trim()}
                  className="flex-1 px-3 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg flex items-center justify-center space-x-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testingServer ? 'animate-spin' : ''}`} />
                  <span>{testingServer ? 'Testing...' : 'Test Connection'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleAutoDetectAndReset}
                  disabled={testingServer}
                  className="px-3 py-2 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg flex items-center space-x-1.5 cursor-pointer transition-colors shadow-xs"
                  title="Auto-Detect LAN / Localhost IP and test immediately"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testingServer ? 'animate-spin' : ''}`} />
                  <span>Auto-Detect & Reset</span>
                </button>
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowServerModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveServer}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                Save & Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Workstation Lab & System Number Reconfiguration Modal */}
      {showReconfigModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Configure Lab & System Number</h3>
                  <p className="text-[11px] text-slate-500">Bind this PC to a Laboratory Cluster</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReconfigModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveReconfig} className="p-6 space-y-4">
              {reconfigError && (
                <div className="p-3 rounded-lg text-xs bg-rose-50 border border-rose-200 text-rose-800 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{reconfigError}</span>
                </div>
              )}

              {/* Lab Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Laboratory <span className="text-rose-500">*</span>
                </label>
                {availableLabs.length > 0 ? (
                  <select
                    value={reconfigLab}
                    onChange={(e) => setReconfigLab(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {availableLabs.map((lab) => (
                      <option key={lab.id} value={lab.code}>
                        {lab.code} — {lab.name} ({lab.building} {lab.room})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div>
                    <div className="mb-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>No laboratories found in database. Enter Lab Code:</span>
                    </div>
                    <input
                      type="text"
                      value={reconfigLab}
                      onChange={(e) => setReconfigLab(e.target.value.toUpperCase())}
                      placeholder="e.g. LAB-01"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono uppercase"
                    />
                  </div>
                )}
                <p className="text-[11px] text-slate-500 mt-1">
                  Labs created in the Institutional Admin Panel.
                </p>
              </div>

              {/* System Number Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  System / Workstation Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={reconfigPc}
                  onChange={(e) => setReconfigPc(e.target.value)}
                  placeholder="e.g. 01, 02, or PC-01"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono font-bold"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  System identifier on the desk label (e.g. PC-01).
                </p>
              </div>

              {/* Admin Password Verification */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Administrator Password <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={reconfigAdminPassword}
                  onChange={(e) => setReconfigAdminPassword(e.target.value)}
                  placeholder="Enter Admin@123456"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Required to prevent unauthorized workstation modification.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowReconfigModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reconfigLoading}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center space-x-1.5 disabled:opacity-50"
                >
                  {reconfigLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save & Bind System</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
