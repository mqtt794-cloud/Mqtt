'use client';

import { useState } from 'react';
import { RefreshCw, Check } from 'lucide-react';
import { useToast } from '@/app/components/ui/ToastProvider';

interface RefreshConfigButtonProps {
  deviceId: string;
}

export default function RefreshConfigButton({ deviceId }: RefreshConfigButtonProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();

  const handleRefresh = async () => {
    if (loading) return;
    setLoading(true);
    setSuccess(false);
    try {
      const res = await fetch('/api/device/config/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast(data.error || 'Failed to refresh configuration.', 'error');
      } else {
        setSuccess(true);
        toast('Configuration refresh requested.', 'success');
        setTimeout(() => setSuccess(false), 2000);
      }
    } catch (err) {
      console.error('Failed to trigger config refresh:', err);
      toast('A network error occurred.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleRefresh}
      disabled={loading}
      title="Refresh Device Configuration"
      className="flex items-center justify-center w-9 h-9 rounded-xl border border-slate-800/60 bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50 hover:border-slate-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer tap-highlight-none active-press"
    >
      {success ? (
        <Check className="w-4 h-4 text-emerald-400" />
      ) : (
        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
      )}
    </button>
  );
}
