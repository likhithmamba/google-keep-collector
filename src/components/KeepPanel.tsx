import React, { useState } from 'react';
import { KeepNote } from '../types';
import { 
  Pin, 
  Trash2, 
  Palette, 
  Search, 
  Copy, 
  Plus, 
  ExternalLink, 
  Lightbulb, 
  ChevronDown,
  ChevronUp,
  Sparkles,
  RefreshCw,
  Info,
  Link2,
  BookOpen
} from 'lucide-react';

interface KeepPanelProps {
  notes: KeepNote[];
  onAddNote: (note: Omit<KeepNote, 'id' | 'updatedAt'>) => void;
  onUpdateNoteColor: (id: string, color: string) => void;
  onTogglePin: (id: string) => void;
  onDeleteNote: (id: string) => void;
  // Extracted Links props
  extractedLinks: string[];
  getCuratedItemForLink: (url: string) => any;
  onSelectVideo: (video: any) => void;
  onQuickNote: (url: string) => void;
  onAiCurate: (url: string) => void;
  isAnalyzing: boolean;
  onOpenImportModal: () => void;
}

const KEEP_COLORS = [
  { name: 'Default', value: '#FFFFFF', bgClass: 'bg-white', borderClass: 'border-slate-200' },
  { name: 'Red', value: '#FEE2E2', bgClass: 'bg-red-50/90', borderClass: 'border-red-200' },
  { name: 'Orange', value: '#FFEDD5', bgClass: 'bg-orange-50/90', borderClass: 'border-orange-200' },
  { name: 'Yellow', value: '#FFF4C3', bgClass: 'bg-yellow-50/90', borderClass: 'border-yellow-200' },
  { name: 'Green', value: '#DCFCE7', bgClass: 'bg-emerald-50/90', borderClass: 'border-emerald-200' },
  { name: 'Teal', value: '#CCFBF1', bgClass: 'bg-teal-50/90', borderClass: 'border-teal-200' },
  { name: 'Blue', value: '#DBEAFE', bgClass: 'bg-blue-50/90', borderClass: 'border-blue-200' },
  { name: 'Dark Blue', value: '#E0E7FF', bgClass: 'bg-indigo-50/90', borderClass: 'border-indigo-200' },
  { name: 'Purple', value: '#F3E8FF', bgClass: 'bg-purple-50/90', borderClass: 'border-purple-200' },
  { name: 'Pink', value: '#FCE7F3', bgClass: 'bg-pink-50/90', borderClass: 'border-pink-200' },
];

export default function KeepPanel({
  notes,
  onAddNote,
  onUpdateNoteColor,
  onTogglePin,
  onDeleteNote,
  extractedLinks,
  getCuratedItemForLink,
  onSelectVideo,
  onQuickNote,
  onAiCurate,
  isAnalyzing,
  onOpenImportModal
}: KeepPanelProps) {
  const [search, setSearch] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [selectedColor, setSelectedColor] = useState('#FFFFFF');
  const [showColorPickerForId, setShowColorPickerForId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showTips, setShowTips] = useState(false);
  const [showExtractedLinks, setShowExtractedLinks] = useState(true);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [expandedNoteIds, setExpandedNoteIds] = useState<Record<string, boolean>>({});

  const toggleExpandNote = (id: string) => {
    setExpandedNoteIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() && !newContent.trim()) return;

    onAddNote({
      title: newTitle.trim() || 'Untitled Note',
      content: newContent.trim(),
      color: selectedColor,
      pinned: false
    });

    setNewTitle('');
    setNewContent('');
    setSelectedColor('#FFFFFF');
  };

  const handleCopy = async (note: KeepNote) => {
    const formatted = `📌 ${note.title}\n\n${note.content}`;
    try {
      await navigator.clipboard.writeText(formatted);
      setCopiedId(note.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const filteredNotes = notes.filter(note => 
    note.title.toLowerCase().includes(search.toLowerCase()) || 
    note.content.toLowerCase().includes(search.toLowerCase())
  );

  const pinnedNotes = filteredNotes.filter(n => n.pinned);
  const otherNotes = filteredNotes.filter(n => !n.pinned);

  // Helper to find tailored color classes for rendering cards
  const getColorClasses = (hex: string) => {
    const found = KEEP_COLORS.find(c => c.value.toLowerCase() === hex.toLowerCase());
    return found || { bgClass: 'bg-white', borderClass: 'border-slate-200', value: '#FFFFFF' };
  };

  const renderNoteCard = (note: KeepNote) => {
    const isDeleting = deletingNoteId === note.id;
    const isExpanded = !!expandedNoteIds[note.id];
    const colorConfig = getColorClasses(note.color);

    return (
      <div
        key={note.id}
        className={`relative flex flex-col justify-between rounded-2xl p-4 border transition-all duration-200 hover:shadow-sm group/card ${colorConfig.bgClass} ${colorConfig.borderClass}`}
      >
        <div className="space-y-2">
          {/* Header Action Row */}
          <div className="flex items-start justify-between gap-4">
            <h4 className="font-bold text-xs text-slate-800 leading-snug font-display line-clamp-2 pr-4">
              {note.title}
            </h4>
            
            <button
              type="button"
              onClick={() => onTogglePin(note.id)}
              className={`absolute top-3 right-3 p-1 rounded-lg transition-all cursor-pointer ${
                note.pinned 
                  ? 'text-indigo-600 bg-indigo-50 border border-indigo-150' 
                  : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 opacity-0 group-hover/card:opacity-100'
              }`}
              title={note.pinned ? 'Unpin Note' : 'Pin Note'}
            >
              <Pin className="w-3 h-3 fill-current" />
            </button>
          </div>

          {/* Body */}
          <div 
            onClick={() => toggleExpandNote(note.id)}
            className="cursor-pointer group/content focus:outline-hidden"
            title={isExpanded ? "Click to collapse note text" : "Click to expand note text"}
          >
            <p className={`text-xs text-slate-600 font-medium whitespace-pre-wrap leading-relaxed transition-all duration-200 ${isExpanded ? '' : 'line-clamp-6'}`}>
              {note.content}
            </p>
            {note.content.length > 150 && (
              <span className="text-[9px] text-indigo-600 font-black tracking-wider uppercase block mt-1.5 hover:text-indigo-700 transition-colors">
                {isExpanded ? '▲ Collapse Note' : '▼ Expand Note'}
              </span>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 mt-4 border-t border-slate-900/5 text-[10px]">
          <span className="text-[9px] text-slate-400 font-mono">
            {new Date(note.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
          </span>

          <div className="flex items-center gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
            {isDeleting ? (
              <div className="flex items-center gap-1 animate-slide-in">
                <button
                  type="button"
                  onClick={() => onDeleteNote(note.id)}
                  className="px-2 py-0.5 bg-rose-500 text-white font-bold text-[9px] uppercase rounded-md cursor-pointer hover:bg-rose-600"
                >
                  Confirm Delete
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingNoteId(null)}
                  className="px-2 py-0.5 bg-slate-100 text-slate-600 font-bold text-[9px] uppercase rounded-md cursor-pointer hover:bg-slate-200"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <>
                {/* Palette */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowColorPickerForId(showColorPickerForId === note.id ? null : note.id)}
                    className="p-1 hover:bg-slate-900/5 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
                    title="Change color"
                  >
                    <Palette className="w-3 h-3" />
                  </button>

                  {showColorPickerForId === note.id && (
                    <div className="absolute bottom-6 right-0 bg-white border border-slate-200 rounded-xl p-1.5 flex gap-1 z-20 shadow-md">
                      {KEEP_COLORS.map(c => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => {
                            onUpdateNoteColor(note.id, c.value);
                            setShowColorPickerForId(null);
                          }}
                          className="w-3 h-3 rounded-full border border-slate-200 hover:scale-110 transition-transform cursor-pointer"
                          style={{ backgroundColor: c.value }}
                          title={c.name}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Copy */}
                <button
                  type="button"
                  onClick={() => handleCopy(note)}
                  className="p-1 hover:bg-slate-900/5 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
                  title="Copy note markdown"
                >
                  {copiedId === note.id ? (
                    <span className="text-[9px] text-emerald-600 font-bold">Copied</span>
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>

                {/* Trash Trigger */}
                <button
                  type="button"
                  onClick={() => setDeletingNoteId(note.id)}
                  className="p-1 hover:bg-rose-50 rounded text-slate-400 hover:text-rose-600 cursor-pointer"
                  title="Delete Note"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm flex flex-col h-full space-y-5">
      
      {/* Header */}
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 text-white rounded-2xl flex items-center justify-center font-black text-lg shadow-md shadow-indigo-600/20 animate-pulse-slow">
            C
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider font-display flex items-center gap-1.5">
              <span>CurateMind Research Board</span>
            </h2>
            <p className="text-[10px] text-slate-500 font-medium">Synced clipboard & learning dashboard</p>
          </div>
        </div>

        {/* Quick Launch Google Keep with Bulk Import */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenImportModal}
            className="flex items-center gap-1.5 text-[10px] text-[#C4342B] font-black uppercase bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-xl border border-rose-200/50 cursor-pointer transition-colors"
            title="Import Google Keep Takeout JSON clipboard files"
          >
            <span>Import Takeout</span>
          </button>
          
          <a 
            href="https://keep.google.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[10px] text-amber-600 font-bold hover:text-amber-700 bg-amber-50 hover:bg-amber-100/70 px-3 py-1.5 rounded-xl border border-amber-200/50 cursor-pointer transition-colors"
          >
            <span>Open Keep</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Sync tips info block */}
      <div>
        <button
          type="button"
          onClick={() => setShowTips(!showTips)}
          className="w-full px-3.5 py-2.5 bg-amber-500/10 hover:bg-amber-500/15 text-amber-900 text-xs font-black rounded-2xl border border-amber-500/20 flex items-center justify-between cursor-pointer transition-all"
        >
          <div className="flex items-center gap-2">
            <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
            <span>How to Sync with Official Google Keep?</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="bg-amber-500 text-white px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
              {showTips ? 'Hide' : 'Tips'}
            </span>
            {showTips ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </div>
        </button>

        {showTips && (
          <div className="bg-amber-50/30 border border-amber-100 rounded-2xl p-4 mt-2.5 shadow-xs space-y-3 animate-slide-in">
            <div className="flex items-start gap-2.5">
              <span className="p-1 bg-amber-100 text-amber-700 rounded-lg text-[10px] font-black uppercase mt-0.5">Live</span>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Type or paste web links in notes. The feed on your left detects them and curates them instantly.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="p-1 bg-amber-100 text-amber-700 rounded-lg text-[10px] font-black uppercase mt-0.5">Unified</span>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Save key study notes from the video workspace directly onto this board. It serves as your study staging hub.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="p-1 bg-amber-100 text-amber-700 rounded-lg text-[10px] font-black uppercase mt-0.5">Google</span>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                To move your notes to Google Keep, click <strong>Copy</strong> below to fetch the clean markdown, then paste it directly into keep.google.com!
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Extracted Links Feed integrated in the Notes Board */}
      {extractedLinks.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-200/40 rounded-2xl p-4 shadow-2xs space-y-3.5 animate-slide-in">
          <button
            type="button"
            onClick={() => setShowExtractedLinks(!showExtractedLinks)}
            className="w-full flex items-center justify-between text-left cursor-pointer focus:outline-hidden"
          >
            <div className="flex items-center gap-2">
              <Link2 className="w-3.5 h-3.5 text-amber-500" />
              <div>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider font-display flex items-center gap-2">
                  <span>Keep Link Resource Feed</span>
                  <span className="bg-amber-400 text-white text-[10px] px-2 py-0.5 rounded-full font-black animate-pulse">
                    {extractedLinks.length} Active Link{extractedLinks.length > 1 ? 's' : ''}
                  </span>
                </h3>
                <p className="text-[10px] text-slate-500 font-medium">Detecting YouTube links inside your notes board.</p>
              </div>
            </div>
            {showExtractedLinks ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
          </button>

          {showExtractedLinks && (
            <div className="grid grid-cols-1 gap-3 pt-2.5 border-t border-amber-200/20 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
              {extractedLinks.map((linkUrl) => {
                const curatedItem = getCuratedItemForLink(linkUrl);
                let domain = 'YouTube';
                try {
                  domain = new URL(linkUrl).hostname.replace('www.', '');
                } catch (_) {}

                return (
                  <div
                    key={linkUrl}
                    className={`rounded-xl p-3 border transition-all flex flex-col justify-between space-y-2.5 bg-white hover:shadow-2xs ${
                      curatedItem ? 'border-amber-400/80 ring-1 ring-amber-400/5 shadow-2xs' : 'border-slate-200'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-400 font-mono tracking-wider truncate max-w-[150px]">
                          📍 {domain}
                        </span>
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                          curatedItem 
                            ? 'bg-amber-100 text-amber-700 font-extrabold' 
                            : 'bg-slate-100 text-slate-500 font-extrabold'
                        }`}>
                          {curatedItem ? 'Curated' : 'Draft Link'}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-slate-800 line-clamp-1 leading-snug">
                        {curatedItem ? curatedItem.title : linkUrl}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      {curatedItem ? (
                        <button
                          type="button"
                          onClick={() => onSelectVideo(curatedItem)}
                          className="w-full flex items-center justify-center gap-1 bg-amber-400 hover:bg-amber-500 text-slate-900 text-[10px] font-black uppercase tracking-wider py-1.5 px-2 rounded-lg transition-all cursor-pointer shadow-2xs"
                        >
                          <BookOpen className="w-3.5 h-3.5 text-slate-900" />
                          <span>Study Side-by-Side</span>
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => onQuickNote(linkUrl)}
                            className="flex-1 flex items-center justify-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-wider py-1.5 px-2 rounded-lg transition-all cursor-pointer border border-slate-200"
                            title="Create notes workspace instantly"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Quick Note</span>
                          </button>
                          <button
                            type="button"
                            disabled={isAnalyzing}
                            onClick={() => onAiCurate(linkUrl)}
                            className="flex-1 flex items-center justify-center gap-1 bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 text-white text-[10px] font-black uppercase tracking-wider py-1.5 px-2 rounded-lg transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                            title="Curate content with Gemini"
                          >
                            <Sparkles className="w-3 h-3 text-amber-300 fill-amber-300/20" />
                            <span>AI Curate</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Note Formulator */}
      <form onSubmit={handleAdd} className="bg-slate-50/70 border border-slate-200/60 rounded-2xl p-4 space-y-3 focus-within:border-amber-400 focus-within:bg-white transition-all">
        <input 
          type="text" 
          placeholder="Title" 
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          className="w-full text-xs font-black text-slate-800 outline-hidden placeholder-slate-400 font-display"
        />
        <textarea 
          placeholder="Take a note..." 
          rows={2}
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          className="w-full text-xs text-slate-600 outline-hidden placeholder-slate-400 resize-none font-medium leading-relaxed"
        />
        
        <div className="flex items-center justify-between pt-3 mt-1 border-t border-slate-200/40">
          {/* Color pick tray */}
          <div className="flex items-center gap-1">
            {KEEP_COLORS.map(c => (
              <button
                key={c.value}
                type="button"
                onClick={() => setSelectedColor(c.value)}
                className={`w-3.5 h-3.5 rounded-full border transition-all cursor-pointer ${
                  selectedColor.toLowerCase() === c.value.toLowerCase()
                    ? 'ring-2 ring-amber-500 border-transparent scale-110 shadow-xs' 
                    : 'border-slate-300 hover:scale-105'
                }`}
                style={{ backgroundColor: c.value }}
                title={c.name}
              />
            ))}
          </div>

          <button
            type="submit"
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white font-black text-[10px] uppercase tracking-wider px-3.5 py-1.5 rounded-xl transition-all cursor-pointer shadow-xs active:scale-95"
          >
            <Plus className="w-3 h-3" />
            <span>Add Note</span>
          </button>
        </div>
      </form>

      {/* Note Search */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
        <input
          type="text"
          placeholder="Search keep notes board..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs outline-hidden focus:border-amber-400 focus:bg-white text-slate-700 placeholder-slate-400 transition-all"
        />
      </div>

      {/* Dynamic Board Scroller */}
      <div className="flex-1 overflow-y-auto space-y-5 max-h-[500px] pr-1 scrollbar-thin">
        {pinnedNotes.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Pin className="w-3 h-3 text-amber-500 fill-amber-500" />
              <span>Pinned ({pinnedNotes.length})</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {pinnedNotes.map(renderNoteCard)}
            </div>
          </div>
        )}

        {otherNotes.length > 0 && (
          <div className="space-y-3">
            {pinnedNotes.length > 0 && (
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider pt-2">
                <span>Other Notes</span>
              </h3>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {otherNotes.map(renderNoteCard)}
            </div>
          </div>
        )}

        {filteredNotes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 text-center space-y-2">
            <div className="p-3 bg-slate-50 text-slate-300 rounded-full">
              <Info className="w-6 h-6" />
            </div>
            <p className="text-xs font-bold text-slate-700">No notes found</p>
            <p className="text-[10px] text-slate-400 max-w-[240px]">
              Notes from your study sidebar and summaries appear automatically on this active board.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
