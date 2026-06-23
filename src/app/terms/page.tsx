/**
 * =============================================================================
 * src/app/terms/page.tsx — Terms of Service Page (Alexa Account Linking Requirement)
 * =============================================================================
 *
 * PATH:
 *   GET /terms
 *
 * PURPOSE:
 *   Renders the Terms of Service. This static page is required by Amazon Alexa
 *   in the Skill Developer Console under the Account Linking settings.
 * =============================================================================
 */

import Link from 'next/link';
import { Cpu, ShieldCheck } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans p-6 md:p-12 select-none">
      <div className="max-w-3xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-8 md:p-12 shadow-2xl space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-950/40 rounded-2xl border border-indigo-500/20 text-indigo-400">
              <Cpu className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">Terms of Service</h1>
              <p className="text-slate-500 text-xs mt-0.5">Private Smart-Home Controller Platform</p>
            </div>
          </div>
          <ShieldCheck className="w-8 h-8 text-indigo-500/50" />
        </div>

        {/* Content */}
        <div className="space-y-6 text-sm leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white">1. Acceptance of Terms</h2>
            <p>
              By linking your Amazon Alexa account with this private Smart-Home Controller instance, you agree to
              comply with and be bound by these Terms of Service. This platform is designed solely for private use,
              facilitating local and remote relay controls for personal devices.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white">2. Private Controller Usage</h2>
            <p>
              This is a privately hosted server instance. Authorized access is locked to the designated system
              administrator. You may not attempt to reverse engineer, disrupt, or bypass the secure MQTT publisher
              and subscriber services linking Next.js to the physical ESP8266 microcontroller hardware.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white">3. Third-Party Integrations</h2>
            <p>
              This platform interfaces with Amazon Alexa Smart Home APIs and HiveMQ Cloud Brokers. Your usage is
              subject to Amazon’s terms and policies. The developers of this smart-home software are not responsible
              for disruptions, latency, or outages occurring on external platforms or third-party cloud networks.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white">4. Modifications & Availability</h2>
            <p>
              As a private development instance, functions, schemas, and configurations (such as claim flows, OTA updates, 
              or state reports) may change at any time without notice. Continuous service availability is not guaranteed.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 pt-6 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs text-slate-500">
          <div>Last Updated: June 24, 2026</div>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-indigo-400 transition-colors">
              Privacy Policy
            </Link>
            <span>•</span>
            <Link href="/login" className="hover:text-indigo-400 transition-colors">
              Admin Login
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
