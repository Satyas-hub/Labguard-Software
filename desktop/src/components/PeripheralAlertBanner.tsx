import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Keyboard, Mouse, Monitor, RefreshCw, X } from 'lucide-react';
import { PeripheralScanner, PeripheralAlert } from '../services/peripheralScanner';
import { NativeHardwareStatus } from '../services/native';

export const PeripheralAlertBanner: React.FC = () => {
  const [alert, setAlert] = useState<PeripheralAlert | null>(null);
  const [status, setStatus] = useState<NativeHardwareStatus | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    const unsubscribe = PeripheralScanner.subscribe((currentStatus, currentAlert) => {
      setStatus(currentStatus);
      setAlert(currentAlert);
    });
    return () => unsubscribe();
  }, []);

  if (!alert) return null;

  const isDisconnected = alert.isDisconnected;

  const getIcon = () => {
    switch (alert.type) {
      case 'KEYBOARD':
        return <Keyboard className="w-5 h-5" />;
      case 'MOUSE':
        return <Mouse className="w-5 h-5" />;
      case 'MONITOR':
        return <Monitor className="w-5 h-5" />;
    }
  };

  const handleManualRescan = async () => {
    setScanning(true);
    await PeripheralScanner.scanOnce();
    setScanning(false);
  };

  return (
    <div
      className={`fixed top-3 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-xl px-4 py-3 rounded-2xl shadow-2xl border backdrop-blur-xl transition-all duration-300 animate-in slide-in-from-top-4 ${
        isDisconnected
          ? 'bg-rose-950/95 border-rose-500/80 text-rose-100 shadow-rose-950/50'
          : 'bg-emerald-950/95 border-emerald-500/80 text-emerald-100 shadow-emerald-950/50'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-xl flex items-center justify-center shrink-0 ${
              isDisconnected
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse'
                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            }`}
          >
            {getIcon()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xs tracking-wider uppercase">
                {isDisconnected ? '⚠️ Hardware Disconnected' : '✓ Hardware Restored'}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/30 border border-white/10">
                {alert.type}
              </span>
            </div>
            <p className="text-xs text-white/90 font-medium mt-0.5">
              {alert.message}
            </p>
            <div className="text-[10px] text-white/60 font-mono mt-0.5">
              Device: {alert.deviceName}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleManualRescan}
            disabled={scanning}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 border border-white/20 text-white cursor-pointer transition-colors"
            title="Force Hardware Device Manager Re-scan"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
            <span>{scanning ? 'Scanning...' : 'Re-scan'}</span>
          </button>
          <button
            type="button"
            onClick={() => PeripheralScanner.clearAlert()}
            className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
