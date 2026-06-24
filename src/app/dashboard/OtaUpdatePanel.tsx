'use client';

import { useState, useEffect } from 'react';
import { triggerOtaUpdate } from './actions';
import { ArrowUpCircle, RefreshCw, AlertCircle, CheckCircle, Cpu } from 'lucide-react';

interface FirmwareRelease {
  id: string;
  version: string;
  firmware_url: string;
  release_notes: string | null;
}

interface OtaJob {
  id: string;
  status: string;
  progress: number;
}

interface OtaUpdatePanelProps {
  deviceId: string;
  currentVersion: string;
  latestRelease: FirmwareRelease | null;
}

// Semantic version helper in client side
function isNewerVersion(target: string, current: string): boolean {
  const tParts = target.replace(/[^0-9.]/g, '').split('.').map(Number);
  const cParts = current.replace(/[^0-9.]/g, '').split('.').map(Number);
  
  while (tParts.length < 3) tParts.push(0);
  while (cParts.length < 3) cParts.push(0);
  
  for (let i = 0; i < 3; i++) {
    if (tParts[i] > cParts[i]) return true;
    if (tParts[i] < cParts[i]) return false;
  }
  return false;
}

export default function OtaUpdatePanel({ deviceId, currentVersion, latestRelease }: OtaUpdatePanelProps) {
  const [job, setJob] = useState<OtaJob | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollingActive, setPollingActive] = useState(false);

  // 1. Fetch current job status on mount
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/device/ota-status?deviceId=${deviceId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.job) {
            setJob(data.job);
            // If the job is currently active, start polling
            const activeStates = ['PENDING', 'DOWNLOADING', 'INSTALLING'];
            if (activeStates.includes(data.job.status)) {
              setPollingActive(true);
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch initial OTA status:', err);
      }
    };
    fetchStatus();
  }, [deviceId]);

  // 2. Poll job status when polling is active
  useEffect(() => {
    if (!pollingActive) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/device/ota-status?deviceId=${deviceId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.job) {
            setJob(data.job);
            
            // Check if final state reached to stop polling
            const finalStates = ['SUCCESS', 'FAILED'];
            if (finalStates.includes(data.job.status)) {
              setPollingActive(false);
            }
          }
        }
      } catch (err) {
        console.error('Error polling OTA status:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [deviceId, pollingActive]);

  if (!latestRelease) {
    return null; // No releases registered in database yet
  }

  const hasUpdate = isNewerVersion(latestRelease.version, currentVersion);
  
  // Trigger update handler
  const handleUpdate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await triggerOtaUpdate(deviceId, latestRelease.id);
      if (res.error) {
        setError(res.error);
      } else {
        setPollingActive(true);
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-2 bg-slate-950/40 border border-slate-800/80 rounded-xl p-3.5 flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold">
          <Cpu className="w-3.5 h-3.5 text-indigo-400" />
          <span>FIRMWARE UPDATE</span>
        </div>
        <span className="text-xs font-mono text-slate-500">
          Target: {latestRelease.version}
        </span>
      </div>

      {/* Main UI displays based on job/update status */}
      {pollingActive && job ? (
        // ACTIVE JOB STATE (PENDING, DOWNLOADING, INSTALLING)
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-indigo-400">
            <span className="flex items-center gap-1.5">
              <RefreshCw className="w-3 h-3 animate-spin" />
              {job.status === 'PENDING' ? 'WAITING FOR DEVICE...' : job.status}
            </span>
            {job.status === 'DOWNLOADING' && <span>{job.progress}%</span>}
          </div>
          {job.status === 'DOWNLOADING' && (
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-indigo-500 h-1.5 transition-all duration-300"
                style={{ width: `${job.progress}%` }}
              />
            </div>
          )}
        </div>
      ) : job && job.status === 'SUCCESS' && !hasUpdate ? (
        // SUCCESS STATE (ONLY if current version is up to target version)
        <div className="flex items-center gap-2 text-emerald-400 text-xs font-medium bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-2.5">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>Update successful! Device is running {currentVersion}.</span>
        </div>
      ) : (
        // IDLE / UPDATE AVAILABLE / FAILED STATE
        <div className="flex flex-col gap-2">
          {hasUpdate ? (
            <div className="flex flex-col gap-2.5">
              <div className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/40">
                <span className="font-bold text-emerald-400 block mb-0.5">Update Available</span>
                {latestRelease.release_notes ? latestRelease.release_notes : 'New features and resilience improvements.'}
              </div>

              {error && (
                <div className="flex items-start gap-1.5 text-xs text-red-400 bg-red-950/15 border border-red-500/10 rounded-lg p-2.5">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {job && job.status === 'FAILED' && !error && (
                <div className="flex items-start gap-1.5 text-xs text-red-400 bg-red-950/15 border border-red-500/10 rounded-lg p-2.5">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>Last update failed. Check device network connection.</span>
                </div>
              )}

              <button
                onClick={handleUpdate}
                disabled={loading}
                className="w-full py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
              >
                {loading ? (
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <ArrowUpCircle className="w-3.5 h-3.5" />
                    Update Device to {latestRelease.version}
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="text-slate-500 text-xs italic text-center py-1">
              Firmware is up to date.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
