/**
 * =============================================================================
 * CreateHomeForm.tsx — Create Home Client Component
 * =============================================================================
 * Premium mobile-first form with toast notifications and touch-friendly inputs.
 */

'use client';

import { useState } from 'react';
import { createHome } from './actions';
import { Home, Plus } from 'lucide-react';
import { useToast } from '@/app/components/ui/ToastProvider';

export default function CreateHomeForm() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    setLoading(true);

    const formData = new FormData(form);
    const name = formData.get('name') as string;

    try {
      const res = await createHome(name);
      if (res?.error) {
        toast(res.error, 'error');
      } else {
        toast(`Home "${name}" created successfully.`, 'success');
        form.reset();
      }
    } catch (err: any) {
      toast(err.message || 'An unexpected error occurred.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800/60 rounded-2xl p-5 sm:p-6 shadow-xl shadow-black/10">
      <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
        <Home className="w-5 h-5 text-emerald-400" />
        Create Home
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Home Name
          </label>
          <input
            name="name"
            type="text"
            required
            placeholder="e.g. Vacation Cabin"
            className="w-full px-4 py-3 bg-slate-950/80 border border-slate-800/80 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl active:bg-emerald-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer tap-highlight-none active-press touch-target text-sm"
        >
          {loading ? (
            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Plus className="w-4 h-4" />
              Add Home
            </>
          )}
        </button>
      </form>
    </div>
  );
}
