'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastData {
  id: string;
  message: string;
  variant: ToastVariant;
  duration?: number;
}

const variantStyles: Record<ToastVariant, { bg: string; border: string; text: string; icon: typeof CheckCircle }> = {
  success: {
    bg: 'bg-emerald-950/90',
    border: 'border-emerald-500/30',
    text: 'text-emerald-300',
    icon: CheckCircle,
  },
  error: {
    bg: 'bg-red-950/90',
    border: 'border-red-500/30',
    text: 'text-red-300',
    icon: AlertCircle,
  },
  warning: {
    bg: 'bg-amber-950/90',
    border: 'border-amber-500/30',
    text: 'text-amber-300',
    icon: AlertTriangle,
  },
  info: {
    bg: 'bg-blue-950/90',
    border: 'border-blue-500/30',
    text: 'text-blue-300',
    icon: Info,
  },
};

interface ToastItemProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const [isExiting, setIsExiting] = useState(false);
  const style = variantStyles[toast.variant];
  const Icon = style.icon;
  const duration = toast.duration ?? 3000;

  useEffect(() => {
    const exitTimer = setTimeout(() => setIsExiting(true), duration - 200);
    const removeTimer = setTimeout(() => onDismiss(toast.id), duration);
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(removeTimer);
    };
  }, [toast.id, duration, onDismiss]);

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl border backdrop-blur-lg shadow-2xl transition-all duration-200 ${
        style.bg
      } ${style.border} ${isExiting ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0 animate-slide-up'}`}
      role="alert"
    >
      <Icon className={`w-5 h-5 flex-shrink-0 ${style.text}`} />
      <p className={`text-sm font-medium flex-1 ${style.text}`}>{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors tap-highlight-none cursor-pointer"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
      <div className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${style.text.replace('text-', 'bg-')} opacity-40`}
          style={{ animation: `toastProgress ${duration}ms linear forwards` }}
        />
      </div>
    </div>
  );
}

export interface ToastContainerProps {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:bottom-4 sm:w-96 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}
