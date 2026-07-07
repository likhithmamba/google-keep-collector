import React, { useState, useEffect, useRef } from 'react';
import { VideoItem } from '../types';
import { 
  ArrowLeft,
  Clock,
  Sparkles,
  Search,
  Highlighter,
  AlertCircle,
  Youtube,
  Headphones,
  Globe,
  ExternalLink,
  Star,
  Palette,
  CheckCircle,
  CheckCircle2,
  FileCheck,
  Trash2,
  Download,
  Copy,
  Play,
  Pause
} from 'lucide-react';

interface AcademicFocusModeProps {
  video: VideoItem;
  videos: VideoItem[];
  onSelectVideo: (video: VideoItem) => void;
  onUpdateVideo: (updatedVideo: VideoItem) => void;
  onExit: () => void;
  onSaveToKeep: (video: VideoItem, color: string) => void;
  onSyncTasks: (video: VideoItem) => Promise<boolean>;
  isSyncedToTasks: boolean;
  isInKeep: boolean;
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

export default function AcademicFocusMode({
  video,
  videos,
  onSelectVideo,
  onUpdateVideo,
  onExit,
  onSaveToKeep,
  onSyncTasks,
  isSyncedToTasks,
  isInKeep
}: AcademicFocusModeProps) {
  const [copied, setCopied] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(isSyncedToTasks);
  const [notesText, setNotesText] = useState(video.studyNotes || '');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
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

  // Keep state variables synchronized when active video changes
  useEffect(() => {
    setNotesText(video.studyNotes || '');
    setSyncSuccess(isSyncedToTasks);
    setTranscriptSearchQuery('');
    setOnlyShowHighlights(false);
    setTranscriptError(null);
  }, [video.id]);

  // Sync isSyncedToTasks prop
  useEffect(() => {
    setSyncSuccess(isSyncedToTasks);
  }, [isSyncedToTasks]);

  // Audio Playback Synchronization
  useEffect(() => {
    if (isAudio && video.url) {
      const audio = new Audio(video.url);
      audioRef.current = audio;

      const handlePlay = () => setIsPlaying(true);
      const handlePause = () => setIsPlaying(false);
      const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
      const handleLoadedMetadata = () => setDuration(audio.duration);
      const handleEnded = () => {
        setIsPlaying(false);
        setCurrentTime(0);
      };

      audio.addEventListener('play', handlePlay);
      audio.addEventListener('pause', handlePause);
      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('loadedmetadata', handleLoadedMetadata);
      audio.addEventListener('ended', handleEnded);

      return () => {
        audio.pause();
        audio.removeEventListener('play', handlePlay);
        audio.removeEventListener('pause', handlePause);
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audio.removeEventListener('ended', handleEnded);
        audioRef.current = null;
      };
    }
  }, [video.id, isAudio, video.url]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(err => console.error("Playback restriction: ", err));
      }
    }
  };

  const handleTimelineScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

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

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setNotesText(text);
    setSaveStatus('saving');

    onUpdateVideo({
      ...video,
      studyNotes: text
    });

    const timer = setTimeout(() => {
      setSaveStatus('saved');
    }, 400);

    return () => clearTimeout(timer);
  };

  const handleTimestampClick = (timestamp: string, title: string) => {
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
      
      textarea.focus();
      const newCursorPos = start + insertText.length;
      setTimeout(() => {
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    } else {
      const newText = notesText ? `${notesText}\n[${timestamp}] ${title} - ` : `[${timestamp}] ${title} - `;
      setNotesText(newText);
      onUpdateVideo({
        ...video,
        studyNotes: newText
      });
    }
  };

  const handleOpenBuilder = (type: 'insight' | 'action' | 'question' | 'goal' | 'reference') => {
    setActiveBuilderTemplate(type);
    setBuilderTitle('');
    setBuilderField1('');
    setBuilderField2(type === 'action' ? 'Medium' : '');
  };

  const handleInsertBuilderTemplate = () => {
    let snippet = '';
    const dateStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    switch (activeBuilderTemplate) {
      case 'insight':
        snippet = `\n\n💡 KEY INSIGHT [${dateStr}]\n=============================\n📌 Concept: ${builderTitle || 'Untitled Concept'}\n🔑 Key Observation: ${builderField1 || 'Detail observation...'}\n🧠 Depth Context: ${builderField2 || 'Why this is critical...'}\n-----------------------------`;
        break;
      case 'action':
        const priorityEmoji = builderField2 === 'High' ? '🔴' : builderField2 === 'Low' ? '🟢' : '🟡';
        snippet = `\n\n🛠️ ACTION CHECKLIST [${dateStr}]\n=============================\n[ ] ${builderTitle || 'Action Task Item'}\n📋 Process step: ${builderField1 || 'Next immediate action...'}\n⚠️ Priority: ${priorityEmoji} ${builderField2 || 'Medium'}\n-----------------------------`;
        break;
      case 'question':
        snippet = `\n\n❓ ACADEMIC QUESTION [${dateStr}]\n=============================\n❓ Query: ${builderTitle || 'Doubt title...'}\n🔬 Unresolved detail: ${builderField1 || 'What makes this confusing?'}\n💡 Verification Strategy: ${builderField2 || 'How to verify/test this...'}\n-----------------------------`;
        break;
      case 'goal':
        snippet = `\n\n🎯 STUDY TARGET [${dateStr}]\n=============================\n🎯 Goal: ${builderTitle || 'Master target topic'}\n📚 Outcome standard: ${builderField1 || 'Success conditions...'}\n📅 Immediate milestone: ${builderField2 || 'Next sub-task...'}\n-----------------------------`;
        break;
      case 'reference':
        snippet = `\n\n📖 COMPANION REFERENCE [${dateStr}]\n=============================\n📖 Resource: ${builderTitle || 'Reference material'}\n🔗 Web Link: ${builderField1 || 'URL Link...'}\n📝 Key points: ${builderField2 || 'Why this resource complements the video'}\n-----------------------------`;
        break;
    }

    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentText = textarea.value;
      const newText = currentText.substring(0, start) + snippet + currentText.substring(end);
      setNotesText(newText);
      setSaveStatus('saving');

      onUpdateVideo({
        ...video,
        studyNotes: newText
      });

      setTimeout(() => {
        setSaveStatus('saved');
      }, 400);

      textarea.focus();
    } else {
      const newText = notesText + snippet;
      setNotesText(newText);
      onUpdateVideo({
        ...video,
        studyNotes: newText
      });
    }

    setActiveBuilderTemplate(null);
  };

  const handleCopy = () => {
    const fileContent = `===========================================================
📖 STUDY DISCOVERY REPORT: ${video.title}
===========================================================
Channel: ${video.channelTitle}
Category: ${video.category}
Complexity: ${video.conceptualComplexity || 'Not Analyzed'}
Field: ${video.interdisciplinaryField || 'Not Analyzed'}
Video Link: ${video.url}
Curation Rating: ${video.rating}/5 stars

-----------------------------------------------------------
✍️ CUSTOM STUDY NOTES:
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

    navigator.clipboard.writeText(fileContent)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(err => {
        console.error('Failed to copy text:', err);
      });
  };

  const handleDownloadNotes = () => {
    const element = document.createElement("a");
    const fileContent = `===========================================================
📖 STUDY DISCOVERY REPORT: ${video.title}
===========================================================
Channel: ${video.channelTitle}
Category: ${video.category}
Complexity: ${video.conceptualComplexity || 'Not Analyzed'}
Field: ${video.interdisciplinaryField || 'Not Analyzed'}
Video Link: ${video.url}
Curation Rating: ${video.rating}/5 stars

-----------------------------------------------------------
✍️ CUSTOM STUDY NOTES:
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

  const handleSyncTasksClick = async () => {
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

  const highlightText = (text: string, highlight: string) => {
    if (!highlight || !highlight.trim()) return text;
    try {
      const parts = text.split(new RegExp(`(${highlight.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'));
      return (
        <span>
          {parts.map((part, i) => 
            part.toLowerCase() === highlight.toLowerCase()
              ? <mark key={i} className="bg-amber-400 text-slate-950 font-bold px-0.5 rounded">{part}</mark>
              : part
          )}
        </span>
      );
    } catch (e) {
      return text;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col h-screen w-screen overflow-hidden text-slate-100">
      
      {/* 1. FOCUS HEADER BAR */}
      <header className="h-14 border-b border-slate-800 bg-slate-950 px-6 flex items-center justify-between shrink-0 shadow-md">
        <div className="flex items-center gap-4">
          <button
            onClick={onExit}
            className="flex items-center gap-2 text-slate-400 hover:text-white text-xs font-bold transition-colors cursor-pointer group bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span>Exit Focus</span>
          </button>
          
          <div className="h-4 w-px bg-slate-800 hidden sm:block"></div>

          {/* Video Selector Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider hidden md:inline">Focus Resource:</span>
            <select
              value={video.id}
              onChange={(e) => {
                const selected = videos.find(v => v.id === e.target.value);
                if (selected) onSelectVideo(selected);
              }}
              className="bg-slate-900 border border-slate-800 text-slate-200 text-xs font-black px-3 py-1.5 rounded-xl outline-hidden focus:border-indigo-500/80 cursor-pointer max-w-[200px] sm:max-w-[320px] truncate"
            >
              {videos.map(v => (
                <option key={v.id} value={v.id}>
                  {v.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Academic Details Badge Center-Right */}
        <div className="flex items-center gap-2.5">
          {video.category && (
            <span className="text-[9px] font-black uppercase tracking-wider bg-amber-400/10 border border-amber-400/20 text-amber-400 px-2.5 py-1 rounded-md hidden lg:inline">
              {video.category}
            </span>
          )}
          {video.conceptualComplexity && (
            <span className="text-[9px] font-black uppercase tracking-wider bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2.5 py-1 rounded-md hidden lg:inline-flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-indigo-400"></span>
              <span>{video.conceptualComplexity}</span>
            </span>
          )}
          {video.interdisciplinaryField && (
            <span className="text-[9px] font-black uppercase tracking-wider bg-violet-500/10 border border-violet-500/20 text-violet-400 px-2.5 py-1 rounded-md hidden lg:inline-flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-violet-400"></span>
              <span>{video.interdisciplinaryField}</span>
            </span>
          )}
          
          <div className="h-4 w-px bg-slate-800 hidden lg:block"></div>

          {/* Sync actions directly available in header */}
          <div className="flex items-center gap-1.5">
            {/* Sync to Google Keep button */}
            <div className="relative flex items-center">
              <button
                type="button"
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 transition-colors text-slate-400 hover:text-white cursor-pointer"
                title="Choose Keep Note Color"
              >
                <Palette className="w-3.5 h-3.5" style={{ color: selectedKeepColor }} />
              </button>

              {showColorPicker && (
                <div className="absolute top-10 right-0 bg-slate-900 border border-slate-800 rounded-xl p-1.5 flex gap-1 z-30 shadow-2xl">
                  {KEEP_MODAL_COLORS.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => {
                        setSelectedKeepColor(c.value);
                        setShowColorPicker(false);
                      }}
                      className="w-3.5 h-3.5 rounded-full border border-slate-700 hover:scale-110 transition-transform cursor-pointer"
                      style={{ backgroundColor: c.value }}
                      title={c.name}
                    />
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => onSaveToKeep(video, selectedKeepColor)}
              className={`flex items-center gap-1 text-[10px] font-bold px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                isInKeep 
                  ? 'bg-amber-400/10 text-amber-400 border-amber-400/20 hover:bg-amber-400/20' 
                  : 'bg-amber-500 hover:bg-amber-600 border-transparent text-white shadow-xs'
              }`}
            >
              <Sparkles className={`w-3 h-3 ${isInKeep ? 'text-amber-400 fill-amber-400/10 animate-pulse' : 'text-white'}`} />
              <span className="hidden sm:inline">{isInKeep ? 'Updated Keep' : 'Sync Keep'}</span>
            </button>

            {/* Sync to Google Tasks button */}
            <button
              onClick={handleSyncTasksClick}
              disabled={isSyncing || syncSuccess}
              className={`flex items-center gap-1 text-[10px] font-bold px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                syncSuccess
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-indigo-400'
              }`}
            >
              {isSyncing ? (
                <span className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></span>
              ) : syncSuccess ? (
                <CheckCircle className="w-3 h-3 text-emerald-400" />
              ) : (
                <FileCheck className="w-3 h-3 text-indigo-400" />
              )}
              <span className="hidden sm:inline">{syncSuccess ? 'Synced Task' : 'Sync Task'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. DUAL PANEL LAYOUT */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT COLUMN: Media Player & Chronological Transcript */}
        <div className="w-[55%] flex flex-col border-r border-slate-800 h-full bg-slate-950">
          
          {/* Top Video Player Viewport */}
          <div className="aspect-video w-full max-h-[330px] bg-black border-b border-slate-900 shrink-0 relative flex items-center justify-center overflow-hidden">
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
              <div className="absolute inset-0 bg-slate-900 flex flex-col justify-between p-5 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400 shadow-inner">
                      <Headphones className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-wider text-indigo-400 font-display">Audio Study Session</span>
                      <h3 className="text-xs font-black text-slate-200 truncate max-w-sm sm:max-w-md">{video.title}</h3>
                    </div>
                  </div>
                  
                  {/* Equalizer animation */}
                  <div className="flex items-end gap-1 h-5 px-2">
                    <span className={`w-0.75 bg-indigo-400 rounded-full transition-all duration-150 ${isPlaying ? 'animate-[bounce_1s_infinite_100ms]' : 'h-1.5'}`} style={{ height: isPlaying ? undefined : '6px' }} />
                    <span className={`w-0.75 bg-indigo-400 rounded-full transition-all duration-150 ${isPlaying ? 'animate-[bounce_0.8s_infinite_200ms]' : 'h-3'}`} style={{ height: isPlaying ? undefined : '12px' }} />
                    <span className={`w-0.75 bg-indigo-400 rounded-full transition-all duration-150 ${isPlaying ? 'animate-[bounce_1.2s_infinite_300ms]' : 'h-2'}`} style={{ height: isPlaying ? undefined : '8px' }} />
                    <span className={`w-0.75 bg-indigo-400 rounded-full transition-all duration-150 ${isPlaying ? 'animate-[bounce_0.9s_infinite_400ms]' : 'h-4'}`} style={{ height: isPlaying ? undefined : '16px' }} />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={duration || 100}
                    value={currentTime}
                    onChange={handleTimelineScrub}
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-bold uppercase text-slate-500 mr-1.5">Rate:</span>
                    {[1, 1.25, 1.5, 2].map((speed) => (
                      <button
                        key={speed}
                        onClick={() => handleSpeedChange(speed)}
                        className={`text-[9px] font-black px-2 py-1 rounded-md transition-all ${
                          playbackSpeed === speed
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={togglePlay}
                    className="w-10 h-10 bg-white text-slate-900 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-md cursor-pointer shrink-0"
                  >
                    {isPlaying ? <Pause className="w-4.5 h-4.5 fill-slate-900 text-slate-900" /> : <Play className="w-4.5 h-4.5 fill-slate-900 text-slate-900 ml-0.5" />}
                  </button>

                  <a
                    href={video.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-0.5"
                  >
                    <span>Open</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 bg-slate-900 flex flex-col">
                <div className="bg-slate-800 border-b border-slate-700 px-4 py-2.5 flex items-center gap-2 text-slate-400 text-xs shrink-0 select-none">
                  <Globe className="w-3.5 h-3.5 text-slate-500" />
                  <div className="bg-slate-950 px-3 py-1 rounded-md flex-1 text-[9px] font-mono truncate text-slate-400 flex items-center gap-1.5">
                    <span className="text-emerald-500 font-black">🔒 Secure Link:</span>
                    <span>{video.url}</span>
                  </div>
                  <a
                    href={video.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-2 py-1 rounded-md text-[9px] flex items-center gap-1 transition-all"
                  >
                    <span>Open External</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <div className="flex-1 relative bg-white">
                  <iframe
                    src={video.url}
                    title={video.title}
                    className="w-full h-full border-none"
                  />
                  <div className="absolute bottom-2.5 left-2.5 right-2.5 bg-slate-950/95 text-white p-2 rounded-xl border border-slate-800 flex items-center justify-between gap-3 shadow-lg">
                    <p className="text-[9px] text-slate-400 leading-relaxed">Some websites restrict framing. Use Open External if pages block inside frames!</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Transcript review panel underneath */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            
            {/* Segment Controller and Highlights filter bar */}
            <div className="flex items-center justify-between border-b border-slate-850 pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg">
                  <Highlighter className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-200 uppercase tracking-wider font-display">AI Interactive Transcript</h3>
                  <p className="text-[9px] text-slate-500">Chronological summary and searchable key segments</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOnlyShowHighlights(!onlyShowHighlights)}
                  className={`text-[9px] font-black uppercase px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                    onlyShowHighlights
                      ? 'bg-amber-400/15 border-amber-400/30 text-amber-400'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Sparkles className="w-2.5 h-2.5" />
                  <span>Key Segments</span>
                </button>
              </div>
            </div>

            {/* Dynamic Search Input */}
            {video.transcript && (
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search transcript dialog, titles, keyword tags..."
                  value={transcriptSearchQuery}
                  onChange={(e) => setTranscriptSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500/80 rounded-xl pl-8 pr-4 py-2 text-xs text-slate-200 outline-hidden font-semibold placeholder-slate-500 transition-colors"
                />
              </div>
            )}

            {/* Transcript Engine State handlers */}
            {transcriptError && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl p-4 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-extrabold text-rose-200">Transcript extraction failed</p>
                  <p className="text-[11px] leading-relaxed opacity-90">{transcriptError}</p>
                  <button 
                    onClick={generateTranscript}
                    className="text-[10px] font-black text-white hover:underline uppercase tracking-wider block pt-1.5"
                  >
                    Retry Transcript Analysis
                  </button>
                </div>
              </div>
            )}

            {!video.transcript && !isGeneratingTranscript && (
              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 text-center space-y-4">
                <div className="w-10 h-10 bg-indigo-500/10 border border-indigo-500/20 rounded-full flex items-center justify-center mx-auto text-indigo-400 shadow-inner">
                  <Highlighter className="w-5 h-5 animate-pulse" />
                </div>
                <div className="space-y-1 max-w-sm mx-auto">
                  <h4 className="text-xs font-black text-slate-200">Reconstruct Transcript</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Trigger the Gemini AI engine to segment dialogue milestones, extract structured highlights, and align lecture timestamp pins.
                  </p>
                </div>
                <button
                  onClick={generateTranscript}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs py-2 px-4 rounded-xl shadow-lg hover:brightness-105 active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 fill-white/15" />
                  <span>Analyze & Extract Transcript</span>
                </button>
              </div>
            )}

            {isGeneratingTranscript && (
              <div className="bg-slate-900/20 border border-slate-850 rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-9 h-9 border-3 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                <div className="space-y-1">
                  <p className="text-xs font-black text-slate-200 animate-pulse">Running Gemini Transcriber Engine...</p>
                  <p className="text-[11px] text-slate-500 leading-relaxed max-w-xs">
                    Compiling chronological outlines, tagging insights, and highlighting crucial study segments.
                  </p>
                </div>
              </div>
            )}

            {/* Transcript content rendered list */}
            {video.transcript && !isGeneratingTranscript && (
              <div className="space-y-3">
                {/* Spotlight Banner */}
                <div className="bg-amber-400/5 border border-amber-400/15 rounded-xl p-3.5 space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 text-amber-400">
                    <Sparkles className="w-3.5 h-3.5 fill-amber-400/10" />
                    <span className="text-[10px] font-black uppercase tracking-wider">Spotlight Breakthroughs:</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed italic">
                    "{video.transcript.highlightsSummary}"
                  </p>
                </div>

                {/* Segment mapping list */}
                <div className="space-y-3.5 max-h-[380px] overflow-y-auto pr-1 scrollbar-thin">
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
                        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 text-center text-xs text-slate-500">
                          No transcript segments match your active search terms.
                        </div>
                      );
                    }

                    return filtered.map((seg, idx) => {
                      const isHighlight = seg.isHighlight;
                      return (
                        <div 
                          key={idx} 
                          className={`rounded-xl p-4 transition-all duration-200 border ${
                            isHighlight 
                              ? 'bg-amber-400/5 border-amber-400/30 shadow-sm' 
                              : 'bg-slate-900/40 border-slate-850 hover:border-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleTimestampClick(seg.timestamp, seg.title)}
                                className="bg-slate-800 hover:bg-amber-400 hover:text-slate-950 text-slate-300 text-[10px] font-black py-0.5 px-2 rounded-md border border-slate-700/60 cursor-pointer flex items-center gap-1 transition-all"
                                title="Click to insert timestamp at notepad cursor"
                              >
                                <Clock className="w-2.5 h-2.5" />
                                <span>{seg.timestamp}</span>
                              </button>
                              <span className="text-[9px] font-bold text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">
                                {seg.speaker}
                              </span>
                            </div>

                            {isHighlight && (
                              <span className="text-[9px] font-black uppercase text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20 flex items-center gap-1 animate-pulse">
                                ✨ Key Section
                              </span>
                            )}
                          </div>

                          <h4 className="text-xs font-black text-slate-200 mb-1 leading-snug">
                            {seg.title}
                          </h4>

                          <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                            {highlightText(seg.text, transcriptSearchQuery)}
                          </p>

                          {isHighlight && seg.highlightReason && (
                            <div className="mt-2.5 pt-2 border-t border-amber-400/20 text-[10px] text-amber-300 bg-amber-400/[0.02] p-2 rounded-lg leading-relaxed">
                              <span className="font-extrabold uppercase text-[9px] text-amber-400 block mb-0.5">Spotlight context:</span>
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

        {/* RIGHT COLUMN: Study Notepad, Snippet Builders & Notes Textarea */}
        <div className="w-[45%] flex flex-col h-full bg-slate-950 p-6 space-y-4 overflow-y-auto select-text">
          
          <div className="flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg">
                <Sparkles className="w-4 h-4 fill-indigo-400/10" />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-200 uppercase tracking-wider font-display">Study Notebook Scratchpad</h3>
                <p className="text-[9px] text-slate-500">Draft notes persist and save in real-time</p>
              </div>
            </div>

            <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full transition-all ${
              saveStatus === 'saved' 
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 animate-pulse'
            }`}>
              {saveStatus === 'saved' ? '✓ Saved' : '⚡ Saving...'}
            </span>
          </div>

          {/* Quick Snippet builders */}
          <div className="bg-slate-900/40 border border-slate-850 p-3.5 rounded-2xl space-y-2.5 shadow-md">
            {!activeBuilderTemplate ? (
              <>
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">
                  ⚡ Insert Study Snippets (Click to configure & paste):
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenBuilder('insight')}
                    className="text-[9px] font-extrabold px-2 py-1 bg-amber-400/10 hover:bg-amber-400/20 text-amber-400 border border-amber-400/20 rounded-lg cursor-pointer transition-colors flex items-center gap-1"
                  >
                    <span>💡 Key Insight</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenBuilder('action')}
                    className="text-[9px] font-extrabold px-2 py-1 bg-emerald-400/10 hover:bg-emerald-400/20 text-emerald-400 border border-emerald-400/20 rounded-lg cursor-pointer transition-colors flex items-center gap-1"
                  >
                    <span>🛠️ Task Item</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenBuilder('question')}
                    className="text-[9px] font-extrabold px-2 py-1 bg-indigo-400/10 hover:bg-indigo-400/20 text-indigo-400 border border-indigo-400/20 rounded-lg cursor-pointer transition-colors flex items-center gap-1"
                  >
                    <span>❓ Doubt Question</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenBuilder('goal')}
                    className="text-[9px] font-extrabold px-2 py-1 bg-rose-400/10 hover:bg-rose-400/20 text-rose-400 border border-rose-400/20 rounded-lg cursor-pointer transition-colors flex items-center gap-1"
                  >
                    <span>🎯 Study Goal</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenBuilder('reference')}
                    className="text-[9px] font-extrabold px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg cursor-pointer transition-colors flex items-center gap-1"
                  >
                    <span>📖 Reference</span>
                  </button>
                </div>
              </>
            ) : (
              <div className={`p-3.5 rounded-xl border space-y-3 animate-slide-in bg-slate-900 ${
                activeBuilderTemplate === 'insight' ? 'border-amber-400/30' :
                activeBuilderTemplate === 'action' ? 'border-emerald-400/30' :
                activeBuilderTemplate === 'question' ? 'border-indigo-400/30' :
                activeBuilderTemplate === 'goal' ? 'border-rose-400/30' :
                'border-slate-700'
              }`}>
                <div className="flex items-center justify-between">
                  <span className={`text-[9px] font-black uppercase tracking-wider ${
                    activeBuilderTemplate === 'insight' ? 'text-amber-400' :
                    activeBuilderTemplate === 'action' ? 'text-emerald-400' :
                    activeBuilderTemplate === 'question' ? 'text-indigo-400' :
                    activeBuilderTemplate === 'goal' ? 'text-rose-400' :
                    'text-slate-300'
                  }`}>
                    {activeBuilderTemplate === 'insight' && '💡 Key Insight Title & Observation'}
                    {activeBuilderTemplate === 'action' && '🛠️ Action Checklist Task & Priority'}
                    {activeBuilderTemplate === 'question' && '❓ Clarification Question doubts'}
                    {activeBuilderTemplate === 'goal' && '🎯 Study Target Goal Objective'}
                    {activeBuilderTemplate === 'reference' && '📖 Companion Reference Details'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveBuilderTemplate(null)}
                    className="text-[10px] font-black text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  <div>
                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-wider block mb-1">
                      {activeBuilderTemplate === 'insight' && 'Concept / Insight Title'}
                      {activeBuilderTemplate === 'action' && 'Task Name'}
                      {activeBuilderTemplate === 'question' && 'Topic / Question Doubt'}
                      {activeBuilderTemplate === 'goal' && 'Target Topic'}
                      {activeBuilderTemplate === 'reference' && 'Resource Reference Name'}
                    </label>
                    <input 
                      type="text"
                      value={builderTitle}
                      onChange={(e) => setBuilderTitle(e.target.value)}
                      placeholder="Enter title..."
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg outline-hidden text-white focus:border-indigo-500/80"
                    />
                  </div>

                  <div>
                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-wider block mb-1">
                      {activeBuilderTemplate === 'insight' && 'Key Observation details'}
                      {activeBuilderTemplate === 'action' && 'Step Details'}
                      {activeBuilderTemplate === 'question' && 'Details of doubt'}
                      {activeBuilderTemplate === 'goal' && 'Target Outcome Standards'}
                      {activeBuilderTemplate === 'reference' && 'Resource Web URL Link'}
                    </label>
                    <input 
                      type="text"
                      value={builderField1}
                      onChange={(e) => setBuilderField1(e.target.value)}
                      placeholder="Enter details..."
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg outline-hidden text-white focus:border-indigo-500/80"
                    />
                  </div>

                  <div>
                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-wider block mb-1">
                      {activeBuilderTemplate === 'insight' && 'Why this matters'}
                      {activeBuilderTemplate === 'action' && 'Task Priority'}
                      {activeBuilderTemplate === 'question' && 'How you will verify/test'}
                      {activeBuilderTemplate === 'goal' && 'Immediate next milestone'}
                      {activeBuilderTemplate === 'reference' && 'Resource quick takeaways'}
                    </label>
                    {activeBuilderTemplate === 'action' ? (
                      <select
                        value={builderField2}
                        onChange={(e) => setBuilderField2(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg outline-hidden text-white focus:border-indigo-500 cursor-pointer"
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
                        placeholder="Enter complementary context..."
                        className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg outline-hidden text-white focus:border-indigo-500/80"
                      />
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setActiveBuilderTemplate(null)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[9px] uppercase rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleInsertBuilderTemplate}
                    className={`px-3 py-1.5 font-bold text-[9px] uppercase rounded-lg text-white transition-colors cursor-pointer shadow-xs ${
                      activeBuilderTemplate === 'insight' ? 'bg-amber-500 hover:bg-amber-600' :
                      activeBuilderTemplate === 'action' ? 'bg-emerald-600 hover:bg-emerald-700' :
                      activeBuilderTemplate === 'question' ? 'bg-indigo-600 hover:bg-indigo-700' :
                      activeBuilderTemplate === 'goal' ? 'bg-rose-500 hover:bg-rose-600' :
                      'bg-slate-700 hover:bg-slate-600'
                    }`}
                  >
                    Insert Snippet
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Core Textarea Note space */}
          <div className="flex-1 flex flex-col relative min-h-[340px]">
            <textarea
              ref={textareaRef}
              value={notesText}
              onChange={handleNotesChange}
              placeholder="✍️ Start writing your custom study notes here... Use the interactive transcript on the left to review key concepts. Clicking timestamps inserts them directly at your cursor!"
              className="w-full flex-1 p-5 bg-slate-900 border border-slate-800 hover:border-slate-750 focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/20 rounded-2xl text-xs outline-hidden text-slate-200 resize-none font-sans leading-relaxed shadow-inner"
            />
            {/* statistics absolute overlay */}
            <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 bg-slate-950/95 py-1 px-2.5 rounded-lg border border-slate-800 text-[9px] font-bold text-slate-400 font-mono">
              <span>{notesText.length} chars</span>
              <span>•</span>
              <span>{notesText.trim() ? notesText.trim().split(/\s+/).filter(Boolean).length : 0} words</span>
            </div>
          </div>

          {/* Export tools */}
          <div className="flex items-center justify-between bg-slate-900 border border-slate-850 rounded-xl p-2.5 shrink-0">
            <span className="text-[10px] text-slate-400 font-medium">
              📥 Export Curation Notes:
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-[10px] font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded-lg cursor-pointer transition-all"
              >
                <Copy className="w-3 h-3 text-indigo-400" />
                <span>{copied ? 'Copied Summary!' : 'Copy Markdown'}</span>
              </button>
              <button
                onClick={handleDownloadNotes}
                className="flex items-center gap-1 text-[10px] font-bold text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 px-3 py-1.5 rounded-lg cursor-pointer transition-all"
              >
                <Download className="w-3 h-3" />
                <span>Export TXT</span>
              </button>
              <button
                onClick={handleClearNotes}
                className="flex items-center gap-1 text-[10px] font-bold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 px-3 py-1.5 rounded-lg cursor-pointer transition-all"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear Notepad</span>
              </button>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
