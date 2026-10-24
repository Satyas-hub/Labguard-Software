import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { LoginView } from './views/LoginView';
import { AdminView } from './views/AdminView';
import { FacultyView } from './views/FacultyView';
import { LabAssistantView } from './views/LabAssistantView';
import { StudentView } from './views/StudentView';
import { StudentMiniPopup } from './views/StudentMiniPopup';
import { PeripheralAlertBanner } from './components/PeripheralAlertBanner';
import { PeripheralScanner } from './services/peripheralScanner';
import { NativeService } from './services/native';
import { UnregisteredLockScreen } from './views/UnregisteredLockScreen';
import { ApiClient } from './services/api';
import { APP_VERSION } from './config/version';

import { StartupSequenceService, StartupStepStatus, StartupDiagnostic } from './services/startupSequence';

const MainRouter: React.FC = () => {
  const { user, role } = useAuth();
  const [pcIdentity, setPcIdentity] = useState<any>(null);
  const [loadingIdentity, setLoadingIdentity] = useState(true);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [startupSteps, setStartupSteps] = useState<StartupStepStatus[]>([
    { stage: 'STARTING_RUNTIME', label: 'Starting Runtime', detail: 'Waiting to initialize...', status: 'PENDING' },
    { stage: 'CHECK_ENDPOINT_IDENTITY', label: 'Checking Endpoint Identity', detail: 'Awaiting hardware binding...', status: 'PENDING' },
    { stage: 'CHECK_LAB_ASSIGNMENT', label: 'Checking LAB Assignment', detail: 'Awaiting seat verification...', status: 'PENDING' },
    { stage: 'CHECK_LOCAL_DATABASE', label: 'Checking Local Database', detail: 'Awaiting vault probe...', status: 'PENDING' },
    { stage: 'CHECK_AUTH_CACHE', label: 'Checking Authentication Cache', detail: 'Awaiting credential check...', status: 'PENDING' },
    { stage: 'CHECK_NETWORK', label: 'Checking Network', detail: 'Awaiting network probe...', status: 'PENDING' },
    { stage: 'SYNC_SECURITY_EVENTS', label: 'Synchronizing Security Events', detail: 'Awaiting event sync...', status: 'PENDING' },
    { stage: 'LOAD_SECURE_SESSION', label: 'Loading Secure Session', detail: 'Awaiting session policy...', status: 'PENDING' }
  ]);
  const [currentStepMessage, setCurrentStepMessage] = useState('Initializing LABGUARD v3.5.1 Boot Sequence...');

  // Window Mode & Kiosk Control based on current auth state & role
  useEffect(() => {
    if (!user || !role) {
      NativeService.setWindowLoginMode().catch(() => {});
    } else if (role === 'STUDENT') {
      NativeService.setWindowStudentPopupMode().catch(() => {});
    } else {
      NativeService.setWindowNormalMode().catch(() => {});
    }
  }, [user, role]);

  // Anti-tamper Keyboard Shortcut & Context Menu Interception Shield
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Block F11 (Fullscreen toggle), F12 (DevTools)
      if (e.key === 'F11' || e.key === 'F12') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      // Block Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C (Inspect Elements)
      if (e.ctrlKey && e.shiftKey && ['I', 'J', 'C', 'i', 'j', 'c'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      // Block Ctrl+U (View Page Source)
      if (e.ctrlKey && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      // Block Ctrl+R / F5 (Prevent accidental reload in kiosk)
      if ((e.ctrlKey && (e.key === 'r' || e.key === 'R')) || e.key === 'F5') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      // Block Alt+F4 for unauthenticated or student sessions
      if (e.altKey && e.key === 'F4') {
        if (!user || role === 'STUDENT') {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      // Disable right click inspection menu on kiosk / unauthenticated terminals
      if (!user || role === 'STUDENT') {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('contextmenu', handleContextMenu, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('contextmenu', handleContextMenu, true);
    };
  }, [user, role]);

  // Global continuous peripheral scanner activation across entire application
  useEffect(() => {
    if (pcIdentity) {
      PeripheralScanner.setPcIdentity(pcIdentity);
    }
    PeripheralScanner.start();
  }, [pcIdentity]);

  // Execute 4-Stage Startup Sequence on application boot
  useEffect(() => {
    let isMounted = true;

    const runBootSequence = async () => {
      const result = await StartupSequenceService.execute((stepUpdate, diag) => {
        if (!isMounted) return;
        setCurrentStepMessage(`${stepUpdate.label}: ${stepUpdate.detail}`);
        setStartupSteps(prev =>
          prev.map(s => (s.stage === stepUpdate.stage ? stepUpdate : s))
        );
      });

      if (isMounted) {
        if (result.diagnostic.pcIdentity) {
          setPcIdentity(result.diagnostic.pcIdentity);
        } else {
          // If none detected, initialize as clean unconfigured terminal (requiring registration/setup)
          const cleanId = {
            client_id: 'CLIENT-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
            lab_code: 'UNASSIGNED',
            pc_code: 'UNASSIGNED',
            is_registered: false,
            app_version: APP_VERSION,
            windows_version: 'Microsoft Windows 11 Pro 64-bit'
          };
          setPcIdentity(cleanId);
        }

        // Brief delay for visual polish before transitioning to login/lock screen
        setTimeout(() => {
          if (isMounted) setLoadingIdentity(false);
        }, 500);
      }
    };

    runBootSequence();

    return () => {
      isMounted = false;
    };
  }, []);

  // Periodic heartbeat with hardware telemetry
  useEffect(() => {
    if (!pcIdentity || !pcIdentity.is_registered) return;

    const sendHeartbeat = async () => {
      try {
        const hwStatus = PeripheralScanner.getStatus();

        const res = await ApiClient.request('/clients/heartbeat', {
          method: 'POST',
          body: JSON.stringify({
            clientId: pcIdentity.client_id,
            labCode: pcIdentity.lab_code,
            pcCode: pcIdentity.pc_code,
            app_version: pcIdentity.app_version || APP_VERSION,
            hardwareStatus: hwStatus
          })
        });

        const heartbeatRes = res as any;
        // If server directive says enforceLock because workstation is disabled or unregistered
        if (heartbeatRes.success && heartbeatRes.directive?.enforceLock && heartbeatRes.directive?.requiredState === 'UNREGISTERED') {
          setPcIdentity((prev: any) => ({ ...prev, is_registered: false }));
        }
      } catch (e) {
        // Silently tolerate offline intervals
      }
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 30000); // 30s heartbeat
    return () => clearInterval(interval);
  }, [pcIdentity]);

  if (loadingIdentity) {
    const completedCount = startupSteps.filter(s => s.status === 'COMPLETED' || s.status === 'WARNING').length;
    const runningIndex = startupSteps.findIndex(s => s.status === 'RUNNING');
    const activeWeight = runningIndex !== -1 ? 0.5 : 0;
    const progressPercent = Math.min(100, Math.round(((completedCount + activeWeight) / startupSteps.length) * 100));

    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-slate-100 p-6 overflow-hidden relative">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="w-full max-w-md dark-glass-panel rounded-2xl p-8 space-y-6 z-10 transition-all">
          {/* Header & Logo */}
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shadow-lg shadow-blue-500/20 p-1.5 backdrop-blur-md overflow-hidden">
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
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                LABGUARD <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-mono border border-blue-500/30">v{APP_VERSION}</span>
              </h1>
              <p className="text-xs text-slate-400 font-medium">Endpoint Protection & Lab Management</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-400 font-medium">
              <span>Boot Verification Sequence</span>
              <span className="font-mono text-blue-400">{progressPercent}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Step Sequence Checklist */}
          <div className="space-y-3 pt-1">
            {startupSteps.map((step, idx) => (
              <div
                key={step.stage}
                className={`p-3 rounded-lg border text-xs transition-all ${
                  step.status === 'RUNNING'
                    ? 'bg-blue-950/40 border-blue-500/40 shadow-sm'
                    : step.status === 'COMPLETED'
                    ? 'bg-slate-800/40 border-slate-700/50 text-slate-300'
                    : step.status === 'WARNING'
                    ? 'bg-amber-950/20 border-amber-500/30 text-amber-200'
                    : 'bg-slate-900/40 border-slate-800/50 text-slate-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{idx + 1}. {step.label}</span>
                  <span>
                    {step.status === 'RUNNING' && (
                      <span className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin inline-block" />
                    )}
                    {step.status === 'COMPLETED' && (
                      <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {step.status === 'WARNING' && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        OFFLINE
                      </span>
                    )}
                    {step.status === 'PENDING' && (
                      <span className="w-2 h-2 rounded-full bg-slate-700 inline-block" />
                    )}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1 truncate">
                  {step.detail}
                </div>
              </div>
            ))}
          </div>

          {/* Status Message Footer */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span className="truncate pr-2">{currentStepMessage}</span>
            <span className="text-slate-500 shrink-0">PORT 5000</span>
          </div>
        </div>
      </div>
    );
  }

  // Workstation Setup Wizard / Unregistered Lock Screen Enforcement
  if ((showSetupWizard || (pcIdentity && pcIdentity.is_registered === false && !showAdminLogin)) && !user) {
    return (
      <div className="h-screen w-screen flex flex-col bg-slate-950 overflow-hidden">
        <PeripheralAlertBanner />
        <UnregisteredLockScreen
          initialIdentity={pcIdentity}
          onGoToAdminLogin={() => {
            setShowSetupWizard(false);
            setShowAdminLogin(true);
          }}
          onBackToLogin={() => {
            setShowSetupWizard(false);
            setShowAdminLogin(false);
          }}
          onRegistered={(newIdentity) => {
            setPcIdentity(newIdentity);
            setShowSetupWizard(false);
            localStorage.setItem('labguard_pc_identity', JSON.stringify(newIdentity));
          }}
        />
      </div>
    );
  }

  if (!user || !role) {
    return (
      <div className="h-screen w-screen flex flex-col bg-slate-50 min-h-0 overflow-hidden select-none animate-in fade-in duration-300">
        <PeripheralAlertBanner />
        <Navbar />
        <LoginView
          initialRole={showAdminLogin ? 'ADMIN' : 'STUDENT'}
          onBackToLockScreen={pcIdentity && pcIdentity.is_registered === false ? () => setShowAdminLogin(false) : undefined}
          onOpenSetupWizard={() => setShowSetupWizard(true)}
        />
      </div>
    );
  }

  // Student Role: Mini Student Panel Popup with floating widget layout, elapsed timer, and no close button
  if (role === 'STUDENT') {
    return (
      <div className="h-screen w-screen overflow-hidden bg-slate-950 animate-in fade-in duration-300 flex flex-col">
        <PeripheralAlertBanner />
        <StudentMiniPopup />
      </div>
    );
  }

  // Institutional Staff Roles (Admin, Faculty, Lab Assistant): Full dashboard with standard window controls
  return (
    <div className="h-screen w-screen flex flex-col bg-slate-50 overflow-hidden animate-in fade-in duration-300 relative">
      {/* Dynamic ambient background graphics */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-[-1]">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-400/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-400/10 rounded-full blur-[120px]" />
      </div>

      <PeripheralAlertBanner />
      <Navbar />
      <div className="flex-1 overflow-hidden z-10 flex flex-col min-h-0 w-full bg-slate-50">
        {role === 'ADMIN' && <AdminView />}
        {role === 'FACULTY' && <FacultyView />}
        {role === 'LAB_ASSISTANT' && <LabAssistantView />}
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <MainRouter />
    </AuthProvider>
  );
};

export default App;
