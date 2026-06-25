'use client';

import { useState, useEffect } from 'react';
import { triggerOtaUpdate } from './actions';
import { AlertCircle, CheckCircle, Cpu, Download, Circle, Loader2 } from 'lucide-react';
import { useToast } from '@/app/components/ui/ToastProvider';

interface FirmwareRelease {
  id: string;
  version: string;
  firmware_url: string;
  release_notes: string | null;
  minimum_firmware_version: string | null;
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

// ── OTA Timeline Steps ──────────────────────────────────────────────────────
const OTA_STEPS = ['PENDING', 'DOWNLOADING', 'INSTALLING', 'REBOOTING', 'SUCCESS'] as const;
const STEP_LABELS: Record<string, string> = {
  PENDING: 'Preparing',
  DOWNLOADING: 'Downloading',
  INSTALLING: 'Installing',
  REBOOTING: 'Rebooting',
  SUCCESS: 'Complete',
};

function getStepIndex(status: string): number {
  const idx = OTA_STEPS.indexOf(status as any);
  return idx >= 0 ? idx : 0;
}

function OtaTimeline({ status, progress }: { status: string; progress: number }) {
  const currentIdx = getStepIndex(status);
  const isFailed = status === 'FAILED';

  return (
    <div className="flex flex-col gap-0">
      {OTA_STEPS.map((step, i) => {
        const isComplete = i < currentIdx;
        const isCurrent = i === currentIdx;
        const isUpcoming = i > currentIdx;

        return (
          <div key={step} className="flex items-start gap-3 relative">
            {/* Vertical line connector */}
            {i < OTA_STEPS.length - 1 && (
              <div className={`absolute left-[9px] top-5 w-0.5 h-5 transition-colors duration-500 ${
                isComplete ? 'bg-emerald-500/50' : 'bg-slate-700/50'
              }`} />
            )}

            {/* Step icon */}
            <div className="flex-shrink-0 mt-0.5">
              {isFailed && isCurrent ? (
                <AlertCircle className="w-[18px] h-[18px] text-red-400" />
              ) : isComplete ? (
                <CheckCircle className="w-[18px] h-[18px] text-emerald-400" />
              ) : isCurrent ? (
                <Loader2 className="w-[18px] h-[18px] text-indigo-400 animate-spin" />
              ) : (
                <Circle className="w-[18px] h-[18px] text-slate-700" />
              )}
            </div>

            {/* Step label + progress */}
            <div className="flex items-center gap-2 pb-2 min-w-0">
              <span className={`text-xs font-semibold transition-colors duration-300 ${
                isFailed && isCurrent
                  ? 'text-red-400'
                  : isComplete
                    ? 'text-emerald-400'
                    : isCurrent
                      ? 'text-indigo-300'
                      : 'text-slate-600'
              }`}>
                {isFailed && isCurrent ? 'Failed' : STEP_LABELS[step]}
              </span>
              {isCurrent && step === 'DOWNLOADING' && (
                <span className="text-[10px] font-bold text-indigo-400">{progress}%</span>
              )}
            </div>
          </div>
        );
      })}

      {/* Download progress bar */}
      {status === 'DOWNLOADING' && (
        <div className="ml-[27px] w-[calc(100%-27px)] bg-slate-800 rounded-full h-1.5 overflow-hidden -mt-1 mb-1">
          <div
            className="bg-gradient-to-r from-indigo-500 to-indigo-400 h-1.5 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function OtaUpdatePanel({ deviceId, currentVersion, latestRelease }: OtaUpdatePanelProps) {
  const [job, setJob] = useState<OtaJob | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollingActive, setPollingActive] = useState(false);
  const { toast } = useToast();

  // Fetch current job status on mount
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/device/ota-status?deviceId=${deviceId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.job) {
            setJob(data.job);
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

  // Poll ONLY while OTA is active
  useEffect(() => {
    if (!pollingActive) return;

    const interval = setInterval(async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const res = await fetch(`/api/device/ota-status?deviceId=${deviceId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.job) {
            setJob(data.job);
            const finalStates = ['SUCCESS', 'FAILED'];
            if (finalStates.includes(data.job.status)) {
              setPollingActive(false);
              if (data.job.status === 'SUCCESS') {
                toast('OTA update completed successfully!', 'success');
              } else {
                toast('OTA update failed. Check device connection.', 'error');
              }
            }
          }
        }
      } catch (err) {
        console.error('Error polling OTA status:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [deviceId, pollingActive, toast]);

  if (!latestRelease) return null;

  const hasUpdate = isNewerVersion(latestRelease.version, currentVersion);
  const isOlderThanMin = latestRelease.minimum_firmware_version
    ? isNewerVersion(latestRelease.minimum_firmware_version, currentVersion)
    : false;

  const handleUpdate = async () => {
    if (isOlderThanMin) return;
    setLoading(true);
    setError(null);
    try {
      const res = await triggerOtaUpdate(deviceId, latestRelease.id);
      if (res.error) {
        setError(res.error);
        toast(res.error, 'error');
      } else {
        setPollingActive(true);
        toast('OTA update initiated.', 'info');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
      toast(err.message || 'Unexpected error.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── Active OTA: Show Timeline ──
  if (pollingActive && job) {
    return (
      <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-4 animate-fade-in">
        <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold mb-3">
          <Cpu className="w-3.5 h-3.5 text-indigo-400" />
          <span>UPDATING TO {latestRelease.version}</span>
        </div>
        <OtaTimeline status={job.status} progress={job.progress} />
      </div>
    );
  }

  // ── Final state: Success ──
  if (job && job.status === 'SUCCESS' && !hasUpdate) {
    return (
      <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-4 animate-fade-in">
        <div className="flex items-center gap-2.5 text-emerald-400 text-xs font-medium">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>Updated successfully — running {currentVersion}</span>
        </div>
      </div>
    );
  }

  // ── Idle / Update Available / Failed ──
  return (
    <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold">
          <Cpu className="w-3.5 h-3.5 text-indigo-400" />
          <span>FIRMWARE</span>
        </div>
        <span className="text-xs font-mono text-slate-500">
          Target: {latestRelease.version}
        </span>
      </div>

      {hasUpdate ? (
        <div className="flex flex-col gap-3">
          <div className="text-xs text-slate-300 leading-relaxed bg-slate-900/50 p-3 rounded-xl border border-slate-800/40">
            <span className="font-bold text-indigo-400 block mb-1">Update Available</span>
            {latestRelease.release_notes || 'New features and improvements.'}
          </div>

          {isOlderThanMin && (
            <div className="flex items-start gap-2 bg-amber-500/8 border border-amber-500/15 rounded-xl p-3 text-xs text-amber-400">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Requires version <strong>&gt;= {latestRelease.minimum_firmware_version}</strong>.</span>
            </div>
          )}

          {(error || (job && job.status === 'FAILED')) && (
            <div className="flex items-start gap-2 text-xs text-red-400 bg-red-950/15 border border-red-500/10 rounded-xl p-3">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{error || 'Last update failed. Check device network.'}</span>
            </div>
          )}

          <button
            onClick={handleUpdate}
            disabled={loading || isOlderThanMin}
            className={`w-full py-3 px-4 font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-all cursor-pointer tap-highlight-none active-press ${
              isOlderThanMin
                ? 'bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white shadow-lg hover:shadow-indigo-500/20'
            }`}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Download className="w-4 h-4" />
                {isOlderThanMin
                  ? `Blocked (Req. >= ${latestRelease.minimum_firmware_version})`
                  : `Update to ${latestRelease.version}`}
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="text-slate-500 text-xs text-center py-1 flex items-center justify-center gap-2">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-500/50" />
          Firmware is up to date
        </div>
      )}
    </div>
  );
}
