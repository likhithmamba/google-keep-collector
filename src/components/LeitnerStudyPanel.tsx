import React, { useState, useMemo } from 'react';
import { BookOpen, Check, X, AlertCircle, Sparkles, Award, RotateCcw, ArrowRight, HelpCircle, GraduationCap } from 'lucide-react';
import { VideoItem } from '../types';

interface LeitnerStudyPanelProps {
  videos: VideoItem[];
  onUpdateVideo: (video: VideoItem) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

interface StudyFlashcard {
  video: VideoItem;
  takeaway: string;
  takeawayIndex: number;
  totalTakeaways: number;
}

// Leitner intervals in days: Box 1 = 1 day, Box 2 = 3 days, Box 3 = 7 days, Box 4 = 14 days, Box 5 = 30 days
const LEITNER_INTERVALS: Record<number, number> = {
  1: 1,
  2: 3,
  3: 7,
  4: 14,
  5: 30,
};

export default function LeitnerStudyPanel({
  videos,
  onUpdateVideo,
  showToast
}: LeitnerStudyPanelProps) {
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [isTakeawaysRevealed, setIsTakeawaysRevealed] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  // Parse due cards: expand each due video's takeaways into separate flashcards
  const studyDeck = useMemo(() => {
    const now = new Date();
    
    const dueVideos = videos.filter(video => {
      if (!video.leitnerBox || video.leitnerBox === 0) return false;
      if (!video.nextReviewDate) return true;
      return new Date(video.nextReviewDate) <= now;
    });

    const cards: StudyFlashcard[] = [];
    dueVideos.forEach(video => {
      const tList = video.takeaways || [];
      tList.forEach((takeaway, idx) => {
        cards.push({
          video,
          takeaway,
          takeawayIndex: idx,
          totalTakeaways: tList.length
        });
      });
    });

    return cards;
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
  const handleRateRecall = (rating: 'easy' | 'good' | 'hard') => {
    if (studyDeck.length === 0) return;
    const currentCard = studyDeck[activeCardIndex];
    const { video } = currentCard;
    
    let nextBox = 1;
    if (rating === 'easy' || rating === 'good') {
      nextBox = Math.min((video.leitnerBox || 1) + 1, 5);
    } else {
      nextBox = 1; // reset on hard
    }

    const intervalDays = LEITNER_INTERVALS[nextBox];
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + intervalDays);

    const updatedVideo: VideoItem = {
      ...video,
      leitnerBox: nextBox,
      lastReviewedDate: new Date().toISOString(),
      nextReviewDate: nextDate.toISOString()
    };

    onUpdateVideo(updatedVideo);
    
    if (rating === 'hard') {
      showToast(`Review reset to Box 1. Due again tomorrow.`, 'info');
    } else {
      showToast(`Card promoted to Box ${nextBox}. Next review in ${intervalDays} days.`, 'success');
    }

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
          <div className="w-10 h-10 bg-brand-ink text-brand-paper rounded-2xl flex items-center justify-center font-black text-lg">
            <GraduationCap className="w-5 h-5" />
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

      {/* Spaced-Repetition Leitner System Rules */}
      {showExplanation && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs space-y-2 animate-slide-in leading-relaxed font-semibold text-slate-600">
          <h4 className="font-bold text-brand-ink uppercase tracking-wider text-[10px] flex items-center gap-1">
            <GraduationCap className="w-3.5 h-3.5" />
            Spaced-Repetition Leitner System
          </h4>
          <p>
            An active retrieval method that bypasses the short-term memory bottleneck. Taking your curated video takeaways:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 font-mono text-[9px]">
            <div className="bg-white p-1.5 border border-slate-200 rounded">Box 1: 1 day</div>
            <div className="bg-white p-1.5 border border-slate-200 rounded">Box 2: 3 days</div>
            <div className="bg-white p-1.5 border border-slate-200 rounded">Box 3: 7 days</div>
            <div className="bg-white p-1.5 border border-slate-200 rounded">Box 4: 14 days</div>
            <div className="bg-white p-1.5 border border-slate-200 rounded font-bold">Box 5: 30 days</div>
          </div>
          <p className="text-[10.5px]">
            • Correctly self-rating <strong>Good</strong> or <strong>Easy</strong> advances the parent video to the next box, widening the review gap. <br />
            • Self-rating <strong>Hard</strong> resets the video immediately to Box 1 so you can practice again tomorrow.
          </p>
        </div>
      )}

      {/* Box Distribution Metrics */}
      <div className="bg-brand-paper border border-brand-ink/10 rounded-2xl p-4 space-y-3.5 select-text">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Leitner Grid Distribution</h4>
        
        <div className="grid grid-cols-5 gap-2 text-center">
          {[1, 2, 3, 4, 5].map(b => (
            <div key={b} className="bg-white border border-slate-200 rounded-xl p-2.5 flex flex-col justify-between">
              <span className="text-[9px] font-bold text-slate-400 uppercase">Box {b}</span>
              <span className="text-sm font-black text-brand-ink my-0.5">{distribution[b as keyof typeof distribution]}</span>
              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                <div 
                  className={`h-full ${b === 5 ? 'bg-emerald-500' : 'bg-brand-ink'}`} 
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
              <span className="bg-brand-ink text-brand-paper text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                Box {currentActiveCard.video.leitnerBox} Flashcard
              </span>
              <span>
                Card {activeCardIndex + 1} of {studyDeck.length} due
              </span>
            </div>

            {/* Main Interactive Card */}
            <div className="bg-white border-2 border-brand-ink rounded-3xl p-5.5 flex flex-col justify-between shadow-2xs relative overflow-hidden flex-1 min-h-[220px]">
              
              {/* Abstract decorative layout corner */}
              <div className="absolute top-0 right-0 w-8 h-8 bg-brand-ink text-brand-paper rounded-bl-3xl flex items-center justify-center font-bold text-xs select-none">
                {currentActiveCard.video.leitnerBox}
              </div>

              <div className="space-y-3.5 flex-1 select-text">
                <div className="space-y-1">
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                    {currentActiveCard.video.category} • Takeaway {currentActiveCard.takeawayIndex + 1} of {currentActiveCard.totalTakeaways}
                  </span>
                  <h4 className="text-[10px] text-slate-400 font-semibold font-mono">
                    Parent Material: "{currentActiveCard.video.title}"
                  </h4>
                  <div className="border-t border-slate-100 pt-2 mt-1">
                    <span className="text-[11px] font-black uppercase text-slate-500 tracking-wider">Core takeaway concept check</span>
                  </div>
                </div>

                <div className="pt-2">
                  {!isTakeawaysRevealed ? (
                    <div className="py-6 text-center">
                      <p className="text-xs text-brand-ink font-bold">
                        "Can you recall the explanation and details behind this key takeaway checkpoint?"
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 animate-slide-in">
                      <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                        <BookOpen className="w-3 h-3" />
                        Takeaway Details
                      </h5>
                      <div className="text-[12.5px] leading-relaxed text-brand-ink font-semibold bg-brand-paper p-3.5 rounded-xl border border-slate-200">
                        {currentActiveCard.takeaway}
                      </div>
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
                    <span>Reveal Answer</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <div className="grid grid-cols-3 gap-2 animate-scale-in">
                    <button
                      type="button"
                      onClick={() => handleRateRecall('hard')}
                      className="bg-white border-2 border-brand-ink hover:bg-slate-50 text-slate-700 font-extrabold text-xs py-2.5 rounded-xl transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 uppercase tracking-wider shadow-2xs"
                    >
                      <span className="font-black text-rose-600">Hard</span>
                      <span className="text-[8px] text-slate-400 lowercase">reset</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRateRecall('good')}
                      className="bg-white border-2 border-brand-ink hover:bg-slate-50 text-slate-700 font-extrabold text-xs py-2.5 rounded-xl transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 uppercase tracking-wider shadow-2xs"
                    >
                      <span className="font-black text-brand-ink">Good</span>
                      <span className="text-[8px] text-slate-400 lowercase">level up</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRateRecall('easy')}
                      className="bg-brand-ink hover:bg-slate-800 text-brand-paper font-extrabold text-xs py-2.5 rounded-xl transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 uppercase tracking-wider shadow-xs"
                    >
                      <span className="font-black text-emerald-400">Easy</span>
                      <span className="text-[8px] text-slate-300 lowercase">level up</span>
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
            <div className="p-4 bg-slate-50 text-slate-600 border border-slate-100 rounded-full flex items-center justify-center">
              <Award className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Review Deck Clear!</h3>
              <p className="text-[10px] text-slate-500 max-w-[280px] leading-relaxed font-semibold">
                Outstanding! No flashcards are due for spaced repetition review today. Your current memorization is consolidated.
              </p>
            </div>
            
            {unqueuedVideos.length > 0 && (
              <div className="pt-4 border-t border-slate-100 w-full max-w-sm space-y-3">
                <p className="text-[10px] text-slate-500 font-semibold">
                  You have <strong className="text-slate-800">{unqueuedVideos.length} new curations</strong> not yet added to the Leitner repetition queue. Start memorizing them:
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
                  <Sparkles className="w-3.5 h-3.5" />
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
