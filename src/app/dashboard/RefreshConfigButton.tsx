'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

interface RefreshConfigButtonProps {
  deviceId: string;
}

export default function RefreshConfigButton({ deviceId }: RefreshConfigButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRefresh = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/device/config/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ deviceId }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to refresh configuration.');
      } else {
        router.refresh();
      }
    } catch (err) {
      console.error('Failed to trigger config refresh:', err);
      alert('A network error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleRefresh}
      disabled={loading}
      title="Refresh Device Configuration"
      className="flex items-center justify-center p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 hover:border-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
    >
      <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
    </button>
  );
}
