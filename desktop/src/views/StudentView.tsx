import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { ApiClient } from '../services/api';
import { LocalDbService } from '../db/localDb';
import {
  Shield,
  Keyboard,
  Mouse,
  Monitor,
  Clock,
  AlertTriangle,
  Power,
  CheckCircle2,
  X,
  Minimize2,
  Maximize2,
  FileText,
  User,
  Building2,
  Cpu,
  HardDrive,
  Check,
  History,
  Sparkles,
  Layers,
  HelpCircle,
  Calendar,
  BookOpen
} from 'lucide-react';
import { Equipment, Session, Issue } from '../../../shared/types';
import { PeripheralScanner } from '../services/peripheralScanner';
import { NativeHardwareStatus } from '../services/native';

export const StudentView: React.FC = () => {
  const { user, isOnline, pcIdentity, requestShutdown, abortShutdown, logout } = useAuth();

  // Navigation & View Mode
  const [activeTab, setActiveTab] = useState<'overview' | 'issues' | 'history' | 'profile'>('overview');
  const [isHudMode, setIsHudMode] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const countdownTimerRef = React.useRef<any>(null);

  // Student Dashboard & Data Stores
  const [dashboardData, setDashboardData] = useState<any | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [workstationEquipment, setWorkstationEquipment] = useState<Equipment[]>([]);
  const [hwStatus, setHwStatus] = useState<NativeHardwareStatus>(PeripheralScanner.getStatus());
  const [myIssues, setMyIssues] = useState<Issue[]>([]);
  const [sessionHistory, setSessionHistory] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = PeripheralScanner.subscribe((status) => {
      setHwStatus(status);
    });
    return () => {
      unsub();
    };
  }, []);

  // End session & shutdown confirmation modal
  const [showEndModal, setShowEndModal] = useState(false);
  const [shutdownInitiated, setShutdownInitiated] = useState(false);
  const [countdown, setCountdown] = useState(10);

  // Issue reporting modal
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueType, setIssueType] = useState('Keyboard Problem');
  const [issueDesc, setIssueDesc] = useState('');
  const [issueSubmitted, setIssueSubmitted] = useState(false);
  const [issueLoading, setIssueLoading] = useState(false);

  // Load student dashboard (online with local SQLite fallback)
  const loadStudentData = async () => {
    setLoading(true);
    try {
      if (isOnline) {
        const res = await ApiClient.request('/student/dashboard');
        if (res.success && res.data) {
          setDashboardData(res.data);
          if (res.data.activeSession) {
            setSession(res.data.activeSession);
            const startMs = new Date(res.data.activeSession.startedAt).getTime();
            const elapsed = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
            setSeconds(elapsed);
          }
          if (res.data.workstationEquipment) {
            setWorkstationEquipment(res.data.workstationEquipment);
          }
          if (res.data.myReportedIssues) {
            setMyIssues(res.data.myReportedIssues);
          }
          if (res.data.myRecentSessions) {
            setSessionHistory(res.data.myRecentSessions);
          }
          return;
        }
      }

      // Offline mode or network fallback: read from local SQLite
      if (user?.id) {
        const offlineData = await LocalDbService.getStudentDashboardData(user.id);
        setDashboardData({
          studentProfile: user,
          currentWorkstation: {
            labCode: pcIdentity?.lab_code || 'LAB-01',
            pcCode: pcIdentity?.pc_code || 'PC-01'
          },
          activeSession: offlineData.activeSession,
          workstationEquipment: offlineData.workstationEquipment,
          myReportedIssues: offlineData.myReportedIssues,
          myRecentSessions: offlineData.myRecentSessions
        });
        if (offlineData.activeSession) {
          setSession(offlineData.activeSession as any);
          const startMs = new Date(offlineData.activeSession.started_at).getTime();
          const elapsed = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
          setSeconds(elapsed);
        }
        if (offlineData.workstationEquipment) {
          setWorkstationEquipment(offlineData.workstationEquipment as any);
        }
        if (offlineData.myReportedIssues) {
          setMyIssues(offlineData.myReportedIssues as any);
        }
        if (offlineData.myRecentSessions) {
          setSessionHistory(offlineData.myRecentSessions as any);
        }
      }
    } catch (e) {
      console.error('Failed to load student dashboard:', e);
    } finally {
      setLoading(false);
    }
  };

  // Initialize or start student session if not already running
  useEffect(() => {
    const initSession = async () => {
      if (isOnline) {
        const startRes = await ApiClient.request('/sessions/start', {
          method: 'POST',
          body: JSON.stringify({
            labCode: pcIdentity?.lab_code || 'LAB-01',
            pcCode: pcIdentity?.pc_code || 'PC-01',
            clientId: pcIdentity?.client_id || 'CLIENT-PC01'
          })
        });

        if (startRes.success && startRes.data) {
          setSession(startRes.data);
          await loadStudentData();
          return;
        } else if (startRes.data) {
          setSession(startRes.data);
          await loadStudentData();
          return;
        }
      }

      // Offline or network error: start session in local SQLite
      if (user?.id) {
        const activeLocal = await LocalDbService.getActiveLocalSession(user.id);
        if (activeLocal) {
          setSession(activeLocal as any);
        } else {
          const newSession = await LocalDbService.startLocalSession({
            studentId: user.id,
            studentName: user.fullName,
            studentIdentifier: user.identifier || user.email,
            labCode: pcIdentity?.lab_code || 'LAB-01',
            pcCode: pcIdentity?.pc_code || 'PC-01',
            clientId: pcIdentity?.client_id || 'CLIENT-PC01'
          });
          setSession(newSession as any);
        }
      }

      await loadStudentData();
    };

    initSession();
  }, [pcIdentity, isOnline]);

  // Real-time Session Timer Ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600)
      .toString()
      .padStart(2, '0');
    const mins = Math.floor((totalSec % 3600) / 60)
      .toString()
      .padStart(2, '0');
    const secs = (totalSec % 60).toString().padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
  };

  // Safe End Session & Automatic Workstation Shutdown
  const handleEndSessionAndShutdown = async () => {
    if (!session) return;
    setShutdownInitiated(true);

    try {
      // Record session termination locally in SQLite and enqueue for sync
      await LocalDbService.endLocalSession(session.id, 'SHUTDOWN');

      if (isOnline) {
        // End session via API
        await ApiClient.request('/sessions/end', {
          method: 'POST',
          body: JSON.stringify({
            sessionId: session.id,
            endMode: 'SHUTDOWN'
          })
        });
      }

      // Request safe Windows automatic shutdown via native Tauri command
      await requestShutdown(session.id);
    } catch (e) {
      console.warn('Session end completed, proceeding with client shutdown');
    }

    // 10s countdown visual before power off
    setShutdownInitiated(true);
    let count = 10;
    setCountdown(10);
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }
    countdownTimerRef.current = setInterval(() => {
      count -= 1;
      setCountdown(count);
      if (count <= 0) {
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
        logout();
      }
    }, 1000);
  };

  const handleAbortShutdown = async () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    await abortShutdown();
    setShutdownInitiated(false);
    setShowEndModal(false);
    setCountdown(10);
  };

  // Submit Issue Report
  const handleReportIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueDesc.trim()) return;

    setIssueLoading(true);
    try {
      const payload = {
        labCode: session?.labCode || (session as any)?.lab_code || pcIdentity?.lab_code || 'LAB-01',
        pcCode: session?.pcCode || (session as any)?.pc_code || pcIdentity?.pc_code || 'PC-01',
        issueType,
        description: issueDesc,
        sessionId: session?.id
      };

      if (isOnline) {
        const res = await ApiClient.request('/issues', {
          method: 'POST',
          body: JSON.stringify(payload)
        });

        if (res.success) {
          setIssueSubmitted(true);
          setTimeout(() => {
            setIssueSubmitted(false);
            setShowIssueModal(false);
            setIssueDesc('');
            loadStudentData();
          }, 1200);
          return;
        }
      }

      // Offline reporting via local SQLite
      await LocalDbService.createLocalIssue({
        labCode: payload.labCode,
        pcCode: payload.pcCode,
        reportedBy: user?.id,
        issueType: payload.issueType,
        description: payload.description
      });

      setIssueSubmitted(true);
      setTimeout(() => {
        setIssueSubmitted(false);
        setShowIssueModal(false);
        setIssueDesc('');
        loadStudentData();
      }, 1200);
    } finally {
      setIssueLoading(false);
    }
  };

  const currentPc = dashboardData?.currentWorkstation;
  const studentProf = dashboardData?.studentProfile;

  // --------------------------------------------------------------------------
  // COMPACT FLOATING HUD MODE
  // --------------------------------------------------------------------------
  if (isHudMode) {
    return (
      <div className="fixed top-4 right-4 z-50 bg-slate-900/95 backdrop-blur-md border border-blue-500/60 rounded-2xl shadow-2xl p-3 flex items-center space-x-4 select-none text-white animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center space-x-2.5 border-r border-slate-700 pr-3">
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shadow-xs">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] font-black text-blue-400 tracking-wider">LABGUARD HUD</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <p className="text-xs font-black text-slate-100">
              {session?.labCode || pcIdentity?.lab_code || 'LAB-01'} • {session?.pcCode || pcIdentity?.pc_code || 'PC-01'}
            </p>
          </div>
        </div>

        <div>
          <p className="text-[10px] text-slate-400 font-semibold">{user?.fullName || 'Student'}</p>
          <div className="flex items-center space-x-2">
            <span className="font-mono text-sm font-black text-blue-400">{formatTimer(seconds)}</span>
            <span className="text-[10px] text-emerald-400 font-bold">● Active</span>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 pl-2">
          <button
            onClick={() => setIsHudMode(false)}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
            title="Maximize View"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowEndModal(true)}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center space-x-1 transition-colors"
          >
            <Power className="w-3.5 h-3.5" />
            <span>End</span>
          </button>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // STANDARD FULL WINDOW WORKSTATION CONSOLE
  // --------------------------------------------------------------------------
  return (
    <div className="flex-1 flex flex-col bg-slate-100 overflow-hidden font-sans">
      {/* Institutional Student Session Top Header */}
      <div className="bg-slate-900 border-b border-slate-800 text-white px-6 py-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-xs">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-sm tracking-wide">LABGUARD STUDENT WORKSTATION</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-600/20 text-blue-300 border border-blue-500/30">
                ACTIVE LAB TERMINAL
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Terminal: <span className="font-bold text-slate-200">{session?.labCode || pcIdentity?.lab_code || 'LAB-01'} • {session?.pcCode || pcIdentity?.pc_code || 'PC-01'}</span>
              {' '}• Authorized Student Access
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsHudMode(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 cursor-pointer transition-colors shadow-xs"
          >
            <Minimize2 className="w-3.5 h-3.5 text-blue-400" />
            <span>Minimize to HUD</span>
          </button>

          <button
            onClick={() => setShowIssueModal(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold rounded-xl cursor-pointer transition-colors shadow-xs"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>Report Issue</span>
          </button>

          <button
            onClick={() => setShowEndModal(true)}
            className="flex items-center space-x-1.5 px-4 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer transition-colors"
          >
            <Power className="w-3.5 h-3.5" />
            <span>End Session &amp; Shut Down</span>
          </button>
        </div>
      </div>

      {/* Tab Navigation Strip */}
      <div className="bg-white border-b border-slate-200 px-6 pt-2 flex space-x-1 overflow-x-auto shadow-xs">
        {[
          { id: 'overview', label: 'My Session & Workstation', icon: Sparkles },
          { id: 'issues', label: 'My Reported Issues', icon: AlertTriangle, badge: myIssues.length },
          { id: 'history', label: 'Session History', icon: History, badge: sessionHistory.length },
          { id: 'profile', label: 'Student Institutional Profile', icon: User }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold rounded-t-lg border-b-2 cursor-pointer transition-all whitespace-nowrap ${
                isActive
                  ? 'border-blue-600 text-blue-800 bg-blue-50/50'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {typeof tab.badge === 'number' && tab.badge > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* ================================================================= */}
        {/* TAB 1: OVERVIEW & ACTIVE SESSION */}
        {/* ================================================================= */}
        {activeTab === 'overview' && (
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Active Session Hero Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    ACTIVE LAB SESSION
                  </span>
                  <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Workstation Protected</span>
                  </span>
                </div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  {user?.fullName || 'Enrolled Student User'}
                </h2>
                <p className="text-xs text-slate-500">
                  Identifier: <span className="font-mono font-bold text-slate-800">{user?.identifier || 'STU-2026-001'}</span>
                  {' '}• Dept: <span className="font-semibold text-slate-700">{studentProf?.department || 'Computer Science & Engineering'}</span>
                  {' '}• Program: <span className="font-semibold text-slate-700">{studentProf?.course || 'B.Tech'}</span>
                </p>
                <div className="flex items-center space-x-2 text-xs pt-1">
                  <span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-slate-700">
                    Year {studentProf?.yearOfStudy || 3} • Sem {studentProf?.semester || 5} • Sec {studentProf?.section || 'A'}
                  </span>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-500 font-medium">Session ID: {session?.id?.slice(0, 8) || 'SYNCING'}</span>
                </div>
              </div>

              {/* Large Monospace Timer Display */}
              <div className="bg-slate-900 text-white rounded-2xl px-8 py-5 text-center shadow-md border border-slate-800 flex flex-col items-center justify-center">
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block mb-1">
                  Live Elapsed Duration
                </span>
                <div className="font-mono text-4xl font-black text-blue-400 tracking-tight">
                  {formatTimer(seconds)}
                </div>
                <span className="text-[10px] text-slate-400 block mt-1.5">
                  Logged on {session?.startedAt ? new Date(session.startedAt).toLocaleTimeString() : 'Current Session'}
                </span>
              </div>
            </div>

            {/* Workstation Hardware Node Specs Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Monitor className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Assigned Workstation Terminal Specifications
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700">
                  {currentPc?.clientId || `CLIENT-${session?.pcCode || 'PC01'}`}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">Workstation Node</span>
                  <span className="font-bold text-slate-900 text-sm">{session?.labCode || 'LAB-01'} • {session?.pcCode || 'PC-01'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">IP Address</span>
                  <span className="font-mono font-bold text-slate-800">
                    {currentPc?.ipAddress || '192.168.1.101'}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">Terminal Hostname</span>
                  <span className="font-mono font-bold text-slate-800">
                    {currentPc?.hostname || 'LAB01-WS-01'}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">Client Status</span>
                  <span className="font-bold text-emerald-600 flex items-center space-x-1 mt-0.5">
                    <Check className="w-3.5 h-3.5" />
                    <span>Operational (Online)</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Verified Hardware Environment Peripherals Grid */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Verified Hardware Environment &amp; Peripherals
                </h3>
                <span className="text-xs text-slate-500">
                  {workstationEquipment.length > 0 ? workstationEquipment.length : 3} Physical Peripherals Monitored
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {workstationEquipment.length === 0 ? (
                  <>
                    {/* Live Physical Peripherals Detection */}
                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 text-slate-700">
                          <Keyboard className="w-4 h-4 text-blue-600" />
                          <span className="text-xs font-bold uppercase tracking-wider">Keyboard</span>
                        </div>
                        <span className={`w-2.5 h-2.5 rounded-full ${hwStatus.keyboard_connected ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`} />
                      </div>
                      <p className="text-sm font-bold text-slate-900 truncate">{hwStatus.keyboard_name || 'Standard Keyboard'}</p>
                      <p className="text-[11px] text-slate-500">Telemetry: Sub-second Hardware Poll</p>
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        hwStatus.keyboard_connected ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}>
                        {hwStatus.keyboard_connected ? '✓ Verified & Connected' : '⚠️ Disconnected / Missing'}
                      </span>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 text-slate-700">
                          <Mouse className="w-4 h-4 text-blue-600" />
                          <span className="text-xs font-bold uppercase tracking-wider">Mouse</span>
                        </div>
                        <span className={`w-2.5 h-2.5 rounded-full ${hwStatus.mouse_connected ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`} />
                      </div>
                      <p className="text-sm font-bold text-slate-900 truncate">{hwStatus.mouse_name || 'Pointing Device'}</p>
                      <p className="text-[11px] text-slate-500">Telemetry: Sub-second Hardware Poll</p>
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        hwStatus.mouse_connected ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}>
                        {hwStatus.mouse_connected ? '✓ Verified & Connected' : '⚠️ Disconnected / Missing'}
                      </span>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 text-slate-700">
                          <Monitor className="w-4 h-4 text-blue-600" />
                          <span className="text-xs font-bold uppercase tracking-wider">Display</span>
                        </div>
                        <span className={`w-2.5 h-2.5 rounded-full ${hwStatus.monitor_connected ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`} />
                      </div>
                      <p className="text-sm font-bold text-slate-900 truncate">{hwStatus.monitor_name || 'Primary Display'}</p>
                      <p className="text-[11px] text-slate-500">Telemetry: Win32 Display Bus</p>
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        hwStatus.monitor_connected ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}>
                        {hwStatus.monitor_connected ? '✓ Signal Active' : '⚠️ No Signal / Disconnected'}
                      </span>
                    </div>
                  </>
                ) : (
                  workstationEquipment.map((eq) => (
                    <div key={eq.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 text-slate-700">
                          {eq.type === 'KEYBOARD' ? (
                            <Keyboard className="w-4 h-4 text-blue-600" />
                          ) : eq.type === 'MOUSE' ? (
                            <Mouse className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Monitor className="w-4 h-4 text-blue-600" />
                          )}
                          <span className="text-xs font-bold uppercase tracking-wider">{eq.type}</span>
                        </div>
                        <span
                          className={`w-2 h-2 rounded-full ${
                            eq.status === 'FUNCTIONAL' || eq.status === 'AVAILABLE'
                              ? 'bg-emerald-500'
                              : 'bg-amber-500'
                          }`}
                        />
                      </div>
                      <p className="text-sm font-bold text-slate-900">{eq.brand} {eq.model}</p>
                      <p className="text-[11px] text-slate-500 font-mono">Asset: {eq.assetTag} • SN: {eq.serialNumber || 'N/A'}</p>
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          eq.status === 'FUNCTIONAL' || eq.status === 'AVAILABLE'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {eq.status === 'FUNCTIONAL' ? '✓ Verified & Functional' : eq.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Laboratory Guidelines Box */}
            <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-5 text-xs text-blue-950 space-y-2">
              <h4 className="font-bold flex items-center space-x-1.5 text-blue-900">
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
                <span>Laboratory Guidelines &amp; Student Accountability Policy</span>
              </h4>
              <ul className="list-disc list-inside space-y-1 text-blue-800/90 leading-relaxed">
                <li>All USB peripherals (keyboard, mouse, headsets) are tracked in real time. Removing or disconnecting devices will immediately trigger an institutional telemetry alert to the Lab Assistant.</li>
                <li>Ending your session automatically powers off this workstation terminal after a 10-second safety countdown to conserve campus energy.</li>
                <li>If you encounter a sticky key, unresponsive mouse, or monitor flickering, use the <strong>Report Issue</strong> button above to immediately dispatch laboratory maintenance.</li>
              </ul>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: MY REPORTED ISSUES */}
        {/* ================================================================= */}
        {activeTab === 'issues' && (
          <div className="max-w-5xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">My Reported Issues &amp; Defect Tickets</h2>
                <p className="text-xs text-slate-500">Track resolution status and notes from laboratory assistants and technicians</p>
              </div>
              <button
                onClick={() => setShowIssueModal(true)}
                className="flex items-center space-x-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Report Problem</span>
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-bold text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Workstation</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Problem Description</th>
                    <th className="px-4 py-3">Date Reported</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {myIssues.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                        You have not reported any issues. All peripherals operating normally.
                      </td>
                    </tr>
                  ) : (
                    myIssues.map((i) => (
                      <tr key={i.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-bold text-slate-900">
                          {i.labCode} • {i.pcCode}
                        </td>
                        <td className="px-4 py-3 font-semibold text-rose-600">{i.issueType}</td>
                        <td className="px-4 py-3 text-slate-700 max-w-sm">{i.description}</td>
                        <td className="px-4 py-3 text-slate-400 font-mono text-[11px]">
                          {new Date(i.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                              i.status === 'RESOLVED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : i.status === 'MAINTENANCE'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {i.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: SESSION HISTORY */}
        {/* ================================================================= */}
        {activeTab === 'history' && (
          <div className="max-w-5xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Personal Lab Session History</h2>
                <p className="text-xs text-slate-500">Immutable ledger of your completed laboratory workstation sessions</p>
              </div>

              <div className="flex items-center space-x-3 text-xs">
                <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl shadow-xs">
                  <span className="text-slate-500 font-medium">Completed: </span>
                  <span className="font-bold text-slate-900">{dashboardData?.totalCompletedSessions || sessionHistory.length}</span>
                </div>
                <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl shadow-xs">
                  <span className="text-slate-500 font-medium">Total Time: </span>
                  <span className="font-bold text-blue-700">{dashboardData?.totalTimeMinutes || 0} mins</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-bold text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Workstation</th>
                    <th className="px-4 py-3">Facility</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Start Time</th>
                    <th className="px-4 py-3">End Time</th>
                    <th className="px-4 py-3">Exit Mode</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sessionHistory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                        No prior completed sessions found in institutional records.
                      </td>
                    </tr>
                  ) : (
                    sessionHistory.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-bold text-slate-900">{s.pcCode}</td>
                        <td className="px-4 py-3 font-semibold text-slate-700">{s.labCode}</td>
                        <td className="px-4 py-3 text-slate-600 font-mono text-[11px]">
                          {new Date(s.startedAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                          {new Date(s.startedAt).toLocaleTimeString()}
                        </td>
                        <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                          {s.endedAt ? new Date(s.endedAt).toLocaleTimeString() : 'N/A'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              s.endMode === 'FORCED_END'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {s.endMode || 'NORMAL'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 4: STUDENT INSTITUTIONAL PROFILE */}
        {/* ================================================================= */}
        {activeTab === 'profile' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Institutional Student Profile</h2>
              <p className="text-xs text-slate-500">Official academic enrollment, student credential ID, and authorized labs</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
              <div className="flex items-center space-x-4 pb-6 border-b border-slate-100">
                <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-xl shadow-md">
                  {user?.fullName?.slice(0, 2).toUpperCase() || 'ST'}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{user?.fullName}</h3>
                  <p className="text-xs text-slate-500">
                    Institutional Student • <span className="font-mono font-bold text-slate-800">{user?.identifier}</span>
                  </p>
                  <p className="text-xs text-blue-600 font-semibold mt-0.5">{user?.email}</p>
                </div>
              </div>

              {/* Academic Placement */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Academic Placement</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Department</span>
                    <span className="font-bold text-slate-900">{studentProf?.department || 'Computer Science & Engineering'}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Degree Program</span>
                    <span className="font-bold text-slate-900">{studentProf?.course || 'B.Tech in Computer Science'}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Academic Year</span>
                    <span className="font-bold text-slate-900">{studentProf?.academicYear || '2025-2026'}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Year of Study</span>
                    <span className="font-bold text-slate-900">Year {studentProf?.yearOfStudy || 3}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Semester</span>
                    <span className="font-bold text-slate-900">Semester {studentProf?.semester || 5}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Cohort Section</span>
                    <span className="font-bold text-slate-900">Section {studentProf?.section || 'A'}</span>
                  </div>
                </div>
              </div>

              {/* Authorized Laboratories */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Authorized Facilities</h4>
                <div className="flex flex-wrap gap-2">
                  {(((user as any)?.assignedLabs as string[]) || ['LAB-01', 'LAB-02']).map((labCode: string) => (
                    <span
                      key={labCode}
                      className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs font-bold"
                    >
                      {labCode}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ================================================================= */}
      {/* REPORT ISSUE MODAL */}
      {/* ================================================================= */}
      {showIssueModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleReportIssue}
            className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2 text-amber-600">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900">Report Workstation Defect</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowIssueModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {issueSubmitted ? (
              <div className="py-6 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-900">Issue Dispatched!</h4>
                <p className="text-xs text-slate-500">
                  Laboratory Assistant has been notified. A technician will assist you shortly.
                </p>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Workstation Node:</label>
                  <div className="p-2.5 bg-slate-100 rounded-lg font-bold text-slate-800">
                    {session?.labCode || 'LAB-01'} • {session?.pcCode || 'PC-01'}
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Problem Category:</label>
                  <select
                    value={issueType}
                    onChange={(e) => setIssueType(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 font-bold"
                  >
                    <option value="Keyboard Problem">Keyboard Problem (Sticky key / unresponsive)</option>
                    <option value="Mouse Problem">Mouse Problem (Pointer erratic / scroll broken)</option>
                    <option value="Device Not Detected">Device Not Detected (Port unrecognized)</option>
                    <option value="Cable Problem">Cable Problem (Loose connector / frayed wire)</option>
                    <option value="Physical Damage Reported">Physical Damage Reported</option>
                    <option value="Other">Other Operational Issue</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Detailed Description:</label>
                  <textarea
                    rows={3}
                    required
                    value={issueDesc}
                    onChange={(e) => setIssueDesc(e.target.value)}
                    placeholder="Describe the issue clearly so the lab assistant can bring a replacement..."
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50"
                  />
                </div>

                <div className="pt-2 flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowIssueModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={issueLoading || !issueDesc.trim()}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {issueLoading ? 'Submitting...' : 'Dispatch Ticket'}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      )}

      {/* ================================================================= */}
      {/* END SESSION & AUTOMATIC SHUTDOWN MODAL */}
      {/* ================================================================= */}
      {showEndModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-sm">
              <Power className="w-7 h-7" />
            </div>

            {shutdownInitiated ? (
              <div className="space-y-4 py-2">
                <h3 className="text-lg font-black text-slate-900">Session Closed — Powering Off</h3>
                <p className="text-xs text-slate-500">
                  Your lab attendance has been successfully recorded. Workstation will safely shut down in:
                </p>
                <div className="flex items-center justify-center space-x-2">
                  <div className="text-5xl font-mono font-black text-rose-600 animate-pulse tracking-tight">
                    {countdown}s
                  </div>
                </div>
                {/* Visual Progress Countdown Meter */}
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-rose-600 h-full transition-all duration-1000 ease-linear"
                    style={{ width: `${(countdown / 10) * 100}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  Windows automatic shutdown command dispatched to native system subsystem.
                </p>
                <div className="pt-2">
                  <button
                    onClick={handleAbortShutdown}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-colors border border-slate-300"
                  >
                    Cancel &amp; Resume Session
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <h3 className="text-lg font-black text-slate-900">End Session &amp; Power Off?</h3>
                  <p className="text-xs text-slate-500">
                    Are you ready to conclude your lab session on{' '}
                    <span className="font-bold text-slate-800">
                      {session?.labCode || 'LAB-01'} • {session?.pcCode || 'PC-01'}
                    </span>
                    ?
                  </p>
                  <p className="text-[11px] text-rose-600 font-semibold pt-1">
                    Ending your session will automatically shut down this workstation to conserve institutional energy.
                  </p>
                </div>

                <div className="pt-2 flex space-x-2">
                  <button
                    onClick={() => setShowEndModal(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-colors"
                  >
                    Stay Logged In
                  </button>
                  <button
                    onClick={handleEndSessionAndShutdown}
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl cursor-pointer shadow-xs transition-colors"
                  >
                    Yes, End &amp; Shut Down
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
