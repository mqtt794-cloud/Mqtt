/**
 * =============================================================================
 * page.tsx — Firmware Release Management Dashboard Page
 * =============================================================================
 * Premium mobile-responsive firmware management with card layout on mobile.
 */

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClientOnServer } from '@/lib/supabase';
import { logout } from '../../login/actions';
import UploadReleaseForm from './UploadReleaseForm';
import EmptyState from '@/app/components/ui/EmptyState';
import { Cpu, ArrowLeft, Database, LogOut, CheckCircle, ShieldAlert } from 'lucide-react';

export default async function FirmwarePage() {
  // ── 1. AUTH CHECK ──
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session')?.value;

  if (session !== 'authenticated') {
    redirect('/login');
  }

  // ── 2. DATA FETCH ──
  const supabase = await createClientOnServer();
  
  const { data: releases, error } = await supabase
    .from('firmware_releases')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Firmware Page] Database fetch failed:', error);
    throw new Error(`Database query failed: ${error.message}`);
  }

  const typedReleases = releases || [];

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) {
      return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }
    return (bytes / 1024).toFixed(2) + ' KB';
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* ── TOP NAVIGATION BAR ── */}
      <header className="sticky top-0 z-50 glass border-b border-slate-800/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/dashboard" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors tap-highlight-none py-2">
              <ArrowLeft className="w-4 h-4" />
              <span className="text-xs font-semibold hidden sm:inline">Back</span>
            </a>
            <span className="text-slate-800">|</span>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-500/10 rounded-lg">
                <Cpu className="w-4 h-4 text-indigo-400" />
              </div>
              <span className="text-sm font-bold text-white tracking-tight">Firmware</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <form action={logout}>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl transition-colors cursor-pointer tap-highlight-none touch-target"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 items-start">
        {/* ── LEFT SIDEBAR: Upload Form ── */}
        <aside className="order-2 lg:order-1 lg:sticky lg:top-20 space-y-4">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">
            Management
          </h2>
          <UploadReleaseForm />
        </aside>

        {/* ── RIGHT PANEL: Release List ── */}
        <section className="order-1 lg:order-2 space-y-4">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">
            Release Registry ({typedReleases.length})
          </h2>

          {typedReleases.length === 0 ? (
            <EmptyState
              icon={Database}
              title="No firmware releases"
              description="Upload a compiled firmware .bin file to register a new release and trigger OTA updates."
              className="bg-slate-900/40 border border-slate-800/60 rounded-2xl"
            />
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block bg-slate-900/40 border border-slate-800/60 rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-950/60 border-b border-slate-800/60 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                        <th className="py-3.5 px-4">Version</th>
                        <th className="py-3.5 px-4">Stability</th>
                        <th className="py-3.5 px-4">Min Version</th>
                        <th className="py-3.5 px-4">Model</th>
                        <th className="py-3.5 px-4">Size</th>
                        <th className="py-3.5 px-4">SHA256</th>
                        <th className="py-3.5 px-4">Notes</th>
                        <th className="py-3.5 px-4">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40 text-xs">
                      {typedReleases.map((release) => (
                        <tr 
                          key={release.id} 
                          className="hover:bg-slate-900/50 transition-colors"
                        >
                          <td className="py-4 px-4 font-bold text-white tracking-wide">
                            {release.version}
                          </td>
                          <td className="py-4 px-4">
                            {release.is_stable ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-950/40 text-emerald-400 border border-emerald-500/20">
                                <CheckCircle className="w-2.5 h-2.5" />
                                Stable
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-950/40 text-amber-400 border border-amber-500/20">
                                <ShieldAlert className="w-2.5 h-2.5" />
                                Beta
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-4 font-mono text-[10px] text-slate-300">
                            {release.minimum_firmware_version ? (
                              <span className="text-indigo-400 font-semibold">&gt;= {release.minimum_firmware_version}</span>
                            ) : (
                              <span className="text-slate-600 italic">None</span>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-950 border border-slate-800 text-slate-300">
                              {release.compatible_model}
                            </span>
                          </td>
                          <td className="py-4 px-4 font-mono text-slate-300">
                            {formatSize(release.firmware_size)}
                          </td>
                          <td className="py-4 px-4">
                            <span className="font-mono text-[10px] text-slate-500 max-w-[120px] truncate block select-all hover:text-slate-300 transition-colors" title={release.sha256}>
                              {release.sha256}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-slate-400 max-w-xs truncate" title={release.release_notes}>
                            {release.release_notes || <span className="text-slate-700 italic">No notes</span>}
                          </td>
                          <td className="py-4 px-4 font-mono text-[10px] text-slate-500 whitespace-nowrap">
                            {formatDate(release.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden flex flex-col gap-3">
                {typedReleases.map((release) => (
                  <div key={release.id} className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-4 space-y-3 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white">{release.version}</span>
                      {release.is_stable ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-950/40 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle className="w-2.5 h-2.5" />
                          Stable
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-950/40 text-amber-400 border border-amber-500/20">
                          <ShieldAlert className="w-2.5 h-2.5" />
                          Beta
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase tracking-wider mb-0.5">Model</span>
                        <span className="text-slate-300 font-medium">{release.compatible_model}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase tracking-wider mb-0.5">Size</span>
                        <span className="text-slate-300 font-mono">{formatSize(release.firmware_size)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase tracking-wider mb-0.5">Min Version</span>
                        <span className="text-slate-300 font-mono">
                          {release.minimum_firmware_version ? `>= ${release.minimum_firmware_version}` : 'None'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase tracking-wider mb-0.5">Date</span>
                        <span className="text-slate-400 text-[10px]">{formatDate(release.created_at)}</span>
                      </div>
                    </div>
                    {release.release_notes && (
                      <p className="text-xs text-slate-400 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/40">
                        {release.release_notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
