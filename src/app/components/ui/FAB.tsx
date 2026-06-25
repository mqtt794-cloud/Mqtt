/**
 * FAB.tsx — Floating Action Button
 * Fixed bottom-right position. Opens a BottomSheet with setup actions.
 * Only visible on mobile (hidden on lg: screens where sidebar is visible).
 */

'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import BottomSheet from './BottomSheet';

interface FABProps {
  children: React.ReactNode;
}

export default function FAB({ children }: FABProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* FAB Button — visible only on mobile */}
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden fixed bottom-6 right-6 z-[80] w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-500/30 flex items-center justify-center transition-all active-press cursor-pointer tap-highlight-none animate-scale-in"
        aria-label="Add device or home"
      >
        <Plus className={`w-6 h-6 transition-transform duration-200 ${open ? 'rotate-45' : ''}`} />
      </button>

      {/* Bottom Sheet */}
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Quick Actions"
      >
        {children}
      </BottomSheet>
    </>
  );
}
