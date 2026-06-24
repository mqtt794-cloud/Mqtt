/**
 * =============================================================================
 * ClaimDeviceForm.tsx — Claim Device Client Component
 * =============================================================================
 *
 * PURPOSE:
 *   Renders the claim device form. Users can select a discovered device from
 *   the dropdown or type its ID, enter the verification secret, name it,
 *   and link it to their home.
 * =============================================================================
 */

'use client';

import { useState } from 'react';
import { claimDevice } from './actions';
import { Radio } from 'lucide-react';

interface ClaimDeviceFormProps {
  homes: { id: string; name: string }[];
  unclaimedDevices: { device_id: string; model: string }[];
}

export default function ClaimDeviceForm({ homes, unclaimedDevices }: ClaimDeviceFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    setLoading(true);
    setError(null);
    setSuccess(false);

    const formData = new FormData(form);
    const homeId = formData.get('homeId') as string;
    const deviceId = formData.get('deviceId') as string;
    const secret = formData.get('secret') as string;
    const name = formData.get('name') as string;

    try {
      const res = await claimDevice(homeId, deviceId, secret, name);
      if (res?.error) {
        setError(res.error);
      } else {
        setSuccess(true);
        // Reset the form
        form.reset();
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  if (homes.length === 0) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
      <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <Radio className="w-5 h-5 text-indigo-400" />
        Claim & Register Device
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Select Home */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Link to Home
          </label>
          <select
            name="homeId"
            required
            className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 transition-colors"
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
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Device ID
          </label>
          {unclaimedDevices.length > 0 ? (
            <select
              name="deviceId"
              required
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 transition-colors"
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
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          )}
          {unclaimedDevices.length === 0 && (
            <p className="text-slate-500 text-xs mt-1">
              No discovered devices nearby. Connect your ESP device to Wi-Fi to auto-register it.
            </p>
          )}
        </div>

        {/* Device Secret */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Device Secret (e.g. X7K29A)
          </label>
          <input
            name="secret"
            type="password"
            required
            placeholder="Enter claim verification secret"
            className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Custom Device Name */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Friendly Name (e.g. Living Room Relay)
          </label>
          <input
            name="name"
            type="text"
            required
            placeholder="Assign a descriptive name"
            className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Feedback Feed */}
        {error && (
          <div className="p-3 bg-red-950/30 border border-red-500/20 text-red-400 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 bg-emerald-950/30 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm font-medium">
            Device claimed successfully! Relays initialized.
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl active:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center cursor-pointer"
        >
          {loading ? (
            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            'Verify & Claim Device'
          )}
        </button>
      </form>
    </div>
  );
}
