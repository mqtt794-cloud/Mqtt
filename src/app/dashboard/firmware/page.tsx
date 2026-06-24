/**
 * =============================================================================
 * page.tsx — Firmware Release Management Dashboard Page
 * =============================================================================
 */

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClientOnServer } from '@/lib/supabase';
import { logout } from '../../login/actions';
import UploadReleaseForm from './UploadReleaseForm';
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
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur border-b border-slate-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="/dashboard" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <span className="text-xs font-semibold">Back to Devices</span>
            </a>
            <span className="text-slate-800">|</span>
            <div className="flex items-center gap-2.5">
              <Cpu className="w-5 h-5 text-indigo-400" />
              <span className="text-sm font-bold text-white tracking-tight">SmartHome</span>
              <span className="text-slate-600 text-sm">Firmware Manager</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <form action={logout}>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 items-start">
        {/* ── LEFT SIDEBAR: Upload Form ── */}
        <aside className="lg:sticky lg:top-20 space-y-4">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">
            Management
          </h2>
          <UploadReleaseForm />
        </aside>

        {/* ── RIGHT PANEL: Release List ── */}
        <section className="space-y-4">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">
            Release Registry
          </h2>

          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
            {typedReleases.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <Database className="w-10 h-10 text-slate-700 mx-auto" />
                <p className="text-slate-400 text-sm font-medium">No firmware releases found</p>
                <p className="text-slate-600 text-xs max-w-xs mx-auto">
                  Upload a compiled firmware binary `.bin` on the left to register a new release and trigger OTA updates.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-950/60 border-b border-slate-800/60 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                      <th className="py-3.5 px-4">Version</th>
                      <th className="py-3.5 px-4">Stability</th>
                      <th className="py-3.5 px-4">Min Version</th>
                      <th className="py-3.5 px-4">Compatible Model</th>
                      <th className="py-3.5 px-4">Size</th>
                      <th className="py-3.5 px-4">SHA256 Hash</th>
                      <th className="py-3.5 px-4">Release Notes</th>
                      <th className="py-3.5 px-4">Created Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40 text-xs">
                    {typedReleases.map((release) => (
                      <tr 
                        key={release.id} 
                        className="hover:bg-slate-900/35 transition-colors group"
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
                          <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-500 max-w-[120px]">
                            <span className="truncate break-all select-all hover:text-slate-300 transition-colors" title={release.sha256}>
                              {release.sha256}
                            </span>
                          </div>
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
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
