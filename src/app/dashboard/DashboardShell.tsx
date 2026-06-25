'use client';

import { ToastProvider } from '@/app/components/ui/ToastProvider';

/**
 * DashboardShell — Client wrapper for the dashboard.
 * Provides ToastProvider context to all dashboard components.
 * 
 * NOTE: No polling. Interactive components use optimistic state.
 * Server data refreshes naturally on page navigation.
 */
interface DashboardShellProps {
  children: React.ReactNode;
}

export default function DashboardShell({ children }: DashboardShellProps) {
  return (
    <ToastProvider>
      {children}
    </ToastProvider>
  );
}
