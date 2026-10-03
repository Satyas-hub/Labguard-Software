import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ApiClient } from '../services/api';
import { NativeService, NativeHardwareStatus } from '../services/native';
import { PeripheralScanner, PeripheralAlert } from '../services/peripheralScanner';
import { APP_VERSION } from '../config/version';
import {
  Shield,
  Keyboard,
  Mouse,
  Monitor,
  Clock,
  AlertTriangle,
  Power,
  CheckCircle2,
  Minus,
  Square,
  Maximize2,
  Minimize2,
  User,
  Building2,
  RefreshCw,
  HelpCircle,
  AlertCircle
} from 'lucide-react';

export const StudentMiniPopup: React.FC = () => {
  const { user, pcIdentity, logout, requestShutdown, abortShutdown } = useAuth();

  // Elapsed Session Time
  const [seconds, setSeconds] = useState(0);

  // Live Hardware Peripherals Status
  const [hwStatus, setHwStatus] = useState<NativeHardwareStatus>({
    keyboard_connected: true,
    mouse_connected: true,
    monitor_connected: true,
    keyboard_name: 'Standard Keyboard',
    mouse_name: 'Pointing Device',
    monitor_name: 'Display Monitor',
    timestamp: new Date().toISOString()
  });
  const [peripheralAlert, setPeripheralAlert] = useState<PeripheralAlert | null>(null);

  // Expanded View State
  const [isMaximized, setIsMaximized] = useState(false);

  // End Session Confirmation Modal
  const [showEndModal, setShowEndModal] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [shutdownInitiated, setShutdownInitiated] = useState(false);
  const countdownTimerRef = React.useRef<any>(null);

  // Issue Reporting Modal
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueType, setIssueType] = useState('Hardware Disconnected');
  const [issueDesc, setIssueDesc] = useState('');
  const [submittingIssue, setSubmittingIssue] = useState(false);
  const [issueSuccess, setIssueSuccess] = useState(false);

  // Initialize Native Window Mode for Student Popup
  useEffect(() => {
    NativeService.setWindowStudentPopupMode().catch(() => {});
  }, []);

  // Timer Tick
  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Peripheral Auto-Scanner Subscription
  useEffect(() => {
    if (pcIdentity) {
      PeripheralScanner.setPcIdentity(pcIdentity);
    }
    const unsubscribe = PeripheralScanner.subscribe((status, alert) => {
      setHwStatus(status);
      setPeripheralAlert(alert);
    });
    return () => unsubscribe();
  }, [pcIdentity]);

  // Window Controls
  const handleMinimize = async () => {
    await NativeService.minimizeWindow();
  };

  const handleToggleMaximize = async () => {
    setIsMaximized(prev => !prev);
    await NativeService.maximizeWindow();
  };

  // Format Elapsed Time
  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Safe End Session Routine
  const handleInitiateEndSession = () => {
    setShowEndModal(true);
    setCountdown(10);
    setShutdownInitiated(true);

    requestShutdown(user?.id || 'session-current').catch(() => {});

    countdownTimerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownTimerRef.current);
          logout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleAbortShutdown = async () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }
    await abortShutdown();
    setShowEndModal(false);
    setShutdownInitiated(false);
  };

  // Submit Issue
  const handleReportIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueDesc.trim()) return;
    setSubmittingIssue(true);
    try {
      await ApiClient.request('/issues', {
        method: 'POST',
        body: JSON.stringify({
          labCode: pcIdentity?.lab_code || 'UNASSIGNED',
          pcCode: pcIdentity?.pc_code || 'UNASSIGNED',
          issueType,
          description: issueDesc.trim(),
          severity: 'HIGH'
        })
      });
      setIssueSuccess(true);
      setTimeout(() => {
        setIssueSuccess(false);
        setShowIssueModal(false);
        setIssueDesc('');
      }, 1500);
    } catch {
      // Ignored
    } finally {
      setSubmittingIssue(false);
    }
  };

  return (
    <div className="h-screen w-screen bg-slate-950/80 backdrop-blur-2xl text-slate-100 flex flex-col justify-between overflow-hidden select-none border border-slate-700/50 shadow-2xl relative">
      <div className="absolute top-0 left-[-20%] w-[140%] h-[140%] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />
      {/* Dynamic Custom Title Bar */}
      <div
        data-tauri-drag-region
        className="h-10 bg-slate-900/40 border-b border-slate-700/50 px-3 flex items-center justify-between shrink-0 select-none backdrop-blur-md"
      >
        <div className="flex items-center gap-2 pointer-events-none">
          <div className="w-5 h-5 rounded-md bg-blue-600/20 border border-blue-500/30 flex items-center justify-center p-0.5">
            <img
              src="/assets/logo.png"
              alt="Logo"
              className="w-full h-full object-contain"
              onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
            />
          </div>
          <span className="font-extrabold text-xs tracking-tight text-white flex items-center gap-1.5">
            LABGUARD <span className="text-[10px] text-blue-400 font-mono">v{APP_VERSION}</span>
          </span>
          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            ACTIVE SESSION
          </span>
        </div>

        {/* Window Controls: MINIMIZE and MAXIMIZE present, CLOSE button NOT present */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleMinimize}
            className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Minimize Panel to Taskbar"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleToggleMaximize}
            className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title={isMaximized ? 'Restore Compact Widget' : 'Maximize Panel'}
          >
            {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          {/* Note: CLOSE button is intentionally omitted per security requirements */}
        </div>
      </div>

      {/* Main Mini Panel Body */}
      <div className="flex-1 p-4 flex flex-col justify-between overflow-y-auto space-y-3">
        {/* Student & Workstation Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-sm">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-white truncate max-w-[200px]">
                  {user?.fullName || 'Student User'}
                </h2>
                <p className="text-[11px] font-mono text-slate-400">
                  ID: <span className="text-blue-400 font-semibold">{user?.identifier || 'STU-SESSION'}</span>
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-500 font-semibold uppercase">Assigned PC</div>
              <div className="text-xs font-mono font-extrabold text-amber-400">
                {pcIdentity?.lab_code || 'LAB-01'} • {pcIdentity?.pc_code || 'PC-01'}
              </div>
            </div>
          </div>

          {/* Live Elapsed Session Timer */}
          <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold text-slate-300">Session Duration</span>
            </div>
            <span className="font-mono text-base font-bold text-emerald-400 tracking-wider">
              {formatTime(seconds)}
            </span>
          </div>
        </div>

        {/* Live Continuous Peripheral Scanning Box */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold text-slate-300 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-blue-400" />
              Continuous Hardware Scanner
            </span>
            <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Active
            </span>
          </div>

          {/* 3 Peripherals Grid */}
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            {/* Keyboard */}
            <div className={`p-2 rounded-lg border text-center transition-all ${
              hwStatus.keyboard_connected
                ? 'bg-slate-950 border-slate-800 text-slate-300'
                : 'bg-rose-950/40 border-rose-500/50 text-rose-300 animate-pulse'
            }`}>
              <div className="flex items-center justify-center mb-1">
                <Keyboard className={`w-4 h-4 ${hwStatus.keyboard_connected ? 'text-blue-400' : 'text-rose-400'}`} />
              </div>
              <div className="font-semibold truncate">Keyboard</div>
              <div className={`text-[9px] font-mono mt-0.5 ${hwStatus.keyboard_connected ? 'text-emerald-400' : 'text-rose-400 font-bold'}`}>
                {hwStatus.keyboard_connected ? 'OK ✓' : 'DISCONNECTED'}
              </div>
            </div>

            {/* Mouse */}
            <div className={`p-2 rounded-lg border text-center transition-all ${
              hwStatus.mouse_connected
                ? 'bg-slate-950 border-slate-800 text-slate-300'
                : 'bg-rose-950/40 border-rose-500/50 text-rose-300 animate-pulse'
            }`}>
              <div className="flex items-center justify-center mb-1">
                <Mouse className={`w-4 h-4 ${hwStatus.mouse_connected ? 'text-blue-400' : 'text-rose-400'}`} />
              </div>
              <div className="font-semibold truncate">Mouse</div>
              <div className={`text-[9px] font-mono mt-0.5 ${hwStatus.mouse_connected ? 'text-emerald-400' : 'text-rose-400 font-bold'}`}>
                {hwStatus.mouse_connected ? 'OK ✓' : 'DISCONNECTED'}
              </div>
            </div>

            {/* Monitor */}
            <div className={`p-2 rounded-lg border text-center transition-all ${
              hwStatus.monitor_connected
                ? 'bg-slate-950 border-slate-800 text-slate-300'
                : 'bg-rose-950/40 border-rose-500/50 text-rose-300 animate-pulse'
            }`}>
              <div className="flex items-center justify-center mb-1">
                <Monitor className={`w-4 h-4 ${hwStatus.monitor_connected ? 'text-blue-400' : 'text-rose-400'}`} />
              </div>
              <div className="font-semibold truncate">Display</div>
              <div className={`text-[9px] font-mono mt-0.5 ${hwStatus.monitor_connected ? 'text-emerald-400' : 'text-rose-400 font-bold'}`}>
                {hwStatus.monitor_connected ? 'OK ✓' : 'DISCONNECTED'}
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls: Report Issue & End Session */}
        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={() => setShowIssueModal(true)}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
            <span>Report Equipment Issue</span>
          </button>

          <button
            type="button"
            onClick={handleInitiateEndSession}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow-lg shadow-rose-900/30 transition-all cursor-pointer"
          >
            <Power className="w-4 h-4" />
            <span>End Lab Session & Logout</span>
          </button>
        </div>
      </div>

      {/* Footer Info */}
      <div className="h-7 bg-slate-900/60 border-t border-slate-800/80 px-3 flex items-center justify-between text-[10px] text-slate-500 shrink-0">
        <span>Windows Workstation Protected</span>
        <span className="font-mono">Close Disabled (Policy)</span>
      </div>

      {/* End Session Confirmation & Auto Shutdown Countdown Modal */}
      {showEndModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
              <Power className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Finalizing Student Session</h3>
              <p className="text-xs text-slate-400 mt-1">
                Your lab usage data has been saved. Workstation automatic power off in:
              </p>
              <div className="font-mono text-3xl font-extrabold text-rose-400 mt-2">
                {countdown}s
              </div>
            </div>
            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={handleAbortShutdown}
                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
              >
                Cancel / Stay Logged In
              </button>
              <button
                type="button"
                onClick={() => {
                  if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
                  logout();
                }}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white transition-colors cursor-pointer"
              >
                Logout Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Issue Modal */}
      {showIssueModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-bold text-white">Report Workstation Problem</span>
              <button
                type="button"
                onClick={() => setShowIssueModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>
            {issueSuccess ? (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center text-xs text-emerald-400">
                ✓ Issue submitted to Lab Assistant successfully!
              </div>
            ) : (
              <form onSubmit={handleReportIssue} className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Issue Type</label>
                  <select
                    value={issueType}
                    onChange={(e) => setIssueType(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  >
                    <option value="Hardware Disconnected">Hardware Disconnected</option>
                    <option value="Mouse Malfunction">Mouse Malfunction</option>
                    <option value="Keyboard Missing Keys">Keyboard Missing Keys</option>
                    <option value="Monitor Display Flickering">Monitor Display Flickering</option>
                    <option value="Network Offline">Network Offline</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Description</label>
                  <textarea
                    rows={3}
                    required
                    value={issueDesc}
                    onChange={(e) => setIssueDesc(e.target.value)}
                    placeholder="Describe the defect or problem..."
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowIssueModal(false)}
                    className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingIssue || !issueDesc.trim()}
                    className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold disabled:opacity-50"
                  >
                    {submittingIssue ? 'Submitting...' : 'Submit'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
