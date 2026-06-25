/**
 * BottomSheet.tsx — Mobile bottom sheet overlay with swipe-to-dismiss
 * Slides up from bottom on mobile, centered modal on desktop.
 * Dismiss via: backdrop tap, swipe down, escape key.
 */

'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export default function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<number | null>(null);
  const dragCurrentRef = useRef<number>(0);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // ── Swipe-to-dismiss handlers ──
  const handleTouchStart = (e: React.TouchEvent) => {
    dragStartRef.current = e.touches[0].clientY;
    dragCurrentRef.current = 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragStartRef.current === null) return;
    const diff = e.touches[0].clientY - dragStartRef.current;
    // Only allow downward drag
    if (diff > 0 && sheetRef.current) {
      dragCurrentRef.current = diff;
      sheetRef.current.style.transform = `translateY(${diff}px)`;
      sheetRef.current.style.transition = 'none';
    }
  };

  const handleTouchEnd = () => {
    if (sheetRef.current) {
      sheetRef.current.style.transition = 'transform 250ms cubic-bezier(0.2, 0, 0, 1)';
      // If dragged more than 80px, dismiss
      if (dragCurrentRef.current > 80) {
        sheetRef.current.style.transform = `translateY(100%)`;
        setTimeout(onClose, 250);
      } else {
        sheetRef.current.style.transform = 'translateY(0)';
      }
    }
    dragStartRef.current = null;
    dragCurrentRef.current = 0;
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center sm:justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        style={{ animation: 'fadeIn 250ms ease forwards' }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="relative w-full sm:max-w-md bg-slate-900 border-t sm:border border-slate-800/60 sm:rounded-2xl rounded-t-2xl max-h-[85vh] overflow-y-auto shadow-2xl"
        style={{ animation: 'slideUp 250ms cubic-bezier(0.2, 0, 0, 1) forwards' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle (mobile) — swipe zone */}
        <div className="sm:hidden flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing">
          <div className="w-10 h-1 rounded-full bg-slate-700" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800/60">
          <h3 className="text-sm font-bold text-white">{title || 'Actions'}</h3>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl cursor-pointer tap-highlight-none"
            style={{ transition: 'all 120ms ease' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {children}
        </div>
      </div>
    </div>
  );
}
