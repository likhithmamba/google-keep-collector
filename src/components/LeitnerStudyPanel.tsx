import React, { useState, useMemo } from 'react';
import { BookOpen, Check, X, AlertCircle, Sparkles, Award, RotateCcw, ArrowRight, HelpCircle, GraduationCap } from 'lucide-react';
import { VideoItem } from '../types';

interface LeitnerStudyPanelProps {
  videos: VideoItem[];
  onUpdateVideo: (video: VideoItem) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

// Leitner intervals in days
const LEITNER_INTERVALS: Record<number, number> = {
  1: 1,  // Box 1: daily
  2: 2,  // Box 2: every 2 days
  3: 5,  // Box 3: every 5 days
  4: 9,  // Box 4: every 9 days
  5: 14, // Box 5: every 14 days
};

export default function LeitnerStudyPanel({
  videos,
  onUpdateVideo,
  showToast
}: LeitnerStudyPanelProps) {
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [isTakeawaysRevealed, setIsTakeawaysRevealed] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  // Parse due cards
  const studyDeck = useMemo(() => {
    const now = new Date();
    
    // A video is due if it has been queued (leitnerBox >= 1) and nextReviewDate is reached or past,
    // or if it has not been queued but we want to review it (unlocked via "Queue for Study").
    return videos.filter(video => {
      if (!video.leitnerBox || video.leitnerBox === 0) return false;
      if (!video.nextReviewDate) return true;
      return new Date(video.nextReviewDate) <= now;
    });
  }, [videos]);

  // Unqueued videos (new curations available to start Leitner study)
  const unqueuedVideos = useMemo(() => {
    return videos.filter(video => !video.leitnerBox || video.leitnerBox === 0);
  }, [videos]);

  // General Box distribution counts
  const distribution = useMemo(() => {
    const boxes = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    videos.forEach(v => {
      const box = (v.leitnerBox || 0) as keyof typeof boxes;
      if (box in boxes) {
        boxes[box]++;
      }
    });
    return boxes;
  }, [videos]);

  // Queue a video for Leitner box study (starts at Box 1)
  const handleQueueForStudy = (video: VideoItem) => {
    const updated: VideoItem = {
      ...video,
      leitnerBox: 1,
      nextReviewDate: new Date().toISOString(), // due immediately
      lastReviewedDate: undefined
    };
    onUpdateVideo(updated);
    showToast(`"${video.title}" queued in Leitner Box 1 for spaced repetition!`, 'success');
  };

  // Queue all unqueued videos at once for convenience
  const handleQueueAll = () => {
    if (unqueuedVideos.length === 0) return;
    unqueuedVideos.forEach(v => {
      const updated: VideoItem = {
        ...v,
        leitnerBox: 1,
        nextReviewDate: new Date().toISOString()
      };
      onUpdateVideo(updated);
    });
    showToast(`Queued ${unqueuedVideos.length} new resources for spaced study!`, 'success');
  };

  // Handle User Recall Rating
  const handleRateRecall = (remembered: boolean) => {
    if (studyDeck.length === 0) return;
    const currentVideo = studyDeck[activeCardIndex];
    
    let nextBox = 1;
    if (remembered) {
      // Advance to next box, capped at Box 5
      nextBox = Math.min((currentVideo.leitnerBox || 1) + 1, 5);
    } else {
      // Reset back to Box 1 upon forgotten
      nextBox = 1;
    }

    // Compute next study date
    const intervalDays = LEITNER_INTERVALS[nextBox];
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + intervalDays);

    const updatedVideo: VideoItem = {
      ...currentVideo,
      leitnerBox: nextBox,
      lastReviewedDate: new Date().toISOString(),
      nextReviewDate: nextDate.toISOString()
    };

    onUpdateVideo(updatedVideo);
    showToast(
      remembered 
        ? `Remembered! Card promoted to Box ${nextBox}. Next review in ${intervalDays} days.`
        : `Forgotten. Card demoted to Box 1. Due again tomorrow.`,
      remembered ? 'success' : 'info'
    );

    // Reset card state
    setIsTakeawaysRevealed(false);
    // Adjust active index
    if (activeCardIndex >= studyDeck.length - 1) {
      setActiveCardIndex(0);
    }
  };

  const currentActiveCard = studyDeck[activeCardIndex] || null;

  return (
    <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm flex flex-col space-y-6 select-none h-full">
      {/* Title Header */}
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-red text-white rounded-2xl flex items-center justify-center font-black text-lg shadow-md shadow-brand-red/20">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-black text-brand-ink uppercase tracking-wider font-display flex items-center gap-1.5">
              <span>Leitner Retention Arena</span>
            </h2>
            <p className="text-[10px] text-slate-500 font-medium">Spaced repetition memory consolidation queue</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowExplanation(!showExplanation)}
          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
          title="Leitner box rules explanation"
        >
          <HelpCircle className="w-4.5 h-4.5" />
        </button>
      </div>

      {/* Spaced repetition rules explanation */}
      {showExplanation && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs space-y-2 animate-slide-in leading-relaxed font-semibold text-slate-600">
          <h4 className="font-bold text-brand-ink uppercase tracking-wider text-[10px] flex items-center gap-1">
            <GraduationCap className="w-3.5 h-3.5 text-brand-red" />
            Spaced-Repetition Leitner System
          </h4>
          <p>
            An active retrieval method that bypasses the short-term memory bottleneck. Taking your curated video takeaways:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 font-mono text-[9px]">
            <div className="bg-white p-1.5 border border-slate-200 rounded">📦 Box 1: Daily</div>
            <div className="bg-white p-1.5 border border-slate-200 rounded">📦 Box 2: 2 days</div>
            <div className="bg-white p-1.5 border border-slate-200 rounded">📦 Box 3: 5 days</div>
            <div className="bg-white p-1.5 border border-slate-200 rounded">📦 Box 4: 9 days</div>
            <div className="bg-white p-1.5 border border-slate-200 rounded">🏆 Box 5: 14 days</div>
          </div>
          <p className="text-[10.5px]">
            • If you correctly <strong className="text-emerald-700">Remember</strong>, the card advances to the next box, widening the review gap. <br />
            • If you <strong className="text-rose-700">Forget</strong>, the card resets immediately to Box 1. Master Box 5 to lock in lifelong conceptual recall!
          </p>
        </div>
      )}

      {/* Box Distribution Metrics */}
      <div className="bg-brand-paper/40 border border-brand-ink/10 rounded-2xl p-4 space-y-3.5 select-text">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Leitner Grid Distribution</h4>
        
        <div className="grid grid-cols-5 gap-2 text-center">
          {[1, 2, 3, 4, 5].map(b => (
            <div key={b} className="bg-white border border-slate-200 rounded-xl p-2.5 flex flex-col justify-between">
              <span className="text-[9px] font-bold text-slate-400 uppercase">Box {b}</span>
              <span className="text-sm font-black text-brand-ink my-0.5">{distribution[b as keyof typeof distribution]}</span>
              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                <div 
                  className={`h-full ${b === 5 ? 'bg-emerald-500' : 'bg-brand-red'}`} 
                  style={{ width: `${videos.length > 0 ? (distribution[b as keyof typeof distribution] / videos.length) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Review Active Card Stage */}
      <div className="flex-1 flex flex-col justify-between">
        {studyDeck.length > 0 && currentActiveCard ? (
          <div className="space-y-4 flex-1 flex flex-col justify-between min-h-[340px]">
            {/* Stage Title / Navigation header */}
            <div className="flex items-center justify-between text-xs font-bold text-slate-400">
              <span className="bg-brand-red text-white text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                Box {currentActiveCard.leitnerBox} Card
              </span>
              <span>
                Card {activeCardIndex + 1} of {studyDeck.length} due
              </span>
            </div>

            {/* Main Interactive Card */}
            <div className="bg-white border-2 border-brand-ink rounded-3xl p-5.5 flex flex-col justify-between shadow-2xs relative overflow-hidden flex-1 min-h-[220px]">
              
              {/* Abstract decorative layout corner */}
              <div className="absolute top-0 right-0 w-8 h-8 bg-brand-ink text-white rounded-bl-3xl flex items-center justify-center font-bold text-xs select-none">
                {currentActiveCard.leitnerBox}
              </div>

              <div className="space-y-3.5 flex-1 select-text">
                <div className="space-y-1">
                  <span className="text-[9px] font-black uppercase text-brand-red tracking-wider">
                    {currentActiveCard.category}
                  </span>
                  <h3 className="text-sm font-black text-brand-ink leading-snug pr-4">
                    {currentActiveCard.title}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-semibold font-mono">
                    by {currentActiveCard.channelTitle}
                  </p>
                </div>

                <div className="border-t border-slate-150/40 pt-3">
                  {!isTakeawaysRevealed ? (
                    <div className="py-4 text-center space-y-2">
                      <p className="text-xs text-slate-500 font-semibold italic">
                        "Can you recall the core takeaways, lessons, or methodologies covered in this video curation?"
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 animate-slide-in">
                      <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                        <BookOpen className="w-3 h-3 text-brand-red" />
                        Takeaway Key Checkpoints
                      </h4>
                      <ul className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1 scrollbar-thin">
                        {currentActiveCard.takeaways.map((takeaway, idx) => (
                          <li key={idx} className="text-[11px] leading-relaxed text-slate-600 font-semibold bg-brand-paper/35 p-2 rounded-lg border border-slate-100 flex items-start gap-2">
                            <span className="w-3.5 h-3.5 bg-brand-ink text-brand-paper rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">{idx + 1}</span>
                            <span>{takeaway}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* Reveal trigger or recall rate controls */}
              <div className="pt-4 mt-3 border-t border-slate-900/5">
                {!isTakeawaysRevealed ? (
                  <button
                    type="button"
                    onClick={() => setIsTakeawaysRevealed(true)}
                    className="w-full bg-brand-ink hover:bg-slate-800 text-brand-paper font-extrabold text-xs py-2.5 rounded-xl transition-all cursor-pointer shadow-xs uppercase tracking-wider flex items-center justify-center gap-1.5"
                  >
                    <span>Reveal Takeaways to Self-Rate</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <div className="grid grid-cols-2 gap-3.5 animate-scale-in">
                    <button
                      type="button"
                      onClick={() => handleRateRecall(false)}
                      className="w-full bg-white border-2 border-brand-ink hover:bg-rose-50 text-rose-700 hover:text-rose-800 font-extrabold text-xs py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 uppercase tracking-wider shadow-2xs"
                    >
                      <X className="w-4 h-4 text-rose-500 stroke-[3]" />
                      <span>Forgot</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRateRecall(true)}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 uppercase tracking-wider shadow-xs"
                    >
                      <Check className="w-4 h-4 text-white stroke-[3]" />
                      <span>Remembered</span>
                    </button>
                  </div>
                )}
              </div>

            </div>

            {/* Skip / Next arrow */}
            {studyDeck.length > 1 && (
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                <span className="text-[10px] text-slate-400">Rate honestly to promote/demote box intervals</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsTakeawaysRevealed(false);
                    setActiveCardIndex(prev => (prev + 1) % studyDeck.length);
                  }}
                  className="hover:text-brand-ink flex items-center gap-1 cursor-pointer"
                >
                  <span>Skip Card</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400 text-center space-y-4">
            <div className="p-4 bg-emerald-50 text-emerald-500 border border-emerald-100 rounded-full flex items-center justify-center">
              <Award className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Review Deck Clear!</h3>
              <p className="text-[10px] text-slate-500 max-w-[280px] leading-relaxed font-semibold">
                Outstanding! No cards are due for spaced repetition review today. Your current memorization is consolidated.
              </p>
            </div>
            
            {unqueuedVideos.length > 0 && (
              <div className="pt-4 border-t border-slate-100 w-full max-w-sm space-y-3">
                <p className="text-[10px] text-slate-500 font-semibold">
                  You have <strong className="text-slate-800">{unqueuedVideos.length} new curations</strong> in your bookshelf not yet added to the Leitner repetition queue. Start memorizing them:
                </p>
                
                <div className="max-h-[160px] overflow-y-auto border border-slate-200 rounded-xl bg-slate-50/50 p-2 space-y-1.5 pr-1 scrollbar-thin">
                  {unqueuedVideos.map(v => (
                    <div key={v.id} className="bg-white p-2 rounded-lg border border-slate-150 flex items-center justify-between gap-3 text-xs">
                      <span className="font-extrabold truncate text-slate-800 pr-1 select-text text-left flex-1">{v.title}</span>
                      <button
                        type="button"
                        onClick={() => handleQueueForStudy(v)}
                        className="bg-brand-ink hover:bg-slate-800 text-brand-paper font-black text-[9px] uppercase tracking-wider py-1 px-2.5 rounded-md cursor-pointer shrink-0"
                      >
                        Queue Study
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleQueueAll}
                  className="w-full border-2 border-brand-ink hover:bg-brand-ink hover:text-brand-paper text-brand-ink font-black text-[10px] uppercase py-2 rounded-xl transition-all cursor-pointer tracking-wider flex items-center justify-center gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  <span>Queue All ({unqueuedVideos.length}) New Cards</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
