import React, { useState } from 'react';
import { Link2, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';

interface VideoFormProps {
  onAnalyze: (url: string) => Promise<void>;
  isAnalyzing: boolean;
  value?: string;
  onChange?: (val: string) => void;
}

export default function VideoForm({ onAnalyze, isAnalyzing, value, onChange }: VideoFormProps) {
  const [localUrl, setLocalUrl] = useState('');
  const url = value !== undefined ? value : localUrl;
  const setUrl = onChange !== undefined ? onChange : setLocalUrl;
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setError('Please enter a link to analyze.');
      return;
    }

    let isValid = false;
    try {
      const parsed = new URL(trimmedUrl);
      isValid = parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (_) {
      isValid = false;
    }

    if (!isValid) {
      setError('Invalid link. Please paste a standard URL starting with http:// or https://');
      return;
    }

    try {
      await onAnalyze(trimmedUrl);
      setUrl('');
    } catch (err: any) {
      setError(err?.message || 'An error occurred during Gemini analysis. Please try again.');
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-5 h-5 text-amber-500 fill-amber-100" />
        <h2 className="text-sm font-extrabold uppercase tracking-widest text-slate-400 font-display">
          Curate External Link with Gemini
        </h2>
      </div>
      <p className="text-xs text-slate-500 mb-5 leading-relaxed">
        Paste any video, audio, podcast, or external webpage link below. Our server-side Gemini AI will analyze the metadata, rate educational quality, strip clickbait, and write high-fidelity study outlines instantly.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Link2 className="w-5 h-5" />
          </div>
          <input
            type="text"
            placeholder="Paste YouTube video, Spotify podcast, or any webpage link..."
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (error) setError(null);
            }}
            disabled={isAnalyzing}
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-xl text-xs transition-all outline-hidden text-slate-800 placeholder-slate-400 disabled:opacity-50"
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 text-rose-600 bg-rose-50/50 border border-rose-100 rounded-xl p-3 text-xs animate-slide-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isAnalyzing}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 text-white font-extrabold text-xs uppercase tracking-wider py-3 px-4 rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
        >
          {isAnalyzing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-white" />
              <span>Analyzing Link via Gemini API...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-amber-300 fill-amber-300/30" />
              <span>Curate & Analyze with Gemini</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
