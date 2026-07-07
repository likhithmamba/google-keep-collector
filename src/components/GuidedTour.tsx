import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Sparkles, 
  Youtube, 
  BookOpen, 
  FolderHeart, 
  ListTodo, 
  Settings, 
  CheckCircle2, 
  ArrowRight,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TourStep {
  title: string;
  description: string;
  targetId: string;
  icon: React.ReactNode;
  position: 'center' | 'bottom' | 'top' | 'left' | 'right';
  badge: string;
}

interface GuidedTourProps {
  isOpen: boolean;
  onClose: () => void;
  onHighlightElement?: (id: string) => void;
}

export default function GuidedTour({ isOpen, onClose, onHighlightElement }: GuidedTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  
  const tourSteps: TourStep[] = [
    {
      title: "Welcome to CurateMind AI Workspace! 📚",
      description: "CurateMind AI is an academic-grade workspace. It intercepts raw links to strip sensational clickbait, grades true scholastic/pedagogical value, generates detailed chronological takeaways, and indexes full timestamped transcripts. Let's take a 6-step interactive tour to master your research dashboard!",
      targetId: "", // Centers on screen
      icon: <Sparkles className="w-6 h-6 text-indigo-500 fill-indigo-100/50" />,
      position: 'center',
      badge: "Step 1 of 6: Welcome"
    },
    {
      title: "Resource Curation Station 📥",
      description: "This is your primary curation entry point. Paste any standard educational video URL, podcast audio link, or research resource and press Analyze. Our Gemini API server-side model processes the media, extracts key data points, and categorizes it immediately.",
      targetId: "onboarding-import-form",
      icon: <BookOpen className="w-6 h-6 text-indigo-600" />,
      position: 'bottom',
      badge: "Step 2 of 6: URL Import"
    },
    {
      title: "Filter & Curation Bookshelf 📚",
      description: "All curated videos are archived in this interactive shelf. You can filter by category tabs, search by creator or topic keywords, filter by star ratings, sort cards, or toggle study progress (To Watch / Watching / Done).",
      targetId: "onboarding-bookshelf",
      icon: <BookOpen className="w-6 h-6 text-amber-500" />,
      position: 'bottom',
      badge: "Step 3 of 6: Bookshelf"
    },
    {
      title: "Draft Keep Board 📌",
      description: "This sidebar is your local Google Keep styled notepad workspace. Curation summaries instantly compile here as color-coded, editable sticky notes. Click 'Copy' to immediately transfer them into your official Google Keep!",
      targetId: "onboarding-keep-panel",
      icon: <FolderHeart className="w-6 h-6 text-yellow-500 fill-yellow-50/50" />,
      position: 'left',
      badge: "Step 4 of 6: Draft Notepad"
    },
    {
      title: "Google Tasks Sync Hub ☁️",
      description: "Toggle this tab to sync video takeaway lists directly with your official Google Tasks app. Once synced, your study checklists will magically show up inside your Google Calendar, Google Tasks, and Gmail sidebars!",
      targetId: "onboarding-tasks-tab",
      icon: <ListTodo className="w-6 h-6 text-indigo-500" />,
      position: 'left',
      badge: "Step 5 of 6: Cloud Task Sync"
    },
    {
      title: "API Settings & Scale Panel ⚙️",
      description: "Unleash extreme capabilities! Open this modal to use OpenRouter (Gemini 2.5 Pro, LLaMA 3.3, DeepSeek), password-protect your configurations, encode local storage ciphers, or run a stress simulation of 100+ parallel users!",
      targetId: "onboarding-settings-btn",
      icon: <Settings className="w-6 h-6 text-amber-500" />,
      position: 'bottom',
      badge: "Step 6 of 6: Pro Configurations"
    }
  ];

  const step = tourSteps[currentStep];

  // Dynamic targeting & element coordinate tracking
  useEffect(() => {
    if (!isOpen) return;

    const targetId = step.targetId;
    if (!targetId) {
      setCoords(null);
      return;
    }

    const element = document.getElementById(targetId);
    if (element) {
      // Scroll to element gently
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Highlight custom actions if App wants to know
      if (onHighlightElement) {
        onHighlightElement(targetId);
      }

      const updateCoordinates = () => {
        const rect = element.getBoundingClientRect();
        setCoords({
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          height: rect.height
        });
      };

      // Set initial delay to let smooth scroll settle
      const timeoutId = setTimeout(updateCoordinates, 300);

      window.addEventListener('resize', updateCoordinates);
      window.addEventListener('scroll', updateCoordinates);

      return () => {
        clearTimeout(timeoutId);
        window.removeEventListener('resize', updateCoordinates);
        window.removeEventListener('scroll', updateCoordinates);
      };
    } else {
      setCoords(null);
    }
  }, [currentStep, isOpen, step.targetId]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      // Finished!
      localStorage.setItem('tubekeep_onboard_completed', 'true');
      onClose();
      setCurrentStep(0);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    localStorage.setItem('tubekeep_onboard_completed', 'true');
    onClose();
    setCurrentStep(0);
  };

  // Determine dialog card coordinates
  let cardStyle: React.CSSProperties = {};
  if (coords) {
    const margin = 16;
    if (step.position === 'bottom') {
      cardStyle = {
        position: 'absolute',
        top: `${coords.top + coords.height + margin}px`,
        left: `${Math.max(margin, Math.min(window.innerWidth - 380, coords.left + (coords.width / 2) - 175))}px`,
        width: '350px'
      };
    } else if (step.position === 'top') {
      cardStyle = {
        position: 'absolute',
        top: `${coords.top - 250}px`,
        left: `${Math.max(margin, Math.min(window.innerWidth - 380, coords.left + (coords.width / 2) - 175))}px`,
        width: '350px'
      };
    } else if (step.position === 'left') {
      cardStyle = {
        position: 'absolute',
        top: `${coords.top}px`,
        left: `${Math.max(margin, coords.left - 366)}px`,
        width: '350px'
      };
    } else {
      cardStyle = {
        position: 'absolute',
        top: `${coords.top + coords.height + margin}px`,
        left: `${Math.max(margin, Math.min(window.innerWidth - 380, coords.left + (coords.width / 2) - 175))}px`,
        width: '350px'
      };
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto font-sans">
      
      {/* Dimmed Backdrop Mask with Highlight Hole */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-all duration-300 pointer-events-auto">
        {coords && (
          <div 
            className="absolute rounded-2xl border-2 border-amber-400 bg-white/5 shadow-[0_0_40px_rgba(245,158,11,0.4)] animate-pulse pointer-events-none transition-all duration-300"
            style={{
              top: `${coords.top - 8}px`,
              left: `${coords.left - 8}px`,
              width: `${coords.width + 16}px`,
              height: `${coords.height + 16}px`,
            }}
          />
        )}
      </div>

      {/* Floating Card Container */}
      <div className="relative w-full h-full min-h-screen p-4 flex items-center justify-center pointer-events-none">
        
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, scale: 0.9, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -15 }}
            transition={{ duration: 0.25 }}
            className="bg-white rounded-3xl p-6 shadow-[0_20px_50px_rgba(15,23,42,0.3)] border border-slate-100 flex flex-col space-y-4 pointer-events-auto max-w-sm w-full"
            style={coords ? cardStyle : { maxW: '400px' }}
          >
            {/* Header Badge */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100 uppercase tracking-widest">
                {step.badge}
              </span>
              <button 
                onClick={handleSkip}
                className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Icon + Title */}
            <div className="flex gap-3 items-start">
              <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-2xl shrink-0">
                {step.icon}
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-black text-slate-900 font-display leading-tight">
                  {step.title}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                  {step.description}
                </p>
              </div>
            </div>

            {/* Progress dots & Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              {/* Stepper Dots */}
              <div className="flex gap-1.5">
                {tourSteps.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentStep(idx)}
                    className={`w-1.5 h-1.5 rounded-full transition-all ${
                      idx === currentStep ? 'w-4 bg-amber-500' : 'bg-slate-200 hover:bg-slate-300'
                    }`}
                  />
                ))}
              </div>

              {/* Navigation buttons */}
              <div className="flex gap-2">
                {currentStep > 0 && (
                  <button
                    onClick={handlePrev}
                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl hover:text-slate-900 transition-all cursor-pointer"
                    title="Previous Step"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                )}
                
                <button
                  onClick={handleNext}
                  className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black px-4 py-2 rounded-xl transition-all cursor-pointer shadow-xs"
                >
                  {currentStep === tourSteps.length - 1 ? (
                    <>
                      <span>Get Started</span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400/10" />
                    </>
                  ) : (
                    <>
                      <span>Next</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Tip overlay */}
            <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 flex items-center justify-between gap-2">
              <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>You can abort this tour anytime by pressing Skip.</span>
              </span>
              <button
                onClick={handleSkip}
                className="text-[10px] font-extrabold text-slate-400 hover:text-rose-500"
              >
                Skip Tour
              </button>
            </div>
            
          </motion.div>
        </AnimatePresence>

      </div>

    </div>
  );
}
