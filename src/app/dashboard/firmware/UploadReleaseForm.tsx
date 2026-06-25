'use client';

import React, { useState, useRef, useTransition } from 'react';
import { uploadFirmwareRelease, UploadResult } from './actions';
import { Upload, FileCode, CheckCircle2, AlertCircle, Loader2, Package } from 'lucide-react';

export default function UploadReleaseForm() {
  const [isPending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [version, setVersion] = useState('');
  const [compatibleModel, setCompatibleModel] = useState('2CH_RELAY');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [isStable, setIsStable] = useState(false);
  const [minimumFirmwareVersion, setMinimumFirmwareVersion] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult['release'] | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      if (!selectedFile.name.endsWith('.bin')) {
        setError('Only .bin files are accepted.');
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      setError(null);
      setFile(selectedFile);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!version || !compatibleModel || !file) {
      setError('Please fill in all fields and select a firmware file.');
      return;
    }

    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('version', version);
    formData.append('compatible_model', compatibleModel);
    formData.append('release_notes', releaseNotes);
    formData.append('file', file);
    formData.append('is_stable', isStable ? 'true' : 'false');
    formData.append('minimum_firmware_version', minimumFirmwareVersion);

    startTransition(async () => {
      try {
        const res = await uploadFirmwareRelease(formData);
        if (!res.success) {
          setError(res.error || 'Failed to upload firmware release.');
        } else if (res.release) {
          setResult(res.release);
          // Reset form fields
          setVersion('');
          setReleaseNotes('');
          setIsStable(false);
          setMinimumFirmwareVersion('');
          setFile(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      } catch (err: any) {
        setError(err.message || 'An unexpected error occurred.');
      }
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) {
      return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }
    return (bytes / 1024).toFixed(2) + ' KB';
  };

  return (
    <div className="space-y-4">
      <div className="bg-slate-900/80 border border-slate-800/60 rounded-2xl p-5 sm:p-6 shadow-xl shadow-black/10">
        <div className="flex items-center gap-2.5 mb-5">
          <Upload className="w-5 h-5 text-indigo-400" />
          <h2 className="text-sm font-bold text-white tracking-wide uppercase">
            Upload Release
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
              Version String
            </label>
            <input
              type="text"
              placeholder="e.g. 1.0.3"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              disabled={isPending}
              className="w-full bg-slate-950/80 border border-slate-800/80 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600 disabled:opacity-50"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
              Compatible Model
            </label>
            <select
              value={compatibleModel}
              onChange={(e) => setCompatibleModel(e.target.value)}
              disabled={isPending}
              className="w-full bg-slate-950/80 border border-slate-800/80 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <option value="2CH_RELAY">2CH_RELAY (2-Channel)</option>
              <option value="4CH_RELAY">4CH_RELAY (4-Channel)</option>
            </select>
          </div>

          <div className="flex items-center gap-2.5 py-1">
            <input
              type="checkbox"
              id="isStable"
              checked={isStable}
              onChange={(e) => setIsStable(e.target.checked)}
              disabled={isPending}
              className="w-5 h-5 rounded border-slate-800 text-indigo-600 focus:ring-indigo-500/50 bg-slate-950 focus:ring-offset-slate-950 cursor-pointer"
            />
            <label htmlFor="isStable" className="text-xs font-semibold text-slate-300 cursor-pointer select-none">
              Mark as Stable Release
            </label>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
              Min Required Version (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. 1.1.0"
              value={minimumFirmwareVersion}
              onChange={(e) => setMinimumFirmwareVersion(e.target.value)}
              disabled={isPending}
              className="w-full bg-slate-950/80 border border-slate-800/80 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600 disabled:opacity-50"
            />
            <span className="block text-[10px] text-slate-600 mt-1">
              Devices must be running at least this version to receive the update.
            </span>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
              Release Notes
            </label>
            <textarea
              placeholder="Describe what changed..."
              value={releaseNotes}
              onChange={(e) => setReleaseNotes(e.target.value)}
              disabled={isPending}
              rows={3}
              className="w-full bg-slate-950/80 border border-slate-800/80 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600 disabled:opacity-50 resize-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
              Firmware Binary (.bin)
            </label>
            <div
              className={`relative group cursor-pointer transition-colors ${isDragOver ? 'opacity-90' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={() => setIsDragOver(false)}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".bin"
                disabled={isPending}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
                required
              />
              <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors bg-slate-950/20 group-hover:bg-slate-950/40 ${
                isDragOver
                  ? 'border-indigo-500/50 bg-indigo-950/10'
                  : file
                    ? 'border-emerald-500/30 bg-emerald-950/5'
                    : 'border-slate-800 hover:border-indigo-500/30'
              }`}>
                {file ? (
                  <Package className="w-8 h-8 text-emerald-400 mx-auto mb-2.5" />
                ) : (
                  <FileCode className="w-8 h-8 text-slate-500 group-hover:text-indigo-400 mx-auto mb-2.5 transition-colors" />
                )}
                <span className="block text-xs text-slate-400 font-medium">
                  {file ? file.name : 'Select or drag firmware .bin file'}
                </span>
                <span className="block text-[10px] text-slate-600 mt-1">
                  {file ? formatSize(file.size) : 'Max file size: 1MB'}
                </span>
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl p-3.5 text-xs text-red-400 animate-slide-up">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-bold py-3 px-4 rounded-xl transition-all cursor-pointer shadow-lg hover:shadow-indigo-500/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none tap-highlight-none active-press touch-target"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Upload Release
              </>
            )}
          </button>
        </form>
      </div>

      {result && (
        <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-2xl p-5 shadow-xl space-y-4 animate-slide-up">
          <div className="flex items-center gap-2.5 text-emerald-400 font-semibold text-sm">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>Upload successful</span>
          </div>

          <div className="bg-slate-950/60 rounded-xl border border-slate-900 p-4 space-y-2 text-xs font-mono">
            <div className="flex justify-between py-1 border-b border-slate-900">
              <span className="text-slate-500">Version:</span>
              <span className="text-white font-semibold">{result.version}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-900">
              <span className="text-slate-500">Model:</span>
              <span className="text-white">{result.compatible_model}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-900">
              <span className="text-slate-500">Stability:</span>
              <span className={`font-semibold ${result.is_stable ? 'text-emerald-400' : 'text-amber-400'}`}>
                {result.is_stable ? 'Stable' : 'Beta'}
              </span>
            </div>
            {result.minimum_firmware_version && (
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-500">Min Req:</span>
                <span className="text-indigo-400 font-semibold">&gt;= {result.minimum_firmware_version}</span>
              </div>
            )}
            <div className="flex justify-between py-1 border-b border-slate-900">
              <span className="text-slate-500">Size:</span>
              <span className="text-white">{formatSize(result.firmware_size)}</span>
            </div>
            <div className="flex flex-col py-1 border-b border-slate-900 gap-1">
              <span className="text-slate-500">SHA256:</span>
              <span className="text-slate-400 break-all select-all text-[10px]">{result.sha256}</span>
            </div>
            <div className="flex flex-col py-1 gap-1">
              <span className="text-slate-500">URL:</span>
              <a 
                href={result.firmware_url}
                target="_blank"
                rel="noreferrer"
                className="text-indigo-400 hover:text-indigo-300 hover:underline break-all truncate font-medium block text-[10px]"
              >
                {result.firmware_url}
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
