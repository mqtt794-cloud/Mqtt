/**
 * =============================================================================
 * src/app/privacy/page.tsx — Privacy Policy Page (Alexa Account Linking Requirement)
 * =============================================================================
 *
 * PATH:
 *   GET /privacy
 *
 * PURPOSE:
 *   Renders the Privacy Policy. This static page is required by Amazon Alexa
 *   in the Skill Developer Console under the Account Linking settings.
 * =============================================================================
 */

import Link from 'next/link';
import { Cpu, EyeOff } from 'lucide-react';

export default function PrivacyPage() {
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
              <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">Privacy Policy</h1>
              <p className="text-slate-500 text-xs mt-0.5">Private Smart-Home Controller Platform</p>
            </div>
          </div>
          <EyeOff className="w-8 h-8 text-indigo-500/50" />
        </div>

        {/* Content */}
        <div className="space-y-6 text-sm leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white">1. Data We Collect</h2>
            <p>
              This private platform collects and stores metadata related to your connected hardware:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-400 pl-2">
              <li>Device IDs (e.g. ESP001) and hardware models.</li>
              <li>Device telemetry (Online status, WiFi RSSI strength, firmware details).</li>
              <li>State logs (Current toggle states of relay channels).</li>
              <li>Activity events (A timestamped audit log of ON/OFF commands and execution confirmations).</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white">2. Token Storage</h2>
            <p>
              When you link your Amazon Alexa account, we store standard secure authorization codes and token pairs
              (Access Tokens and Refresh Tokens) in our database. These are used solely to authenticate and authorize
              incoming Alexa Smart Home skill directives (like discovering devices and control actions).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white">3. Third-Party Sharing</h2>
            <p>
              We do not sell, rent, or distribute data to third parties. Your smart home metrics and device states are
              exchanged exclusively with Amazon Alexa (to enable voice control features) and routed securely through
              your private HiveMQ Cloud MQTT broker.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white">4. Encryption and Security</h2>
            <p>
              All traffic between your browser, the Next.js server, the Supabase database, and the HiveMQ Cloud broker
              is encrypted via SSL/TLS. Device verification secrets are checked securely using SHA-256 hashes.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 pt-6 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs text-slate-500">
          <div>Last Updated: June 24, 2026</div>
          <div className="flex gap-4">
            <Link href="/terms" className="hover:text-indigo-400 transition-colors">
              Terms of Service
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
