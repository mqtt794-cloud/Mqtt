/**
 * EmptyState.tsx — Reusable empty state component
 * Provides consistent empty/placeholder states with icon, message, and optional action.
 */

import { type ReactNode } from 'react';
import { type LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}

export default function EmptyState({ icon: Icon, title, description, children, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 text-center animate-fade-in ${className}`}>
      <div className="p-4 bg-slate-800/50 rounded-2xl mb-4">
        <Icon className="w-10 h-10 text-slate-500" />
      </div>
      <h3 className="text-base font-bold text-slate-300 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-slate-500 max-w-xs leading-relaxed">{description}</p>
      )}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
