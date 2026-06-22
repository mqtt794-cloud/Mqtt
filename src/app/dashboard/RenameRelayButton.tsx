/**
 * =============================================================================
 * RenameRelayButton.tsx — Rename Relay Button Client Component
 * =============================================================================
 */

'use client';

import { useState } from 'react';
import { renameRelay } from './actions';
import { Edit2 } from 'lucide-react';

interface RenameRelayButtonProps {
  relayId: string;
  currentName: string;
}

export default function RenameRelayButton({ relayId, currentName }: RenameRelayButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleRename = async () => {
    const newName = window.prompt(`Rename Relay "${currentName}" to:`, currentName);
    if (!newName || newName.trim() === '' || newName.trim() === currentName) return;

    setLoading(true);
    try {
      const res = await renameRelay(relayId, newName.trim());
      if (res?.error) {
        alert(res.error);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to rename relay.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleRename}
      disabled={loading}
      className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
      title="Rename relay endpoint"
    >
      <Edit2 className="w-3.5 h-3.5" />
    </button>
  );
}
