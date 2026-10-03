import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, Monitor, Wifi, WifiOff, LogOut, User as UserIcon, RefreshCw, Upload, AlertCircle, Check, Minus, Square, X, Lock, KeyRound, AlertTriangle } from 'lucide-react';
import { NotificationCenter } from './NotificationCenter';
import { SyncEngine, SyncEngineState } from '../services/syncEngine';
import { NativeService } from '../services/native';
import { ApiClient } from '../services/api';

import { APP_VERSION } from '../config/version';

export const Navbar: React.FC = () => {
  const { user, role, isOnline, pcIdentity, logout } = useAuth();
  const [logoError, setLogoError] = useState(false);
  const [syncState, setSyncState] = useState<SyncEngineState>({
    isSyncing: false,
    lastSyncTimestamp: null,
    pendingCount: 0,
    conflictCount: 0,
    consecutiveFailures: 0,
    currentDelayMs: 15000,
    lastError: null
  });

  // Staff / Admin Exit Modal State
  const [showExitModal, setShowExitModal] = useState(false);
  const [exitPin, setExitPin] = useState('');
  const [exitError, setExitError] = useState<string | null>(null);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (pcIdentity?.client_id) {
      SyncEngine.setClientId(pcIdentity.client_id);
    }
    const unsubscribe = SyncEngine.subscribe(setSyncState);
    SyncEngine.start();
    return () => {
      unsubscribe();
      SyncEngine.stop();
    };
  }, [pcIdentity]);

  const handleManualSync = () => {
    SyncEngine.syncNow();
  };

  const handleWindowMinimize = () => {
    NativeService.minimizeWindow().catch(() => {});
  };

  const handleWindowMaximize = () => {
    NativeService.maximizeWindow().catch(() => {});
  };

  const handleWindowClose = () => {
    NativeService.closeWindow(role || undefined).catch(() => {});
  };

  const handleAdminExitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = exitPin.trim();
    if (!cleanPin) {
      setExitError('Please enter your Staff / Faculty / Assistant / Admin password.');
      return;
    }

    setIsExiting(true);
    setExitError(null);

    try {
      // 1. First attempt dynamic validation with server against all registered staff users
      const apiRes = await ApiClient.request('/auth/verify-staff-exit', {
        method: 'POST',
        body: JSON.stringify({ password: cleanPin })
      });

      if (apiRes.success) {
        // Authenticated as registered staff user (Faculty, Lab Assistant, or Admin)
        await NativeService.adminVerifyAndExit('__AUTHORIZED_STAFF_SIGNAL__');
        return;
      } else if (apiRes.error === 'STUDENT_UNAUTHORIZED') {
        setIsExiting(false);
        setExitError('Student accounts are not authorized to exit the terminal.');
        return;
      }
    } catch {
      // Fall through to native verification if offline
    }

    // 2. Native verification (supports offline master keys and default staff passwords)
    const res = await NativeService.adminVerifyAndExit(cleanPin);
    if (!res.success) {
      setIsExiting(false);
      setExitError(res.message || 'Invalid Staff Password. Student passwords cannot exit.');
    }
  };

  return (
    <>
      <header
        data-tauri-drag-region
        className="h-16 glass-panel sticky top-0 z-50 border-b border-slate-200/50 px-4 md:px-6 flex items-center justify-between shadow-sm select-none transition-all"
      >
        {/* Brand & Workstation Info */}
        <div className="flex items-center space-x-3 pointer-events-none">
          <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 shadow-sm flex items-center justify-center overflow-hidden p-0.5 pointer-events-auto">
            {!logoError ? (
              <img
                src="/assets/logo.png"
                alt="LABGUARD Logo"
                className="w-full h-full object-contain"
                onError={() => setLogoError(true)}
              />
            ) : (
              <div className="w-full h-full bg-blue-600 rounded flex items-center justify-center text-white">
                <Shield className="w-5 h-5" />
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-900 tracking-tight text-lg">LABGUARD</span>
              <span className="text-xs bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded border border-blue-200">
                v{APP_VERSION}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">Institutional Laboratory Platform</p>
          </div>
        </div>

        {/* Center Station & Connectivity Status */}
        <div className="flex items-center space-x-2 md:space-x-3 pointer-events-auto overflow-x-auto no-scrollbar pb-1 md:pb-0">
          <div className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border ${
            pcIdentity?.is_registered && pcIdentity?.lab_code && pcIdentity.lab_code !== 'UNASSIGNED'
              ? 'bg-slate-50 border-slate-200 text-slate-700'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}>
            <Monitor className={`w-4 h-4 ${
              pcIdentity?.is_registered && pcIdentity?.lab_code && pcIdentity.lab_code !== 'UNASSIGNED'
                ? 'text-slate-500'
                : 'text-amber-600'
            }`} />
            <span>
              {pcIdentity?.is_registered && pcIdentity?.lab_code && pcIdentity.lab_code !== 'UNASSIGNED'
                ? `${pcIdentity.lab_code} • ${pcIdentity.pc_code}`
                : 'UNASSIGNED • UNREGISTERED'}
            </span>
          </div>

          <div className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-bold border ${
            isOnline
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}>
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span>{isOnline ? '● ONLINE' : '○ OFFLINE'}</span>
          </div>

          {/* Real-time Sync Engine Status Badge */}
          <button
            onClick={handleManualSync}
            disabled={syncState.isSyncing || !isOnline}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-all cursor-pointer ${
              syncState.isSyncing
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : syncState.conflictCount > 0
                ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                : syncState.pendingCount > 0
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
            title={
              syncState.isSyncing
                ? 'Synchronizing local changes to central server...'
                : syncState.conflictCount > 0
                ? `${syncState.conflictCount} unresolved synchronization conflict(s)`
                : syncState.pendingCount > 0
                ? `${syncState.pendingCount} offline change(s) queued for synchronization. Click to sync now.`
                : syncState.lastSyncTimestamp
                ? `All changes synchronized with central server.`
                : 'Sync engine ready'
            }
          >
            {syncState.isSyncing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                <span>Syncing...</span>
              </>
            ) : syncState.conflictCount > 0 ? (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                <span>{syncState.conflictCount} Conflict</span>
              </>
            ) : syncState.pendingCount > 0 ? (
              <>
                <Upload className="w-3.5 h-3.5 text-indigo-600" />
                <span>Sync ({syncState.pendingCount})</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Synced</span>
              </>
            )}
          </button>
        </div>

        {/* User Info & Actions & Window Chrome */}
        <div className="flex items-center space-x-2 md:space-x-3 pointer-events-auto shrink-0 relative">
          {user ? (
            <>
              <NotificationCenter />
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-slate-900">{user.fullName}</p>
                <p className="text-[11px] font-semibold text-blue-600">{role}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
                <UserIcon className="w-4 h-4" />
              </div>
              <button
                onClick={logout}
                className="flex items-center space-x-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer"
                title="Sign Out (PC remains running)"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>

              {/* Window Controls for Authenticated Institutional Staff */}
              {role !== 'STUDENT' && (
                <div className="flex items-center pl-2 ml-1 border-l border-slate-200 space-x-1">
                  <button
                    type="button"
                    onClick={handleWindowMinimize}
                    className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Minimize Window"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleWindowMaximize}
                    className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Maximize Window"
                  >
                    <Square className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleWindowClose}
                    className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-rose-600 transition-colors cursor-pointer"
                    title="Close Application"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </>
          ) : (
            /* Unauthenticated / Login Kiosk Mode: Hide regular window controls and provide secure Staff Exit override */
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => {
                  setShowExitModal(true);
                  setExitError(null);
                  setExitPin('');
                }}
                className="flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-semibold text-slate-400 hover:text-slate-700 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-all cursor-pointer"
                title="Institutional Staff / Admin Emergency Exit (PIN Protected)"
              >
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden sm:inline">Staff Exit</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Staff / Administrator Exit PIN Modal */}
      {showExitModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 relative">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Staff / Admin System Exit</h3>
                  <p className="text-xs text-slate-300">LABGUARD Kiosk Anti-Tamper Shield</p>
                </div>
              </div>
              <button
                onClick={() => setShowExitModal(false)}
                className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleAdminExitSubmit} className="p-6 space-y-4">
              <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3 text-xs text-amber-900 flex items-start space-x-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  This workstation is locked in institutional kiosk mode. Enter your <strong>Faculty, Lab Assistant, or Admin</strong> login password (or Master PIN) to exit the shell.
                </span>
              </div>

              {exitError && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700 font-semibold flex items-center space-x-2 animate-shake">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{exitError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Staff Authorization Password / PIN
                </label>
                <input
                  type="password"
                  autoFocus
                  value={exitPin}
                  onChange={e => setExitPin(e.target.value)}
                  placeholder="Enter Faculty / Assistant / Admin Password or PIN"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-sm tracking-normal text-slate-800"
                  disabled={isExiting}
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowExitModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  disabled={isExiting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isExiting || !exitPin.trim()}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  {isExiting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Terminating...</span>
                    </>
                  ) : (
                    <>
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Authorize & Exit</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

