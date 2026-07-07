import { VideoItem } from '../types';
import { 
  X, 
  ExternalLink, 
  Star, 
  CheckCircle2, 
  Copy, 
  Calendar, 
  Youtube, 
  ListTodo, 
  Info,
  Sparkles,
  FileCheck,
  CheckCircle,
  Link2,
  BookOpen,
  Clock,
  Activity,
  CheckSquare,
  AlertCircle,
  Download,
  Trash2,
  Maximize2,
  Minimize2,
  Plus,
  Flame,
  FileText,
  Play,
  Pause,
  Volume2,
  Globe,
  Music,
  Headphones,
  Palette,
  Search,
  Highlighter
} from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';

interface VideoDetailModalProps {
  video: VideoItem;
  isOpen: boolean;
  onClose: () => void;
  onSaveToKeep: (video: VideoItem, color: string) => void;
  onSyncTasks: (video: VideoItem) => Promise<boolean>;
  isSyncedToTasks: boolean;
  isInKeep: boolean;
  onUpdateVideo: (updatedVideo: VideoItem) => void;
}

const KEEP_MODAL_COLORS = [
  { name: 'Default', value: '#FFFFFF' },
  { name: 'Red', value: '#FEE2E2' },
  { name: 'Orange', value: '#FFEDD5' },
  { name: 'Yellow', value: '#FFF4C3' },
  { name: 'Green', value: '#DCFCE7' },
  { name: 'Teal', value: '#CCFBF1' },
  { name: 'Blue', value: '#DBEAFE' },
  { name: 'Dark Blue', value: '#E0E7FF' },
  { name: 'Purple', value: '#F3E8FF' },
  { name: 'Pink', value: '#FCE7F3' },
];

export default function VideoDetailModal({
  video,
  isOpen,
  onClose,
  onSaveToKeep,
  onSyncTasks,
  isSyncedToTasks,
  isInKeep,
  onUpdateVideo
}: VideoDetailModalProps) {
  const [copied, setCopied] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(isSyncedToTasks);
  const [notesText, setNotesText] = useState(video.studyNotes || '');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [isNotepadExpanded, setIsNotepadExpanded] = useState(false);
  const [selectedKeepColor, setSelectedKeepColor] = useState('#FFF4C3');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [activeBuilderTemplate, setActiveBuilderTemplate] = useState<'insight' | 'action' | 'question' | 'goal' | 'reference' | null>(null);
  const [builderTitle, setBuilderTitle] = useState('');
  const [builderField1, setBuilderField1] = useState('');
  const [builderField2, setBuilderField2] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Audio Playback Specific State and Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // AI Transcript and Highlights Specific State
  const [isGeneratingTranscript, setIsGeneratingTranscript] = useState(false);
  const [transcriptSearchQuery, setTranscriptSearchQuery] = useState('');
  const [onlyShowHighlights, setOnlyShowHighlights] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);

  const isYouTube = !!video.videoId;
  const isAudio = !isYouTube && (
    video.url.toLowerCase().match(/\.(mp3|wav|ogg|aac|flac|m4a)/i) ||
    video.url.toLowerCase().includes("audio") ||
    video.url.toLowerCase().includes("podcast") ||
    video.url.toLowerCase().includes("soundhelix")
  );

  const generateTranscript = async () => {
    setIsGeneratingTranscript(true);
    setTranscriptError(null);
    try {
      const response = await fetch('/api/transcript', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: video.url,
          title: video.title,
          summary: video.summary,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }

      const data = await response.json();
      if (!data.segments || !Array.isArray(data.segments)) {
        throw new Error('Received invalid transcript structure from Gemini');
      }

      // Update the video item with the new transcript
      onUpdateVideo({
        ...video,
        transcript: data,
      });
    } catch (err: any) {
      console.error('Failed to generate transcript:', err);
      setTranscriptError(err.message || 'An unexpected error occurred while analyzing transcript');
    } finally {
      setIsGeneratingTranscript(false);
    }
  };

  // Initialize and synchronize audio ref
  useEffect(() => {
    if (isOpen && isAudio && video.url) {
      const audio = new Audio(video.url);
      audioRef.current = audio;

      const handlePlay = () => setIsPlaying(true);
      const handlePause = () => setIsPlaying(false);
      const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
      const handleLoadedMetadata = () => setDuration(audio.duration || 180);

      audio.addEventListener('play', handlePlay);
      audio.addEventListener('pause', handlePause);
      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('loadedmetadata', handleLoadedMetadata);

      return () => {
        audio.pause();
        audio.removeEventListener('play', handlePlay);
        audio.removeEventListener('pause', handlePause);
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audioRef.current = null;
        setIsPlaying(false);
        setCurrentTime(0);
      };
    }
  }, [isOpen, isAudio, video.url]);

  // Sync state if selected video changes
  useEffect(() => {
    setNotesText(video.studyNotes || '');
    setSyncSuccess(isSyncedToTasks);
  }, [video.id, isSyncedToTasks, video.studyNotes]);

  if (!isOpen) return null;

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(e => console.warn("Audio play blocked", e));
      }
    } else {
      setIsPlaying(!isPlaying); // fallback simulation
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };

  const handleTimelineScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setCurrentTime(val);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  const highlightText = (text: string, highlight: string) => {
    if (!highlight || !highlight.trim()) return text;
    try {
      const parts = text.split(new RegExp(`(${highlight.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'));
      return (
        <span>
          {parts.map((part, i) => 
            part.toLowerCase() === highlight.toLowerCase()
              ? <mark key={i} className="bg-amber-200 text-amber-950 font-semibold px-0.5 rounded">{part}</mark>
              : part
          )}
        </span>
      );
    } catch (e) {
      return text;
    }
  };

  const handleTimestampClick = (timestamp: string, title: string) => {
    // Also, helper to insert directly into notes
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      const insertText = `\n[${timestamp}] ${title} - `;
      const newText = text.substring(0, start) + insertText + text.substring(end);
      setNotesText(newText);
      setSaveStatus('saving');
      
      onUpdateVideo({
        ...video,
        studyNotes: newText
      });
      
      setTimeout(() => {
        setSaveStatus('saved');
      }, 400);

      // Focus textarea
      textarea.focus();
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + insertText.length;
      }, 50);
    } else {
      // Fallback: append to end of notes
      const insertText = `\n[${timestamp}] ${title} - `;
      const newText = notesText + insertText;
      setNotesText(newText);
      setSaveStatus('saving');
      
      onUpdateVideo({
        ...video,
        studyNotes: newText
      });
      
      setTimeout(() => {
        setSaveStatus('saved');
      }, 400);
    }
  };

  // Handler for text change with auto-save mechanism
  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    setNotesText(newVal);
    setSaveStatus('saving');
    
    // Auto-update the video item in state and local storage
    onUpdateVideo({
      ...video,
      studyNotes: newVal
    });
    
    // Simulate beautiful visual save completion indicator
    setTimeout(() => {
      setSaveStatus('saved');
    }, 400);
  };

  const handleStatusChange = (status: 'To Watch' | 'Watching' | 'Done') => {
    onUpdateVideo({
      ...video,
      watchedStatus: status
    });
  };

  // Helper to extract links from video summary
  const getDiscoveredLinks = (): string[] => {
    if (video.extractedLinks && video.extractedLinks.length > 0) {
      return video.extractedLinks;
    }
    
    const urlRegex = /(https?:\/\/[^\s\)\"\,\']+)/g;
    const matches = video.summary.match(urlRegex) || [];
    
    // Filter duplicates
    const uniqueLinks = Array.from(new Set(matches));
    return uniqueLinks;
  };

  const discoveredLinks = getDiscoveredLinks();

  const handleCopy = async () => {
    const markdown = `📌 ${video.title} (${video.category})
Channel: ${video.channelTitle}
URL: ${video.url}
⭐ Rating: ${video.rating}/5 stars
"${video.ratingJustification}"
Watched Status: ${video.watchedStatus || 'To Watch'}

💡 AI ACTUAL TOPIC:
${video.actualPurpose || (video.summary ? video.summary.split('.')[0] + '.' : '')}

📝 AI SUMMARY:
${video.summary}

🔑 KEY TAKEAWAYS:
${video.takeaways.map((t, idx) => `${idx + 1}. ${t}`).join('\n')}

✍️ MY STUDY NOTES:
${notesText || '(No custom study notes written yet)'}

${discoveredLinks.length > 0 ? `🔗 DISCOVERED RESOURCE LINKS:\n${discoveredLinks.map(link => `- ${link}`).join('\n')}` : ''}

---
Compiled via CurateMind AI Academic Workspace`;

    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSyncTasksClick = async () => {
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

  // Preset Insert mechanism targeting exact cursor position
  const handleInsertPreset = (presetText: string) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      const before = text.substring(0, start);
      const after = text.substring(end, text.length);
      const updatedValue = before + (start !== 0 && text[start - 1] !== '\n' ? '\n' : '') + presetText + after;
      setNotesText(updatedValue);
      onUpdateVideo({
        ...video,
        studyNotes: updatedValue
      });
      
      setSaveStatus('saving');
      setTimeout(() => setSaveStatus('saved'), 400);

      // Focus back and set selection
      setTimeout(() => {
        textarea.focus();
        const cursorPosition = start + presetText.length + (start !== 0 && text[start - 1] !== '\n' ? 1 : 0);
        textarea.setSelectionRange(cursorPosition, cursorPosition);
      }, 0);
    } else {
      setNotesText(prev => {
        const spacing = prev.length === 0 || prev.endsWith('\n') ? '' : '\n';
        const updated = prev + spacing + presetText;
        onUpdateVideo({
          ...video,
          studyNotes: updated
        });
        return updated;
      });
    }
  };

  const handleOpenBuilder = (template: 'insight' | 'action' | 'question' | 'goal' | 'reference') => {
    setActiveBuilderTemplate(template);
    setBuilderTitle('');
    setBuilderField1('');
    if (template === 'action') {
      setBuilderField2('High');
    } else {
      setBuilderField2('');
    }
  };

  const handleInsertBuilderTemplate = () => {
    let text = '';
    const title = builderTitle.trim() || 'Untitled';
    const field1 = builderField1.trim();
    const field2 = builderField2.trim();

    if (activeBuilderTemplate === 'insight') {
      text = `\n### 💡 INSIGHT: ${title}\n- **Key Observation:** ${field1}\n- **Why it matters:** ${field2}\n`;
    } else if (activeBuilderTemplate === 'action') {
      text = `\n### 🛠️ ACTION ITEM: ${title}\n- [ ] **Action:** ${field1}\n- **Priority:** ${field2 || 'High'}\n`;
    } else if (activeBuilderTemplate === 'question') {
      text = `\n### ❓ OPEN QUESTION: ${title}\n- **Current doubt:** ${field1}\n- **Proposed resolution path:** ${field2}\n`;
    } else if (activeBuilderTemplate === 'goal') {
      text = `\n### 🎯 LEARNING GOAL: ${title}\n- **Objective:** ${field1}\n- **Key milestones:** ${field2}\n`;
    } else if (activeBuilderTemplate === 'reference') {
      text = `\n### 📖 REFERENCE: ${title}\n- **Source/Link:** ${field1}\n- **Key points:** ${field2}\n`;
    }

    handleInsertPreset(text);
    setActiveBuilderTemplate(null);
  };

  const handleDownloadNotes = () => {
    const element = document.createElement("a");
    const fileContent = `===========================================================
STUDY WORKSPACE REPORT: ${video.title}
===========================================================
Channel: ${video.channelTitle}
Category: ${video.category}
Conceptual Complexity: ${video.conceptualComplexity || 'Not Analyzed'}
Interdisciplinary Field: ${video.interdisciplinaryField || 'Not Analyzed'}
Video Link: ${video.url}
Curation Rating: ${video.rating}/5 stars

💡 HONEST CORE PURPOSE (Clickbait Filter):
"${video.actualPurpose || (video.summary ? video.summary.split('.')[0] + '.' : 'Deep concept analysis.')}"

-----------------------------------------------------------
✍️ MY STUDY NOTES:
-----------------------------------------------------------
${notesText || '(No custom study notes written yet)'}

-----------------------------------------------------------
🔑 KEY TAKEAWAYS:
-----------------------------------------------------------
${video.takeaways.map((t, idx) => `${idx + 1}. ${t}`).join('\n')}

-----------------------------------------------------------
📖 AI CURATION SUMMARY:
-----------------------------------------------------------
${video.summary}

-----------------------------------------------------------
Report generated via CurateMind AI Workspace on ${new Date().toLocaleString()}
===========================================================`;

    const file = new Blob([fileContent], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${video.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_study_notes.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleClearNotes = () => {
    if (window.confirm("Are you sure you want to delete your study notes? This will wipe your written notes for this video. This cannot be undone.")) {
      setNotesText('');
      onUpdateVideo({
        ...video,
        studyNotes: ''
      });
      setSaveStatus('saving');
      setTimeout(() => setSaveStatus('saved'), 400);
    }
  };

  // Word and character stats
  const charCount = notesText.length;
  const wordCount = notesText.trim() ? notesText.trim().split(/\s+/).filter(Boolean).length : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-xs">
      {/* Modal Container */}
      <div 
        className="bg-white rounded-3xl max-w-5xl w-full max-h-[92vh] overflow-hidden shadow-2xl flex flex-col relative transition-all duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Section: Interactive Embedded Multi-Media Player */}
        <div className={`relative aspect-video w-full bg-slate-950 shrink-0 border-b border-slate-100 flex items-center justify-center transition-all duration-300 ${isNotepadExpanded ? 'h-0 opacity-0 overflow-hidden' : 'max-h-[320px]'}`}>
          {isYouTube ? (
            <iframe
              src={`https://www.youtube.com/embed/${video.videoId}?autoplay=0&rel=0`}
              title={video.title}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="w-full h-full absolute inset-0"
            ></iframe>
          ) : isAudio ? (
            <div className="absolute inset-0 bg-slate-900 flex flex-col justify-between p-6 text-white font-sans">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-indigo-500/10 border border-indigo-400/20 rounded-xl flex items-center justify-center text-indigo-400">
                    <Headphones className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">HQ Audio Learning Session</span>
                    <h3 className="text-sm font-black text-white truncate max-w-md">{video.title}</h3>
                  </div>
                </div>
                {/* Visual equalizer */}
                <div className="flex items-end gap-1 h-6 px-2">
                  <span className={`w-1 bg-indigo-400 rounded-full transition-all duration-150 ${isPlaying ? 'animate-[bounce_1s_infinite_100ms]' : 'h-2'}`} style={{ height: isPlaying ? undefined : '8px' }} />
                  <span className={`w-1 bg-indigo-400 rounded-full transition-all duration-150 ${isPlaying ? 'animate-[bounce_0.8s_infinite_200ms]' : 'h-4'}`} style={{ height: isPlaying ? undefined : '16px' }} />
                  <span className={`w-1 bg-indigo-400 rounded-full transition-all duration-150 ${isPlaying ? 'animate-[bounce_1.2s_infinite_300ms]' : 'h-3'}`} style={{ height: isPlaying ? undefined : '12px' }} />
                  <span className={`w-1 bg-indigo-400 rounded-full transition-all duration-150 ${isPlaying ? 'animate-[bounce_0.9s_infinite_400ms]' : 'h-5'}`} style={{ height: isPlaying ? undefined : '20px' }} />
                </div>
              </div>

              {/* Progress Slider Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  value={currentTime}
                  onChange={handleTimelineScrub}
                  className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 focus:outline-hidden"
                />
              </div>

              {/* Playback controls row */}
              <div className="flex items-center justify-between">
                {/* Speed multipliers */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-bold uppercase text-slate-500 mr-1">Speed:</span>
                  {[1, 1.25, 1.5, 2].map((speed) => (
                    <button
                      key={speed}
                      onClick={() => handleSpeedChange(speed)}
                      className={`text-[10px] font-black px-2 py-1 rounded-md transition-all ${
                        playbackSpeed === speed
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>

                {/* Main Action Circle */}
                <button
                  onClick={togglePlay}
                  className="w-12 h-12 bg-white text-slate-900 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg cursor-pointer"
                >
                  {isPlaying ? <Pause className="w-5 h-5 fill-slate-900 text-slate-900" /> : <Play className="w-5 h-5 fill-slate-900 text-slate-900 ml-0.5" />}
                </button>

                {/* Resource direct button */}
                <a
                  href={video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-extrabold flex items-center gap-1 hover:underline"
                >
                  <span>Raw Audio</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 bg-slate-900 flex flex-col">
              {/* Simulated browser address bar */}
              <div className="bg-slate-800 border-b border-slate-700 px-4 py-2 flex items-center gap-2 text-slate-400 text-xs shrink-0 select-none">
                <Globe className="w-3.5 h-3.5 text-slate-500" />
                <div className="bg-slate-950 px-3 py-1 rounded-md flex-1 text-[10px] font-mono truncate text-slate-300 flex items-center gap-1.5">
                  <span className="text-emerald-500 font-black">🔒 Secure Link:</span>
                  <span>{video.url}</span>
                </div>
                <a
                  href={video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-2.5 py-1 rounded-md text-[10px] flex items-center gap-1 transition-all"
                >
                  <span>Open URL</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* Webpage iframe viewport with companion banner */}
              <div className="flex-1 relative bg-white">
                <iframe
                  src={video.url}
                  title={video.title}
                  className="w-full h-full border-none"
                />
                
                {/* Overlay helper warning for iframe frame blockers */}
                <div className="absolute bottom-3 left-3 right-3 bg-slate-950/90 text-white p-3 rounded-xl border border-slate-700/60 flex items-center justify-between gap-3 backdrop-blur-xs shadow-lg">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-black text-amber-400 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      SPLIT-SCREEN STUDY ACTIVE
                    </span>
                    <p className="text-[9px] text-slate-300">Some websites restrict framing. Use Open URL to load externally alongside this scratchpad!</p>
                  </div>
                  <button
                    onClick={() => window.open(video.url, '_blank')}
                    className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black px-3 py-1.5 rounded-lg shrink-0 transition-colors cursor-pointer"
                  >
                    Launch Secondary Tab
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Close Button overlay */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-black/90 text-white rounded-full transition-colors cursor-pointer shadow-lg z-10 hover:scale-105"
            title="Close Study Workspace"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Workspace Body Grid */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          
          {/* LEFT PANEL: Curated Metadata, Summary, & Actions */}
          <div className={`p-6 overflow-y-auto space-y-6 ${isNotepadExpanded ? 'hidden md:hidden' : 'block'}`}>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className="text-[10px] font-bold tracking-wider uppercase bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md">
                  {video.category}
                </span>
                
                {video.conceptualComplexity && (
                  <span className="text-[10px] font-bold tracking-wider uppercase bg-indigo-100 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                    <span>Complexity: {video.conceptualComplexity}</span>
                  </span>
                )}

                {video.interdisciplinaryField && (
                  <span className="text-[10px] font-bold tracking-wider uppercase bg-violet-100 text-violet-800 border border-violet-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-500"></span>
                    <span>Field: {video.interdisciplinaryField}</span>
                  </span>
                )}
                
                {/* Watched Status Interactive Toggle inside modal */}
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                  <button
                    onClick={() => handleStatusChange('To Watch')}
                    className={`text-[9px] font-black px-2 py-1 rounded-md transition-all cursor-pointer ${
                      (video.watchedStatus || 'To Watch') === 'To Watch'
                        ? 'bg-white text-slate-700 shadow-2xs font-extrabold border border-slate-200/55'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    ⏳ To Watch
                  </button>
                  <button
                    onClick={() => handleStatusChange('Watching')}
                    className={`text-[9px] font-black px-2 py-1 rounded-md transition-all cursor-pointer ${
                      video.watchedStatus === 'Watching'
                        ? 'bg-indigo-600 text-white shadow-2xs font-extrabold'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    📺 Watching
                  </button>
                  <button
                    onClick={() => handleStatusChange('Done')}
                    className={`text-[9px] font-black px-2 py-1 rounded-md transition-all cursor-pointer ${
                      video.watchedStatus === 'Done'
                        ? 'bg-emerald-600 text-white shadow-2xs font-extrabold'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    ✅ Done
                  </button>
                </div>
              </div>

              <h2 className="text-base font-black text-slate-900 leading-snug font-display flex items-start gap-1.5">
                {video.title}
              </h2>
              <p className="text-xs text-slate-500 mt-1 font-medium flex items-center gap-1.5">
                <span>by <strong className="text-slate-700 font-bold">{video.channelTitle || 'Keep Importer'}</strong></span>
                <span className="text-slate-300">•</span>
                <a 
                  href={video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-rose-600 hover:text-rose-700 hover:underline inline-flex items-center gap-0.5 font-bold"
                >
                  {isYouTube ? (
                    <>
                      <Youtube className="w-3.5 h-3.5 fill-red-600 stroke-none" />
                      <span>Open on YouTube</span>
                    </>
                  ) : isAudio ? (
                    <>
                      <Headphones className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Open Audio Source</span>
                    </>
                  ) : (
                    <>
                      <Globe className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Open Web Resource</span>
                    </>
                  )}
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </p>
            </div>

            {/* Clickbait Buster / Honest Expectations Card */}
            <div className="bg-linear-to-r from-indigo-50/70 to-purple-50/70 border border-indigo-100 rounded-2xl p-4.5 space-y-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-rose-500 fill-rose-500/10 animate-pulse" />
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-950 font-display">
                    AI Clickbait Buster & Expectations
                  </span>
                </div>
                <span className="text-[9px] font-extrabold px-1.5 py-0.5 bg-indigo-600 text-white rounded-md uppercase tracking-wider">
                  Honest Curation
                </span>
              </div>

              <div className="space-y-3">
                <div className="bg-white p-3 rounded-xl border border-indigo-100/50">
                  <span className="text-[10px] font-extrabold text-indigo-700 uppercase tracking-wider block mb-1">
                    🎯 Actual Core Purpose (What this video really delivers):
                  </span>
                  <p className="text-xs text-slate-800 font-semibold leading-relaxed">
                    {video.actualPurpose || (video.summary ? video.summary.split('.')[0] + '.' : "This curated video covers detailed concepts about the video topic, cleanly organized for deep learning.")}
                  </p>
                </div>

                <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200/40">
                  <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider block mb-1">
                    ⚡ Hype vs. Reality Check:
                  </span>
                  <p className="text-xs text-slate-700 leading-relaxed italic font-medium">
                    {video.debunkedClickbait || "This curation bypasses exaggerated thumbnail/title hype to offer precise, distraction-free conceptual knowledge."}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick action buttons & Rating */}
            <div className="bg-amber-50/30 border border-amber-100/70 rounded-2xl p-4 space-y-3.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Curation Rating:</span>
                  <div className="flex items-center">
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
                  <span className="text-xs font-black text-amber-700">({video.rating}/5)</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Keep sync with color selector */}
                  <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 relative shadow-2xs">
                    {/* Small color picker button */}
                    <div className="relative flex items-center">
                      <button
                        type="button"
                        onClick={() => setShowColorPicker(!showColorPicker)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-750 cursor-pointer"
                        title="Choose Keep Note Color"
                      >
                        <Palette className="w-3.5 h-3.5" style={{ color: selectedKeepColor }} />
                      </button>

                      {showColorPicker && (
                        <div className="absolute bottom-10 left-0 bg-white border border-slate-200 rounded-xl p-1.5 flex gap-1 z-30 shadow-md">
                          {KEEP_MODAL_COLORS.map(c => (
                            <button
                              key={c.value}
                              type="button"
                              onClick={() => {
                                setSelectedKeepColor(c.value);
                                setShowColorPicker(false);
                              }}
                              className="w-3.5 h-3.5 rounded-full border border-slate-300 hover:scale-110 transition-transform cursor-pointer"
                              style={{ backgroundColor: c.value }}
                              title={c.name}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => onSaveToKeep(video, selectedKeepColor)}
                      className={`flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                        isInKeep 
                          ? 'bg-amber-50 text-amber-800 border border-amber-200/60 hover:bg-amber-100/70' 
                          : 'bg-amber-500 hover:bg-amber-600 text-white shadow-2xs border border-transparent'
                      }`}
                    >
                      <Sparkles className={`w-3 h-3 ${isInKeep ? 'text-amber-500 fill-amber-400' : 'text-white'}`} />
                      <span>{isInKeep ? 'Update Keep Draft' : 'Sync Keep'}</span>
                    </button>
                  </div>

                  {/* Tasks sync */}
                  <button
                    onClick={handleSyncTasksClick}
                    disabled={isSyncing || syncSuccess}
                    className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${
                      syncSuccess
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700 hover:text-indigo-600 shadow-2xs disabled:opacity-50'
                    }`}
                  >
                    {isSyncing ? (
                      <span className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></span>
                    ) : syncSuccess ? (
                      <CheckCircle className="w-3 h-3 text-emerald-500 fill-emerald-100" />
                    ) : (
                      <FileCheck className="w-3 h-3 text-indigo-500" />
                    )}
                    <span>{syncSuccess ? 'Task Synced' : 'Sync Task'}</span>
                  </button>
                </div>
              </div>
              
              <div className="text-xs text-slate-600 bg-white/70 border border-amber-100/30 p-2.5 rounded-xl">
                <span className="font-extrabold text-amber-800 block text-[10px] uppercase tracking-wider mb-0.5">Rating Justification:</span>
                <p className="italic leading-relaxed">"{video.ratingJustification}"</p>
              </div>
            </div>

            {/* AI detailed summary upgraded to Infographic Summary Station */}
            <div className="bg-slate-50 border border-slate-200/60 rounded-3xl p-5.5 space-y-5 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-200/50 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-amber-500 text-white rounded-lg flex items-center justify-center font-black text-xs shadow-xs">
                    📊
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider font-display">
                      Curation Infographic Station
                    </h3>
                    <p className="text-[10px] text-slate-500 font-medium">Visual analytics and structural learning phases</p>
                  </div>
                </div>
                <span className="text-[9px] font-black uppercase bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md border border-amber-200/30">
                  Active Diagram
                </span>
              </div>

              {/* Grid 1: Dynamic Knowledge Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
                {/* Metric 1 */}
                <div className="bg-white border border-slate-200 p-3 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Learning Velocity</span>
                    <span className="text-xs font-black text-amber-600 font-mono">
                      {Math.round(video.rating * 18 + 10)}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-amber-400 to-rose-400 rounded-full" 
                      style={{ width: `${Math.round(video.rating * 18 + 10)}%` }}
                    />
                  </div>
                </div>

                {/* Metric 2 */}
                <div className="bg-white border border-slate-200 p-3 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Retention Index</span>
                    <span className="text-xs font-black text-indigo-600 font-mono">
                      {Math.round(video.takeaways.length * 15 + 25)}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-indigo-400 to-rose-400 rounded-full" 
                      style={{ width: `${Math.round(video.takeaways.length * 15 + 25)}%` }}
                    />
                  </div>
                </div>

                {/* Metric 3 */}
                <div className="bg-white border border-slate-200 p-3 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Conceptual Depth</span>
                    <span className="text-xs font-black text-emerald-600 font-mono">
                      {Math.round(video.rating * 15 + 25)}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-400 to-indigo-500 rounded-full" 
                      style={{ width: `${Math.round(video.rating * 15 + 25)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Dynamic Concepts Tag Map */}
              <div className="bg-white border border-slate-200/50 rounded-2xl p-3.5 space-y-2">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">
                  🏷️ Core Domain Concept Mapping:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {((cat: string, title: string) => {
                    const tags: string[] = [];
                    const lower = (cat + " " + title).toLowerCase();
                    if (lower.includes("ai") || lower.includes("science") || lower.includes("gemini") || lower.includes("cognitive")) {
                      tags.push("Neural Systems", "Mixture of Experts", "High-Context Parsing", "AI Benchmarking");
                    } else if (lower.includes("productivity") || lower.includes("design") || lower.includes("typography") || lower.includes("creative")) {
                      tags.push("Visual Hierarchy", "Cognitive Friction", "Typographic Contrast", "Staged Memory Capture");
                    } else if (lower.includes("finance") || lower.includes("business") || lower.includes("intelligence")) {
                      tags.push("Corporate Intelligence", "Market Volatility", "Valuation Outlines", "Growth Strategy");
                    } else {
                      tags.push("Active Retrieval", "Conceptual Modeling", "Spaced Iteration", "Metacognitive Mastery");
                    }
                    return tags;
                  })(video.category, video.title).map((tag, idx) => (
                    <span 
                      key={tag} 
                      className="text-[10px] font-bold px-2.5 py-1 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg shadow-2xs hover:bg-amber-50 hover:border-amber-200 hover:text-amber-800 transition-colors cursor-default"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Timeline Flow List (Infographic steps) */}
              <div className="space-y-3.5">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">
                  Timeline Flowchart of Curated Concepts:
                </span>
                <div className="relative pl-6 space-y-4 border-l-2 border-slate-200/70 ml-2">
                  {video.summary
                    .split(/[.!?]\s+/)
                    .map(s => s.trim())
                    .filter(s => s.length > 5)
                    .map((sentence, idx) => (
                      <div key={idx} className="relative group/timeline">
                        {/* Bubble Node */}
                        <div className="absolute -left-[31px] top-0.5 w-4.5 h-4.5 rounded-full bg-amber-400 border-2 border-white flex items-center justify-center text-[9px] font-black text-white shadow-xs group-hover/timeline:bg-amber-500 group-hover/timeline:scale-110 transition-all">
                          {idx + 1}
                        </div>
                        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs group-hover/timeline:border-amber-400/80 transition-all">
                          <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                            {sentence}.
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            {/* Key learnings Checklist */}
            <div className="space-y-2">
              <h3 className="font-extrabold text-xs text-slate-400 uppercase tracking-wider flex items-center gap-1 font-display">
                <ListTodo className="w-3.5 h-3.5 text-amber-500" />
                Key Learnings Checklist
              </h3>
              <ul className="space-y-2">
                {video.takeaways.map((takeaway, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-600 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5 fill-emerald-50" />
                    <span>{takeaway}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* AI-Powered Transcript and Key Sections Highlight Station */}
            <div className="border-t border-slate-200/60 pt-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg border border-amber-100">
                    <Sparkles className="w-4 h-4 fill-amber-200/30" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider font-display">
                      AI Transcript & Spotlight
                    </h3>
                    <p className="text-[10px] text-slate-400">Audio transcript and key learning segments</p>
                  </div>
                </div>
                <span className="text-[9px] font-black uppercase bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md border border-indigo-200/30">
                  Gemini Flash
                </span>
              </div>

              {transcriptError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-3 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">Extraction Failed</p>
                    <p className="text-[11px] leading-relaxed opacity-90">{transcriptError}</p>
                    <button 
                      onClick={generateTranscript}
                      className="text-[10px] font-black underline hover:text-rose-950 uppercase tracking-wide block pt-1"
                    >
                      Retry Analysis
                    </button>
                  </div>
                </div>
              )}

              {/* State 1: Transcript not yet extracted */}
              {!video.transcript && !isGeneratingTranscript && (
                <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-5 text-center space-y-3.5">
                  <div className="w-10 h-10 bg-amber-50 border border-amber-100 rounded-full flex items-center justify-center mx-auto text-amber-500 shadow-2xs">
                    <Highlighter className="w-5 h-5" />
                  </div>
                  <div className="space-y-1 max-w-sm mx-auto">
                    <h4 className="text-xs font-black text-slate-800">Transcript Engine Ready</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Initialize Gemini to reconstruct the full video lecture, index chronological segments, and spotlight high-impact breakthroughs.
                    </p>
                  </div>
                  <button
                    onClick={generateTranscript}
                    className="w-full bg-gradient-to-r from-amber-500 to-rose-500 text-white font-extrabold text-xs py-2 px-4 rounded-xl shadow-md hover:brightness-105 active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5 fill-white/10" />
                    Extract and Highlight Transcript
                  </button>
                </div>
              )}

              {/* State 2: Generating loader */}
              {isGeneratingTranscript && (
                <div className="bg-slate-50/50 border border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-4 shadow-2xs">
                  <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
                  <div className="space-y-1">
                    <p className="text-xs font-black text-slate-800 animate-pulse">Extracting and Analyzing Audio...</p>
                    <p className="text-[11px] text-slate-400 leading-relaxed max-w-xs mx-auto">
                      Gemini is compiling lecture dialogue, aligning timestamp markers, and mapping learning breakthroughs.
                    </p>
                  </div>
                </div>
              )}

              {/* State 3: Transcript exists & rendered */}
              {video.transcript && !isGeneratingTranscript && (
                <div className="space-y-4">
                  {/* Summary Box */}
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50/30 border border-amber-200/60 rounded-xl p-3.5 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-amber-800">
                      <Sparkles className="w-3.5 h-3.5 fill-amber-300" />
                      <span className="text-[10px] font-black uppercase tracking-wider">Spotlight Breakthroughs:</span>
                    </div>
                    <p className="text-xs text-amber-900/90 leading-relaxed font-semibold italic">
                      "{video.transcript.highlightsSummary}"
                    </p>
                  </div>

                  {/* Filter and Search Bar */}
                  <div className="space-y-2 bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search transcript text, titles..."
                        value={transcriptSearchQuery}
                        onChange={(e) => setTranscriptSearchQuery(e.target.value)}
                        className="w-full bg-slate-50 text-xs pl-8 pr-7 py-2 rounded-lg border border-slate-200 focus:outline-hidden focus:ring-1 focus:ring-amber-400 focus:bg-white transition-all font-semibold text-slate-800"
                      />
                      {transcriptSearchQuery && (
                        <button
                          onClick={() => setTranscriptSearchQuery('')}
                          className="absolute right-2.5 top-2.5 text-[10px] text-slate-400 font-bold hover:text-slate-600"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                      <button
                        onClick={() => setOnlyShowHighlights(!onlyShowHighlights)}
                        className={`text-[10px] font-black uppercase px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
                          onlyShowHighlights
                            ? 'bg-amber-100 text-amber-800 border-amber-300 shadow-xs'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <Highlighter className="w-3 h-3" />
                        <span>Only Key Segments</span>
                      </button>

                      <button
                        onClick={generateTranscript}
                        className="text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1 uppercase"
                        title="Re-run audio transcriber with Gemini"
                      >
                        <span className="text-xs">🔄</span> Re-analyze
                      </button>
                    </div>
                  </div>

                  {/* Segments list */}
                  <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1 scrollbar-thin">
                    {(() => {
                      const query = transcriptSearchQuery.trim().toLowerCase();
                      const filtered = video.transcript.segments.filter(seg => {
                        const matchesSearch = !query || 
                          seg.title.toLowerCase().includes(query) || 
                          seg.text.toLowerCase().includes(query) || 
                          seg.speaker.toLowerCase().includes(query);
                        const matchesHighlight = !onlyShowHighlights || seg.isHighlight;
                        return matchesSearch && matchesHighlight;
                      });

                      if (filtered.length === 0) {
                        return (
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-500 font-semibold">
                            No transcript blocks match your filters.
                          </div>
                        );
                      }

                      return filtered.map((seg, idx) => {
                        const isHighlight = seg.isHighlight;
                        return (
                          <div 
                            key={idx} 
                            className={`rounded-xl p-3.5 transition-all duration-200 border ${
                              isHighlight 
                                ? 'bg-amber-50/40 border-amber-300 shadow-2xs hover:shadow-xs' 
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleTimestampClick(seg.timestamp, seg.title)}
                                  className="bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-800 text-[10px] font-black py-0.5 px-2 rounded-md border border-slate-200/50 cursor-pointer flex items-center gap-1 transition-colors"
                                  title="Click to insert timestamp note at notepad cursor"
                                >
                                  <Clock className="w-2.5 h-2.5" />
                                  <span>{seg.timestamp}</span>
                                </button>
                                <span className="text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded">
                                  {seg.speaker}
                                </span>
                              </div>

                              {isHighlight && (
                                <span className="text-[9px] font-black uppercase text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded border border-amber-200/50 flex items-center gap-1 animate-pulse">
                                  ✨ Key Section
                                </span>
                              )}
                            </div>

                            <h4 className="text-xs font-black text-slate-800 mb-1 leading-snug">
                              {seg.title}
                            </h4>

                            <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                              {highlightText(seg.text, transcriptSearchQuery)}
                            </p>

                            {isHighlight && seg.highlightReason && (
                              <div className="mt-2.5 pt-2 border-t border-amber-200/50 text-[10px] text-amber-950 bg-amber-50/80 p-2 rounded-lg leading-relaxed font-semibold">
                                <span className="font-extrabold uppercase text-[9px] text-amber-800 block mb-0.5">Highlight Spotlight:</span>
                                {seg.highlightReason}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT PANEL: Study Notes & Extracted Resource Links */}
          <div className={`p-6 overflow-y-auto space-y-5 bg-slate-50/40 flex flex-col h-full transition-all duration-300 ${isNotepadExpanded ? 'col-span-2 md:col-span-2' : ''}`}>
            
            {/* Notes Section Header */}
            <div className="flex items-center justify-between shrink-0 flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100">
                  <Sparkles className="w-4 h-4 fill-indigo-200/30" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider font-display flex items-center gap-2">
                    <span>Interactive Study Notepad</span>
                    {isNotepadExpanded && <span className="bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded text-[9px] uppercase tracking-wider">Expanded Mode</span>}
                  </h3>
                  <p className="text-[10px] text-slate-400">Draft notes persist locally and save in real-time</p>
                </div>
              </div>
              
              {/* Controls and Save Indicators */}
              <div className="flex items-center gap-2">
                {/* Save status pill */}
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-all ${
                  saveStatus === 'saved' 
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                    : 'bg-indigo-100 text-indigo-800 border border-indigo-200 animate-pulse'
                }`}>
                  {saveStatus === 'saved' ? '✓ Saved' : '⚡ Saving...'}
                </span>

                {/* Full screen expander */}
                <button
                  onClick={() => setIsNotepadExpanded(!isNotepadExpanded)}
                  className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 bg-white border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-indigo-700 text-slate-700 rounded-lg transition-all cursor-pointer shadow-2xs"
                  title={isNotepadExpanded ? "Restore standard split screen view" : "Expand editor space to write freely"}
                >
                  {isNotepadExpanded ? (
                    <>
                      <Minimize2 className="w-3 h-3 text-indigo-500" />
                      <span>Split View</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-3 h-3 text-indigo-500" />
                      <span>Free Write Space</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* QUICK PRESET INSERTS & INTERACTIVE SNIPPET BUILDER - Boosts note taking speed */}
            <div className="bg-white border border-slate-200/60 p-3 rounded-2xl space-y-2.5 shadow-2xs">
              {!activeBuilderTemplate ? (
                <>
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">
                    ⚡ Formulate Advanced Study Snippets (Click to configure & insert):
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenBuilder('insight')}
                      className="text-[10px] font-extrabold px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/40 rounded-lg cursor-pointer transition-colors shadow-2xs flex items-center gap-1"
                      title="Insert Insight Template with clear title intent"
                    >
                      <span>💡</span>
                      <span>Key Insight</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenBuilder('action')}
                      className="text-[10px] font-extrabold px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/40 rounded-lg cursor-pointer transition-colors shadow-2xs flex items-center gap-1"
                      title="Insert Action Item Checklist Template"
                    >
                      <span>🛠️</span>
                      <span>Action Item</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenBuilder('question')}
                      className="text-[10px] font-extrabold px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200/40 rounded-lg cursor-pointer transition-colors shadow-2xs flex items-center gap-1"
                      title="Insert Open Question Template"
                    >
                      <span>❓</span>
                      <span>Open Question</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenBuilder('goal')}
                      className="text-[10px] font-extrabold px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200/40 rounded-lg cursor-pointer transition-colors shadow-2xs flex items-center gap-1"
                      title="Insert Learning Goal Template"
                    >
                      <span>🎯</span>
                      <span>Learning Goal</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenBuilder('reference')}
                      className="text-[10px] font-extrabold px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200/40 rounded-lg cursor-pointer transition-colors shadow-2xs flex items-center gap-1"
                      title="Insert Reference Template"
                    >
                      <span>📖</span>
                      <span>Reference</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className={`p-3.5 rounded-xl border space-y-3 animate-slide-in ${
                  activeBuilderTemplate === 'insight' ? 'bg-amber-50/40 border-amber-200' :
                  activeBuilderTemplate === 'action' ? 'bg-emerald-50/40 border-emerald-200' :
                  activeBuilderTemplate === 'question' ? 'bg-indigo-50/40 border-indigo-200' :
                  activeBuilderTemplate === 'goal' ? 'bg-rose-50/40 border-rose-200' :
                  'bg-slate-50 border-slate-300'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-black uppercase tracking-wider ${
                      activeBuilderTemplate === 'insight' ? 'text-amber-800' :
                      activeBuilderTemplate === 'action' ? 'text-emerald-800' :
                      activeBuilderTemplate === 'question' ? 'text-indigo-800' :
                      activeBuilderTemplate === 'goal' ? 'text-rose-800' :
                      'text-slate-700'
                    }`}>
                      {activeBuilderTemplate === 'insight' && '💡 Configure Key Insight Title & Details'}
                      {activeBuilderTemplate === 'action' && '🛠️ Configure Action Item & Priority'}
                      {activeBuilderTemplate === 'question' && '❓ Configure Open Question Doubt'}
                      {activeBuilderTemplate === 'goal' && '🎯 Configure Learning Goal Target'}
                      {activeBuilderTemplate === 'reference' && '📖 Configure Resource Reference'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveBuilderTemplate(null)}
                      className="text-xs font-semibold text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5">
                    <div>
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block mb-1">
                        {activeBuilderTemplate === 'insight' && 'Insight Title'}
                        {activeBuilderTemplate === 'action' && 'Task / Action Name'}
                        {activeBuilderTemplate === 'question' && 'What needs clarifying?'}
                        {activeBuilderTemplate === 'goal' && 'Goal Description'}
                        {activeBuilderTemplate === 'reference' && 'Topic / Resource Name'}
                      </label>
                      <input 
                        type="text"
                        value={builderTitle}
                        onChange={(e) => setBuilderTitle(e.target.value)}
                        placeholder={
                          activeBuilderTemplate === 'insight' ? 'e.g. Speed of Gravity Waves' :
                          activeBuilderTemplate === 'action' ? 'e.g. Refactor API controllers' :
                          activeBuilderTemplate === 'question' ? 'e.g. Why does token usage increase?' :
                          activeBuilderTemplate === 'goal' ? 'e.g. Master React transitions' :
                          'e.g. MDN - Closures documentation'
                        }
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-hidden focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block mb-1">
                        {activeBuilderTemplate === 'insight' && 'Key Observation'}
                        {activeBuilderTemplate === 'action' && 'Specific Action Step'}
                        {activeBuilderTemplate === 'question' && 'Current Doubt Details'}
                        {activeBuilderTemplate === 'goal' && 'Learning Objective'}
                        {activeBuilderTemplate === 'reference' && 'Source / URL Link'}
                      </label>
                      <input 
                        type="text"
                        value={builderField1}
                        onChange={(e) => setBuilderField1(e.target.value)}
                        placeholder={
                          activeBuilderTemplate === 'insight' ? 'e.g. Travels at exactly the speed of light c.' :
                          activeBuilderTemplate === 'action' ? 'e.g. Strip mock values and enforce strict payload schema.' :
                          activeBuilderTemplate === 'question' ? 'e.g. Multiple redundant requests during re-renders.' :
                          activeBuilderTemplate === 'goal' ? 'e.g. Complete responsive transition layouts smoothly.' :
                          'e.g. https://developer.mozilla.org/en-US/docs/Web/JavaScript/Closures'
                        }
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-hidden focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block mb-1">
                        {activeBuilderTemplate === 'insight' && 'Why It Matters'}
                        {activeBuilderTemplate === 'action' && 'Priority'}
                        {activeBuilderTemplate === 'question' && 'Proposed Resolution Path'}
                        {activeBuilderTemplate === 'goal' && 'Key Milestones'}
                        {activeBuilderTemplate === 'reference' && 'Key Points / Quick Notes'}
                      </label>
                      {activeBuilderTemplate === 'action' ? (
                        <select
                          value={builderField2}
                          onChange={(e) => setBuilderField2(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-hidden focus:border-indigo-500 cursor-pointer"
                        >
                          <option value="High">🔴 High Priority</option>
                          <option value="Medium">🟡 Medium Priority</option>
                          <option value="Low">🟢 Low Priority</option>
                        </select>
                      ) : (
                        <input 
                          type="text"
                          value={builderField2}
                          onChange={(e) => setBuilderField2(e.target.value)}
                          placeholder={
                            activeBuilderTemplate === 'insight' ? 'e.g. Matches General Relativity predictions perfectly.' :
                            activeBuilderTemplate === 'question' ? 'e.g. Implement strict useEffect dependency tracking.' :
                            activeBuilderTemplate === 'goal' ? 'e.g. Run 3 practice setups with framer-motion.' :
                            'e.g. Closures preserve state in outer scopes even after exit.'
                          }
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-hidden focus:border-indigo-500"
                        />
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-200/30">
                    <button
                      type="button"
                      onClick={() => setActiveBuilderTemplate(null)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] uppercase rounded-lg transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleInsertBuilderTemplate}
                      className={`px-3 py-1.5 font-bold text-[10px] uppercase rounded-lg text-white transition-colors cursor-pointer shadow-xs ${
                        activeBuilderTemplate === 'insight' ? 'bg-amber-500 hover:bg-amber-600' :
                        activeBuilderTemplate === 'action' ? 'bg-emerald-600 hover:bg-emerald-700' :
                        activeBuilderTemplate === 'question' ? 'bg-indigo-600 hover:bg-indigo-700' :
                        activeBuilderTemplate === 'goal' ? 'bg-rose-500 hover:bg-rose-600' :
                        'bg-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      Insert into Notepad
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Fully Editable Notes App Textarea - Amplified Spacing & Custom Design */}
            <div className="flex-1 flex flex-col relative group">
              <textarea
                ref={textareaRef}
                value={notesText}
                onChange={handleNotesChange}
                placeholder="✍️ Start writing your custom notes here... Use the quick snippets above to format, and build an exceptional study plan!

All inputs automatically save. Click 'Free Write Space' at the top right to expand this workspace even wider!"
                className={`w-full flex-1 p-5 bg-white border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-2xl text-xs outline-hidden text-slate-700 resize-none font-sans leading-relaxed shadow-xs transition-all ${isNotepadExpanded ? 'min-h-[420px] text-sm' : 'min-h-[280px]'}`}
              ></textarea>

              {/* Word / Char Stats and Clearing actions */}
              <div className="absolute bottom-2.5 right-2.5 flex items-center gap-2 bg-slate-50/90 py-1.5 px-3 rounded-xl border border-slate-200/60 backdrop-blur-xs text-[10px] font-bold text-slate-500">
                <span>{charCount} characters</span>
                <span className="text-slate-300">•</span>
                <span>{wordCount} words</span>
                <span className="text-slate-300">|</span>
                <button
                  onClick={handleClearNotes}
                  className="text-rose-600 hover:text-rose-700 hover:underline cursor-pointer flex items-center gap-0.5 font-bold"
                  title="Erase all notepad text"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear Notes</span>
                </button>
              </div>
            </div>

            {/* Export and download toolbar */}
            <div className="flex items-center justify-between bg-white border border-slate-200/60 rounded-xl p-2.5 shrink-0">
              <span className="text-[10px] text-slate-400 font-medium">
                💾 Keep this report secure offline:
              </span>
              <button
                onClick={handleDownloadNotes}
                className="flex items-center gap-1 text-[10px] font-extrabold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg cursor-pointer transition-all"
                title="Download your study guide with these notes as a txt file"
              >
                <Download className="w-3 h-3" />
                <span>Export as TXT file</span>
              </button>
            </div>

            {/* Discovered External Resource Links Section */}
            <div className="space-y-3 shrink-0">
              <div className="flex items-center gap-2">
                <Link2 className="w-3.5 h-3.5 text-amber-500" />
                <h4 className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider font-display">
                  Discovered Resource Links ({discoveredLinks.length})
                </h4>
              </div>

              {discoveredLinks.length > 0 ? (
                <div className="bg-white border border-slate-200/60 rounded-2xl p-3.5 space-y-2 shadow-2xs max-h-[160px] overflow-y-auto scrollbar-thin">
                  <p className="text-[10px] text-slate-400">
                    💡 We found the following external resource URLs in this video. Click to open directly:
                  </p>
                  <div className="space-y-1.5">
                    {discoveredLinks.map((link, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2 p-1.5 bg-slate-50 border border-slate-100 rounded-lg text-[11px] hover:bg-slate-100/80 transition-colors">
                        <span className="text-slate-600 font-medium truncate max-w-[85%] inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"></span>
                          {link}
                        </span>
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-700 font-extrabold shrink-0 inline-flex items-center gap-0.5 hover:underline"
                        >
                          <span>Go</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-slate-100 border border-slate-200/50 rounded-2xl p-4 text-center">
                  <p className="text-[10px] text-slate-400 italic">
                    No external resource links found in summary description. Any links found during video analysis will automatically render here!
                  </p>
                </div>
              )}
            </div>

          </div>

        </div>

        {/* Modal footer controls */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <Calendar className="w-3.5 h-3.5" />
            <span>Added {new Date(video.createdAt).toLocaleDateString()}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl transition-all cursor-pointer shadow-2xs"
            >
              <Copy className="w-3.5 h-3.5 text-indigo-500" />
              <span>{copied ? 'Copied Full Summary!' : 'Copy Markdown Note'}</span>
            </button>

            <button
              onClick={onClose}
              className="text-xs font-semibold px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition-all cursor-pointer hover:scale-[1.02]"
            >
              Close Workspace
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
