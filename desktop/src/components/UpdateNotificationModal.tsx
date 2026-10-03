// ============================================================================
// LABGUARD V2: Update Notification Modal Component (Phase 29)
// ============================================================================

import React, { useState } from 'react';
import { AppUpdateInfo } from '../../../shared/types';
import { UpdateService } from '../services/updateService';

interface UpdateNotificationModalProps {
  updateInfo: AppUpdateInfo;
  isOpen: boolean;
  onClose: () => void;
}

export const UpdateNotificationModal: React.FC<UpdateNotificationModalProps> = ({
  updateInfo,
  isOpen,
  onClose
}) => {
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleVerify = async () => {
    setIsVerifying(true);
    setVerificationStatus('Verifying package integrity with central server...');
    try {
      const result = await UpdateService.verifyUpdateWithServer(
        updateInfo.latestVersion,
        updateInfo.sha256Checksum
      );
      if (result.verified) {
        setVerificationStatus(`Verified: ${result.message}`);
      } else {
        setVerificationStatus(`Verification Failed: ${result.message}`);
      }
    } catch (e: any) {
      setVerificationStatus(`Error during verification: ${e.message}`);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold">
              v{updateInfo.latestVersion.split('.')[0]}
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">System Update Available</h3>
              <p className="text-xs text-slate-400">LABGUARD V2 Institutional Release</p>
            </div>
          </div>
          <span className="px-2.5 py-1 text-xs font-mono font-medium rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
            v{updateInfo.latestVersion}
          </span>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {/* Mandatory Alert if applicable */}
          {updateInfo.mandatory && (
            <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-lg flex items-start gap-3 text-red-300 text-xs">
              <span className="text-red-400 font-bold text-sm">!</span>
              <div>
                <p className="font-semibold text-red-200">Mandatory Security Update Required</p>
                <p className="mt-0.5 text-red-300/80">
                  Your current workstation client version ({updateInfo.currentVersion}) is below the minimum supported baseline ({updateInfo.minSupportedVersion}). You must apply this update to maintain network compliance.
                </p>
              </div>
            </div>
          )}

          {/* Release Notes */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Release Highlights
            </h4>
            <div className="bg-slate-950/50 rounded-lg p-3 border border-slate-800 space-y-1.5 text-xs text-slate-300">
              {updateInfo.releaseNotes.map((note, index) => (
                <div key={index} className="flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">•</span>
                  <span>{note}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Cryptographic Integrity & Data Safety */}
          <div className="p-3 bg-slate-800/40 rounded-lg border border-slate-700/60 space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-400">
              <span>SHA-256 Checksum:</span>
              <span className="font-mono text-slate-300">{updateInfo.sha256Checksum.substring(0, 16)}...</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Enterprise local database and vaults safely preserved</span>
            </div>
          </div>

          {/* Verification Status */}
          {verificationStatus && (
            <div className="p-2.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-300 font-mono">
              {verificationStatus}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-800/50 border-t border-slate-700 flex items-center justify-end gap-3">
          {!updateInfo.mandatory && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white transition"
            >
              Remind Me Later
            </button>
          )}

          <button
            onClick={handleVerify}
            disabled={isVerifying}
            className="px-3.5 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg transition disabled:opacity-50"
          >
            {isVerifying ? 'Verifying...' : 'Verify Hash'}
          </button>

          <a
            href={updateInfo.downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-sm transition inline-flex items-center gap-2"
          >
            Download & Update
          </a>
        </div>
      </div>
    </div>
  );
};
