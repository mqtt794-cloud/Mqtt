/**
 * =============================================================================
 * ClaimDeviceForm.tsx — Claim Device Client Component
 * =============================================================================
 *
 * PURPOSE:
 *   Renders the claim device form. Users can select a discovered device from
 *   the dropdown or type its ID, enter the verification secret, name it,
 *   and link it to their home.
 *   Premium mobile-first design with toast notifications.
 * =============================================================================
 */

'use client';

import { useState } from 'react';
import { claimDevice } from './actions';
import { Radio, ShieldCheck } from 'lucide-react';
import { useToast } from '@/app/components/ui/ToastProvider';

interface ClaimDeviceFormProps {
  homes: { id: string; name: string }[];
  unclaimedDevices: { device_id: string; model: string }[];
}

export default function ClaimDeviceForm({ homes, unclaimedDevices }: ClaimDeviceFormProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    setLoading(true);

    const formData = new FormData(form);
    const homeId = formData.get('homeId') as string;
    const deviceId = formData.get('deviceId') as string;
    const secret = formData.get('secret') as string;
    const name = formData.get('name') as string;

    try {
      const res = await claimDevice(homeId, deviceId, secret, name);
      if (res?.error) {
        toast(res.error, 'error');
      } else {
        toast(`Device "${name}" claimed successfully!`, 'success');
        form.reset();
      }
    } catch (err: any) {
      toast(err.message || 'An unexpected error occurred.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (homes.length === 0) return null;

  return (
    <div className="bg-slate-900/80 border border-slate-800/60 rounded-2xl p-5 sm:p-6 shadow-xl shadow-black/10">
      <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
        <Radio className="w-5 h-5 text-indigo-400" />
        Claim Device
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Select Home */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Link to Home
          </label>
          <select
            name="homeId"
            required
            className="w-full px-4 py-3 bg-slate-950/80 border border-slate-800/80 rounded-xl text-white focus:outline-none focus:border-indigo-500 transition-colors text-sm cursor-pointer"
          >
            {homes.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </div>

        {/* Select / Enter Device ID */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Device ID
          </label>
          {unclaimedDevices.length > 0 ? (
            <select
              name="deviceId"
              required
              className="w-full px-4 py-3 bg-slate-950/80 border border-slate-800/80 rounded-xl text-white focus:outline-none focus:border-indigo-500 transition-colors text-sm cursor-pointer"
            >
              {unclaimedDevices.map((d) => (
                <option key={d.device_id} value={d.device_id}>
                  {d.device_id} ({d.model})
                </option>
              ))}
            </select>
          ) : (
            <input
              name="deviceId"
              type="text"
              required
              placeholder="e.g. ESP001"
              className="w-full px-4 py-3 bg-slate-950/80 border border-slate-800/80 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors text-sm"
            />
          )}
          {unclaimedDevices.length === 0 && (
            <p className="text-slate-500 text-xs mt-1.5">
              No discovered devices nearby. Connect your ESP to Wi-Fi to auto-register.
            </p>
          )}
        </div>

        {/* Device Secret */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Device Secret
          </label>
          <input
            name="secret"
            type="password"
            required
            placeholder="Enter claim verification secret"
            className="w-full px-4 py-3 bg-slate-950/80 border border-slate-800/80 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors text-sm"
          />
        </div>

        {/* Custom Device Name */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Friendly Name
          </label>
          <input
            name="name"
            type="text"
            required
            placeholder="e.g. Living Room Relay"
            className="w-full px-4 py-3 bg-slate-950/80 border border-slate-800/80 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl active:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer tap-highlight-none active-press touch-target text-sm"
        >
          {loading ? (
            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <ShieldCheck className="w-4 h-4" />
              Verify & Claim
            </>
          )}
        </button>
      </form>
    </div>
  );
}
