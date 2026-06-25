/**
 * =============================================================================
 * RenameRelayButton.tsx — Rename Relay Button Client Component
 * =============================================================================
 * Uses inline editable field instead of window.prompt() for a premium feel.
 * Toast notifications instead of alert() for error feedback.
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { renameRelay } from './actions';
import { Edit2, Check, X } from 'lucide-react';
import { useToast } from '@/app/components/ui/ToastProvider';

interface RenameRelayButtonProps {
  relayId: string;
  currentName: string;
}

export default function RenameRelayButton({ relayId, currentName }: RenameRelayButtonProps) {
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Sync with server state
  if (currentName !== name && !editing && !loading) {
    setName(currentName);
  }

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === currentName) {
      setEditing(false);
      setName(currentName);
      return;
    }

    setLoading(true);
    try {
      const res = await renameRelay(relayId, trimmed);
      if (res?.error) {
        toast(res.error, 'error');
        setName(currentName);
      } else {
        toast('Relay renamed successfully.', 'success');
      }
    } catch (err: any) {
      toast(err.message || 'Failed to rename relay.', 'error');
      setName(currentName);
    } finally {
      setLoading(false);
      setEditing(false);
    }
  };

  const handleCancel = () => {
    setName(currentName);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1 animate-scale-in">
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') handleCancel();
          }}
          className="px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500 w-32 transition-colors"
          disabled={loading}
        />
        <button
          onClick={handleSave}
          disabled={loading}
          className="p-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer tap-highlight-none"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleCancel}
          className="p-1.5 text-slate-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer tap-highlight-none"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      disabled={loading}
      className="p-2 hover:bg-slate-800/80 text-slate-500 hover:text-white rounded-lg transition-colors disabled:opacity-50 cursor-pointer tap-highlight-none"
      title="Rename relay"
    >
      <Edit2 className="w-3.5 h-3.5" />
    </button>
  );
}
