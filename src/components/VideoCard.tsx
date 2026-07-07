import React, { useState } from 'react';
import { VideoItem, KeepNote } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Star, 
  BookOpen, 
  ExternalLink, 
  CheckCircle, 
  Copy, 
  Pin, 
  Trash2, 
  Folder, 
  ChevronRight, 
  Clipboard, 
  Sparkles, 
  PlusCircle,
  FileCheck,
  ChevronDown,
  ChevronUp,
  Youtube,
  Headphones,
  Globe,
  Music
} from 'lucide-react';

interface VideoCardProps {
  key?: string;
  video: VideoItem;
  onPin: (id: string) => void;
  onDelete: (id: string) => void;
  onSaveToKeep: (video: VideoItem, color: string) => void;
  onSyncTasks: (video: VideoItem) => Promise<boolean>;
  isSyncedToTasks: boolean;
  isInKeep: boolean;
  onSelect: (video: VideoItem) => void;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  isSelectionMode?: boolean;
  onChangeWatchedStatus?: (id: string, status: 'To Watch' | 'Watching' | 'Done') => void;
}

const CATEGORY_COLORS: { [key: string]: { bg: string; text: string; border: string } } = {
  'AI & Data Science': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  'Technology & Development': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  'Productivity & Design': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  'Business & Finance': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  'Science & Education': { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
  'Entertainment': { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  'Lifestyle & Health': { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
};

export default function VideoCard({
  video,
  onPin,
  onDelete,
  onSaveToKeep,
  onSyncTasks,
  isSyncedToTasks,
  isInKeep,
  onSelect,
  isSelected = false,
  onToggleSelect,
  isSelectionMode = false,
  onChangeWatchedStatus
}: VideoCardProps) {
  const [copied, setCopied] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(isSyncedToTasks);
  const [isExpanded, setIsExpanded] = useState(false);

  const isYouTube = !!video.videoId;
  const isAudio = !isYouTube && (
    video.url.toLowerCase().match(/\.(mp3|wav|ogg|aac|flac|m4a)/i) ||
    video.url.toLowerCase().includes("audio") ||
    video.url.toLowerCase().includes("podcast") ||
    video.url.toLowerCase().includes("soundhelix")
  );

  const domainName = React.useMemo(() => {
    try {
      const parsed = new URL(video.url);
      return parsed.hostname.replace('www.', '');
    } catch (_) {
      return '';
    }
  }, [video.url]);

  const colors = CATEGORY_COLORS[video.category] || { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' };

  // Copy full Keep note content
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const markdown = `📌 ${video.title} (${video.category})
Channel: ${video.channelTitle}
URL: ${video.url}
⭐ Rating: ${video.rating}/5 stars
"${video.ratingJustification}"

📝 AI SUMMARY:
${video.summary}

🔑 KEY TAKEAWAYS:
${video.takeaways.map((t, idx) => `${idx + 1}. ${t}`).join('\n')}

---
Compiled via CurateMind AI Academic Workspace`;

    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleSyncTasksClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (syncSuccess) return;
    setIsSyncing(true);
    try {
      const success = await onSyncTasks(video);
      if (success) {
        setSyncSuccess(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleKeepClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Default Keep note color is Warm Amber/Yellow
    onSaveToKeep(video, '#FFF4C3');
  };

  return (
    <div 
      onClick={() => onSelect(video)}
      className={`group bg-white rounded-2xl border overflow-hidden hover:border-amber-400/80 transition-all duration-300 hover:shadow-md flex flex-col h-full cursor-pointer relative ${
        isSelected ? 'border-amber-400 ring-2 ring-amber-400/20 bg-amber-50/5 shadow-sm' : 'border-slate-200'
      }`}
    >
      {/* Thumbnail / Media Visual Frame */}
      <div className="relative aspect-video w-full overflow-hidden bg-slate-100 shrink-0">
        {video.thumbnail && video.thumbnail.startsWith('http') ? (
          <img
            src={video.thumbnail}
            alt={video.title}
            className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300 referrer-policy='no-referrer'"
            referrerPolicy="no-referrer"
          />
        ) : (
          /* Render a beautiful, content-aware abstract gradient thumbnail card */
          <div className={`w-full h-full bg-gradient-to-br flex flex-col justify-between p-4.5 transition-transform duration-300 group-hover:scale-102 ${
            isAudio 
              ? 'from-indigo-600 via-indigo-700 to-purple-800' 
              : 'from-slate-700 via-slate-800 to-slate-950'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-widest uppercase text-white/50 font-mono">
                {domainName || 'Web Resource'}
              </span>
              {isAudio ? (
                <Headphones className="w-5 h-5 text-indigo-300" />
              ) : (
                <Globe className="w-5 h-5 text-emerald-300" />
              )}
            </div>

            <div className="space-y-1">
              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 bg-white/10 text-white rounded-sm tracking-wider w-max block">
                {video.category}
              </span>
              <h4 className="text-xs font-black text-white/90 line-clamp-1 leading-snug">
                {video.title}
              </h4>
            </div>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
          <span className="text-white text-xs font-medium flex items-center gap-1.5 bg-black/60 px-2 py-1 rounded-md backdrop-blur-xs">
            <ExternalLink className="w-3.5 h-3.5" />
            {isYouTube ? 'Watch Video' : isAudio ? 'Listen to Audio' : 'View Link'}
          </span>
        </div>

        {/* Selection Checkbox */}
        <div 
          className={`absolute top-2 left-2 z-20 transition-opacity duration-200 ${
            isSelectionMode || isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect?.(video.id);
          }}
        >
          <div className={`w-6 h-6 rounded-lg flex items-center justify-center border shadow-sm transition-all ${
            isSelected 
              ? 'bg-amber-400 border-amber-500 text-white' 
              : 'bg-white/90 hover:bg-white border-slate-300 text-transparent'
          }`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        {/* Pin Badge */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPin(video.id);
          }}
          className={`absolute top-2 right-2 p-1.5 rounded-full transition-colors cursor-pointer z-10 ${
            video.isPinned 
              ? 'bg-amber-500 text-white' 
              : 'bg-black/40 text-white hover:bg-black/60'
          }`}
          title={video.isPinned ? 'Unpin Card' : 'Pin Card'}
        >
          <Pin className="w-3.5 h-3.5 fill-current" />
        </button>

        {/* Category Label Overlay */}
        <span className={`absolute bottom-2 left-2 text-[11px] font-semibold px-2.5 py-1 rounded-md border shadow-xs ${colors.bg} ${colors.text} ${colors.border}`}>
          {video.category}
        </span>
      </div>

      {/* Body */}
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <p className="text-xs text-slate-500 font-medium truncate">
              by {video.channelTitle}
            </p>
          </div>
          {/* Watched Status Selector */}
          <div className="shrink-0" onClick={e => e.stopPropagation()}>
            <select
              value={video.watchedStatus || 'To Watch'}
              onChange={(e) => onChangeWatchedStatus?.(video.id, e.target.value as any)}
              className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md border outline-none cursor-pointer transition-colors ${
                video.watchedStatus === 'Done'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 font-extrabold'
                  : video.watchedStatus === 'Watching'
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-extrabold'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
              title="Change study/watch completion status"
            >
              <option value="To Watch">⏳ To Watch</option>
              <option value="Watching">📺 Watching</option>
              <option value="Done">✅ Done</option>
            </select>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`w-3.5 h-3.5 ${
                  i < video.rating 
                    ? 'text-amber-400 fill-amber-400' 
                    : 'text-slate-200'
                }`}
              />
            ))}
          </div>
        </div>

        <h3 className="font-bold text-sm text-slate-800 line-clamp-2 leading-snug font-display mb-2 group-hover:text-slate-950 transition-colors">
          {video.title}
        </h3>

        {/* Clickbait Buster / Actual Core Purpose Banner */}
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 mb-3 text-[11px] leading-relaxed text-slate-700 hover:bg-amber-50/20 hover:border-amber-100/50 transition-all">
          <div className="flex items-center gap-1 mb-1 font-extrabold text-amber-600 uppercase tracking-wider text-[9px]">
            <Sparkles className="w-3 h-3 fill-amber-300/20 animate-pulse" />
            <span>Actual Core Topic:</span>
          </div>
          <p className="font-semibold text-slate-800 line-clamp-2 leading-normal">
            {video.actualPurpose || (video.summary ? video.summary.split('.')[0] + '.' : 'Deep concept analysis.')}
          </p>
        </div>

        {/* Summary with Expand/Collapse Animation */}
        <div className="flex flex-col flex-1 mb-4">
          <motion.div
            animate={{ height: isExpanded ? 'auto' : '3.8rem' }}
            initial={false}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden text-xs text-slate-500 leading-relaxed pr-1"
          >
            <p className={isExpanded ? '' : 'line-clamp-3'}>
              {video.summary}
            </p>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mt-3 pt-3 border-t border-slate-100/80 space-y-2 overflow-hidden"
                >
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Key Takeaways:
                  </p>
                  <ul className="space-y-1.5">
                    {video.takeaways.map((takeaway, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 text-[11px] text-slate-600">
                        <span className="w-1.5 h-1.5 bg-amber-400 rounded-full mt-1.5 shrink-0" />
                        <span>{takeaway}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="flex items-center gap-1 text-[11px] font-bold text-amber-500 hover:text-amber-600 mt-2 self-start cursor-pointer transition-colors"
          >
            {isExpanded ? (
              <>
                <span>Show less</span>
                <ChevronUp className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                <span>Expand summary</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>

        {/* Footer actions */}
        <div className="border-t border-slate-100 pt-4 mt-auto flex items-center justify-between gap-2">
          <div className="flex items-center flex-wrap gap-1.5">
            {/* Direct Open link */}
            <a
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer shadow-2xs ${
                isYouTube 
                  ? 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700' 
                  : isAudio 
                  ? 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-700' 
                  : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700'
              }`}
              title={isYouTube ? "Open video directly in YouTube" : isAudio ? "Listen directly to Audio Podcast" : "Open Webpage directly"}
            >
              {isYouTube ? (
                <>
                  <Youtube className="w-3 h-3 text-red-600 fill-red-600" />
                  <span>Watch</span>
                </>
              ) : isAudio ? (
                <>
                  <Headphones className="w-3 h-3 text-indigo-600" />
                  <span>Listen</span>
                </>
              ) : (
                <>
                  <Globe className="w-3 h-3 text-emerald-600" />
                  <span>Link</span>
                </>
              )}
            </a>

            {/* Save to Keep */}
            <button
              onClick={handleKeepClick}
              disabled={isInKeep}
              className={`flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${
                isInKeep 
                  ? 'bg-amber-50 border-amber-200 text-amber-700' 
                  : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900'
              }`}
              title={isInKeep ? 'Saved to in-app Keep board' : 'Save to in-app Google Keep notes'}
            >
              <Sparkles className="w-3 h-3 text-amber-500 fill-amber-300/20" />
              <span>{isInKeep ? 'In Keep' : 'Save Keep'}</span>
            </button>

            {/* Sync Tasks */}
            <button
              onClick={handleSyncTasksClick}
              disabled={isSyncing || syncSuccess}
              className={`flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${
                syncSuccess
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 disabled:opacity-50'
              }`}
              title={syncSuccess ? 'Synced to real Google Tasks' : 'Sync summary to Google Tasks'}
            >
              {isSyncing ? (
                <span className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></span>
              ) : syncSuccess ? (
                <CheckCircle className="w-3 h-3 text-emerald-500 fill-emerald-100" />
              ) : (
                <FileCheck className="w-3 h-3 text-indigo-500" />
              )}
              <span>{syncSuccess ? 'Synced' : 'Sync Task'}</span>
            </button>

            {/* Copy Summary Button */}
            <button
              onClick={handleCopy}
              className={`flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${
                copied 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                  : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900'
              }`}
              title="Copy formatted summary to clipboard"
            >
              <Copy className="w-3 h-3 text-indigo-500" />
              <span>{copied ? 'Copied!' : 'Copy Summary'}</span>
            </button>
          </div>

          <div className="flex items-center gap-1">
            {/* Delete */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm('Are you sure you want to delete this curated video summary?')) {
                  onDelete(video.id);
                }
              }}
              className="p-1.5 hover:bg-rose-50 rounded-md text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
              title="Delete video summary"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
