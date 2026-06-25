/**
 * MobileFAB.tsx — Mobile Floating Action Button + Bottom Sheet
 * Client component wrapping FAB with setup forms inside BottomSheet.
 * Visible only on mobile (lg:hidden).
 */

'use client';

import FAB from '@/app/components/ui/FAB';
import CreateHomeForm from './CreateHomeForm';
import ClaimDeviceForm from './ClaimDeviceForm';
import { Cpu } from 'lucide-react';

interface MobileFABProps {
  homes: { id: string; name: string }[];
  unclaimedDevices: { device_id: string; model: string }[];
}

export default function MobileFAB({ homes, unclaimedDevices }: MobileFABProps) {
  return (
    <FAB>
      <CreateHomeForm />
      {homes.length > 0 && (
        <ClaimDeviceForm
          homes={homes}
          unclaimedDevices={unclaimedDevices}
        />
      )}
      <a
        href="/dashboard/firmware"
        className="flex items-center gap-2 w-full py-3 px-4 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/40 rounded-xl text-sm font-semibold text-indigo-400 hover:text-indigo-300 transition-colors tap-highlight-none"
      >
        <Cpu className="w-4 h-4" />
        Firmware Manager
      </a>
    </FAB>
  );
}
