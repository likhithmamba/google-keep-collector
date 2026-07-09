import React, { useState, useEffect, useMemo } from 'react';
import { User } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { 
  initAuth, 
  googleSignIn, 
  logout, 
  createGoogleTask, 
  getAccessToken 
} from './lib/auth';
import { presetVideos } from './lib/presets';
import { VideoItem, KeepNote, CategoryType, LinkedAccount, AppSettings } from './types';
import SignInButton from './components/SignInButton';
import VideoForm from './components/VideoForm';
import VideoCard from './components/VideoCard';
import KeepPanel from './components/KeepPanel';
import TasksPanel from './components/TasksPanel';
import VideoDetailModal from './components/VideoDetailModal';
import AcademicFocusMode from './components/AcademicFocusMode';
import SettingsModal from './components/SettingsModal';
import GuidedTour from './components/GuidedTour';
import TopicDiscoveryGraph from './components/TopicDiscoveryGraph';
import KeepImportModal from './components/KeepImportModal';
import LeitnerStudyPanel from './components/LeitnerStudyPanel';
import { 
  Sparkles, 
  Youtube, 
  BookOpen, 
  FolderHeart, 
  Filter, 
  Search, 
  Star, 
  ArrowUpDown,
  Compass,
  LayoutGrid,
  TrendingUp,
  SlidersHorizontal,
  Info,
  ListTodo,
  CheckSquare,
  Square,
  Trash2,
  X,
  Check,
  Settings,
  Link2,
  Globe,
  Headphones,
  Plus,
  ExternalLink,
  Music,
  Flame
} from 'lucide-react';

// Helper functions for base64 local storage obscurity
const maybeEncode = (data: any, encode: boolean): string => {
  const str = JSON.stringify(data);
  if (encode) {
    try {
      return 'b64_' + btoa(unescape(encodeURIComponent(str)));
    } catch (e) {
      console.error("Encoding failed, falling back to plain string", e);
    }
  }
  return str;
};

const maybeDecode = (stored: string | null): any => {
  if (!stored) return null;
  if (stored.startsWith('b64_')) {
    try {
      const b64Part = stored.substring(4);
      return JSON.parse(decodeURIComponent(escape(atob(b64Part))));
    } catch (e) {
      console.error("Failed to decode base64 data, trying plain parse", e);
    }
  }
  try {
    return JSON.parse(stored);
  } catch (e) {
    return null;
  }
};

const extractUrlsFromText = (text: string): string[] => {
  const urlRegex = /(https?:\/\/[^\s\n\r"']+)/gi;
  const matches = text.match(urlRegex);
  return matches ? Array.from(new Set(matches)) : [];
};

const calculateStreak = (videos: VideoItem[]): number => {
  const activeDates = videos
    .map(v => v.lastWatchedDate || v.lastReviewedDate)
    .filter(Boolean)
    .map(d => new Date(d!).toDateString());
  
  const uniqueDates = Array.from(new Set(activeDates))
    .map(d => new Date(d).getTime())
    .sort((a, b) => b - a); // newest to oldest
  
  if (uniqueDates.length === 0) return 0;
  
  const oneDayMs = 24 * 60 * 60 * 1000;
  const todayStart = new Date(new Date().toDateString()).getTime();
  
  // If the latest study date is older than 48 hours, streak is reset
  if (todayStart - uniqueDates[0] > 2 * oneDayMs) {
    return 0;
  }
  
  let streak = 1;
  for (let i = 0; i < uniqueDates.length - 1; i++) {
    const diff = uniqueDates[i] - uniqueDates[i+1];
    if (diff <= 1.5 * oneDayMs) { // within 36 hours or same day
      streak++;
    } else {
      break;
    }
  }
  return streak;
};

export default function App() {
  // App settings state with lazy initializer
  const [appSettings, setAppSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('tubekeep_settings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      openRouterApiKey: '',
      customGeminiApiKey: '',
      useOpenRouter: false,
      openRouterModel: 'google/gemini-2.5-flash',
      settingsPassword: '',
      isSettingsLocked: false,
      encryptLocalStorage: true
    };
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [videoFormUrl, setVideoFormUrl] = useState('');
  const [isTourOpen, setIsTourOpen] = useState(false);

  // Auto-launch Guided Tour for brand new visitors
  useEffect(() => {
    const onboardDone = localStorage.getItem('tubekeep_onboard_completed');
    if (onboardDone !== 'true') {
      const timer = setTimeout(() => {
        setIsTourOpen(true);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Videos state with lazy initializer
  const [videos, setVideos] = useState<VideoItem[]>(() => {
    const savedVideos = localStorage.getItem('tubekeep_videos');
    const decodedVideos = maybeDecode(savedVideos);
    return decodedVideos || presetVideos;
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);
  const [academicFocusMode, setAcademicFocusMode] = useState<boolean>(false);

  // Filter & Sort states
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [ratingFilter, setRatingFilter] = useState<number>(0);
  const [sortBy, setSortBy] = useState<'date' | 'rating' | 'title'>('date');

  // Keep Notes state with lazy initializer
  const [keepNotes, setKeepNotes] = useState<KeepNote[]>(() => {
    const savedNotes = localStorage.getItem('tubekeep_keep_notes');
    const decodedNotes = maybeDecode(savedNotes);
    return decodedNotes || [
      {
        id: 'welcome-keep',
        title: 'Welcome to CurateMind Sync Board! 💡',
        content: 'This is your research notepad board.\n\nHere you can pin, organize, and color-code notes compiled from analyzed research videos and articles.\n\nTo transfer these notes to your official Google Keep, click the Copy button at the bottom of the card and use the "Open Google Keep" link above!',
        color: '#EEF2FF', // Indigo shade to match our new brand
        pinned: true,
        updatedAt: new Date().toISOString()
      }
    ];
  });

  // Track synced task IDs in state/localstorage with lazy initializer
  const [syncedTaskIds, setSyncedTaskIds] = useState<string[]>(() => {
    const savedSyncedTasks = localStorage.getItem('tubekeep_synced_tasks');
    if (savedSyncedTasks) {
      try {
        return JSON.parse(savedSyncedTasks);
      } catch (e) {}
    }
    return [];
  });

  // Linked Multi-Google Accounts with lazy initializer
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>(() => {
    const savedLinkedAccounts = localStorage.getItem('tubekeep_linked_accounts');
    if (savedLinkedAccounts) {
      try {
        return JSON.parse(savedLinkedAccounts);
      } catch (e) {}
    }
    return [];
  });

  // Right panel tab and task sync triggers
  const [rightPanelTab, setRightPanelTab] = useState<'keep' | 'tasks' | 'study'>('keep');
  const [tasksTrigger, setTasksTrigger] = useState(0);

  // New Marginalia Study & Import States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [activeConcept, setActiveConcept] = useState<string | null>(null);
  const [bookshelfLayout, setBookshelfLayout] = useState<'grid' | 'kanban'>('grid');

  // Multi-select state
  const [isBulkSyncing, setIsBulkSyncing] = useState<boolean>(false);
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);

  // Elegant Toast and Confirmation Dialog states
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    message: string;
    onConfirm: () => void;
    title?: string;
  } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
  };

  const keepExtractedLinks = useMemo(() => {
    const urls: string[] = [];
    keepNotes.forEach(note => {
      const found = extractUrlsFromText(note.title + " " + note.content);
      found.forEach(u => {
        if (!urls.includes(u)) {
          urls.push(u);
        }
      });
    });
    return urls;
  }, [keepNotes]);

  const currentStreak = useMemo(() => calculateStreak(videos), [videos]);

  // Dynamic categories computed based on current videos list and default presets
  const dynamicCategories = useMemo(() => {
    const catsSet = new Set<string>();
    // Default categories that we want to always have as a fallback
    const DEFAULTS = [
      'AI & Cognitive Systems',
      'Engineering & Software Architecture',
      'Productivity & Creative Design',
      'Business Intelligence & Finance',
      'Advanced Sciences & Tech Research',
      'Strategy, Growth & Leadership'
    ];
    DEFAULTS.forEach(cat => catsSet.add(cat));
    
    // Add any dynamic categories found in current videos
    videos.forEach(v => {
      if (v.category && v.category.trim()) {
        catsSet.add(v.category.trim());
      }
    });

    return ['All', ...Array.from(catsSet).sort()];
  }, [videos]);

  const getCuratedItemForLink = (linkUrl: string) => {
    return videos.find(v => v.url === linkUrl || (v.videoId && linkUrl.includes(v.videoId)));
  };

  // Initialize Auth listeners on mount
  useEffect(() => {
    initAuth(
      (currentUser, accessToken) => {
        setUser(currentUser);
        setToken(accessToken);
      },
      () => {
        setUser(null);
        setToken(null);
      }
    );
  }, []);

  // Save state back to localstorage when modified
  useEffect(() => {
    localStorage.setItem('tubekeep_videos', maybeEncode(videos, appSettings.encryptLocalStorage || false));
  }, [videos, appSettings.encryptLocalStorage]);

  useEffect(() => {
    localStorage.setItem('tubekeep_keep_notes', maybeEncode(keepNotes, appSettings.encryptLocalStorage || false));
  }, [keepNotes, appSettings.encryptLocalStorage]);

  useEffect(() => {
    localStorage.setItem('tubekeep_synced_tasks', JSON.stringify(syncedTaskIds));
  }, [syncedTaskIds]);

  useEffect(() => {
    localStorage.setItem('tubekeep_linked_accounts', JSON.stringify(linkedAccounts));
  }, [linkedAccounts]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Auto-sync primary logged in user into the linkedAccounts list
  useEffect(() => {
    if (user && token) {
      setLinkedAccounts(prev => {
        const exists = prev.some(acc => acc.email === user.email);
        if (!exists && user.email) {
          const newAccount: LinkedAccount = {
            email: user.email,
            displayName: user.displayName || 'Google User',
            photoURL: user.photoURL || '',
            accessToken: token,
            linkedAt: new Date().toISOString()
          };
          const updated = [...prev, newAccount];
          localStorage.setItem('tubekeep_linked_accounts', JSON.stringify(updated));
          return updated;
        } else if (exists && user.email) {
          // Update the token in case it changed
          const updated = prev.map(acc => {
            if (acc.email === user.email) {
              return { ...acc, accessToken: token };
            }
            return acc;
          });
          localStorage.setItem('tubekeep_linked_accounts', JSON.stringify(updated));
          return updated;
        }
        return prev;
      });
    }
  }, [user, token]);

  // Handle Google Login
  const handleSignIn = async () => {
    setIsAuthLoading(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        
        // Ensure it is added as a linked account
        const newAccount: LinkedAccount = {
          email: result.user.email || 'unknown@gmail.com',
          displayName: result.user.displayName || 'Google User',
          photoURL: result.user.photoURL || '',
          accessToken: result.accessToken,
          linkedAt: new Date().toISOString()
        };
        
        setLinkedAccounts(prev => {
          const filtered = prev.filter(acc => acc.email !== newAccount.email);
          const updated = [...filtered, newAccount];
          localStorage.setItem('tubekeep_linked_accounts', JSON.stringify(updated));
          return updated;
        });
      }
    } catch (err) {
      console.error('Sign-in failed', err);
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Link another/additional Google account
  const handleLinkNewAccount = async () => {
    setIsAuthLoading(true);
    try {
      const result = await googleSignIn();
      if (result) {
        const newAccount: LinkedAccount = {
          email: result.user.email || 'unknown@gmail.com',
          displayName: result.user.displayName || 'Google User',
          photoURL: result.user.photoURL || '',
          accessToken: result.accessToken,
          linkedAt: new Date().toISOString()
        };
        
        setLinkedAccounts(prev => {
          const filtered = prev.filter(acc => acc.email !== newAccount.email);
          const updated = [...filtered, newAccount];
          localStorage.setItem('tubekeep_linked_accounts', JSON.stringify(updated));
          return updated;
        });

        // Set this as current primary active session
        setUser(result.user);
        setToken(result.accessToken);

        // Force tasks panel to reload
        setTasksTrigger(prev => prev + 1);
        alert(`Successfully connected Google Account: ${newAccount.email}!`);
      }
    } catch (err) {
      console.error("Failed to link new Google account:", err);
      alert("Failed to link Google account. Please try again.");
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Unlink a Google Account
  const handleUnlinkAccount = (email: string) => {
    if (window.confirm(`Are you sure you want to disconnect Google account "${email}"?`)) {
      setLinkedAccounts(prev => {
        const updated = prev.filter(acc => acc.email !== email);
        localStorage.setItem('tubekeep_linked_accounts', JSON.stringify(updated));
        return updated;
      });
      
      // If we unlinked the active user, switch active session to first remaining linked account
      if (user?.email === email) {
        const remaining = linkedAccounts.filter(acc => acc.email !== email);
        if (remaining.length > 0) {
          setToken(remaining[0].accessToken);
          // We don't have full firebase User object for that remaining account, but the token is what matters
        } else {
          setUser(null);
          setToken(null);
        }
      }
      setTasksTrigger(prev => prev + 1);
    }
  };

  // Handle Google Logout
  const handleSignOut = async () => {
    try {
      await logout();
      setUser(null);
      setToken(null);
    } catch (e) {
      console.error(e);
    }
  };

  // Analyze a video via Express + Gemini Backend
  const handleAnalyzeVideo = async (url: string) => {
    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          url,
          openRouterApiKey: appSettings.useOpenRouter ? appSettings.openRouterApiKey : undefined,
          customGeminiApiKey: appSettings.customGeminiApiKey || undefined,
          openRouterModel: appSettings.useOpenRouter ? appSettings.openRouterModel : undefined
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error || 'Failed to analyze the video. Please check your network and try again.');
      }

      const newVideo: VideoItem = await response.json();
      
      // Prevent duplicates, insert new video at the top
      setVideos((prev) => {
        const filtered = prev.filter(v => v.videoId !== newVideo.videoId);
        return [
          {
            ...newVideo,
            id: newVideo.videoId,
            createdAt: new Date().toISOString()
          },
          ...filtered
        ];
      });

    } catch (err) {
      console.error(err);
      throw err;
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Create a quick notes stub workspace for any external link from Google Keep
  const handleCreateQuickNote = (url: string) => {
    let domain = 'Web Resource';
    try {
      domain = new URL(url).hostname.replace('www.', '');
    } catch (_) {}

    // Find if already exists
    const existing = videos.find(v => v.url === url || (v.videoId && url.includes(v.videoId)));
    if (existing) {
      setSelectedVideo(existing);
      return;
    }

    const stubItem: VideoItem = {
      id: 'stub-' + Date.now(),
      videoId: '',
      url: url,
      title: `Study Session: ${domain}`,
      channelTitle: domain,
      thumbnail: '',
      summary: 'This study notes workspace was drafted directly from your Google Keep link. Use the Split Screen player on the left, launch a companion tab if framing is blocked, and type your notes in your Google Keep Panel on the right!',
      category: 'Science & Education',
      rating: 5,
      ratingJustification: 'Quick drafted link for immediate side-by-side study.',
      takeaways: ['Click play or visit link to load your learning resource', 'Capture your custom ideas live inside your active Draft Keep Board'],
      actualPurpose: 'Custom Note Workspace',
      debunkedClickbait: '',
      conceptualComplexity: 'Intermediate (advanced-undergraduate)',
      interdisciplinaryField: 'Self-Directed Learning',
      watchedStatus: 'Watching',
      createdAt: new Date().toISOString()
    };

    setVideos(prev => [stubItem, ...prev]);
    setSelectedVideo(stubItem);
  };

  // Pin / Unpin video summary
  const handlePinVideo = (id: string) => {
    setVideos(prev => prev.map(video => {
      if (video.id === id) {
        return { ...video, isPinned: !video.isPinned };
      }
      return video;
    }));
  };

  // Delete a video from workspace
  const handleDeleteVideo = (id: string) => {
    setVideos(prev => prev.filter(video => video.id !== id));
    // Also clear associated Keep Notes if any
    setKeepNotes(prev => prev.filter(note => note.videoId !== id));
  };

  // Add / Sync to Keep simulation
  const handleSaveToKeep = (video: VideoItem, color: string) => {
    // Check if Keep note already exists for this video
    const exists = keepNotes.some(note => note.videoId === video.id);
    if (exists) return;

    const formattedContent = `📺 Video Link: ${video.url}
👤 Creator: ${video.channelTitle}
⭐ Rating: ${video.rating}/5 stars

📝 DETAILED SUMMARY:
${video.summary}

🔑 KEY TAKEAWAYS:
${video.takeaways.map((t, i) => `• ${t}`).join('\n')}`;

    const newNote: KeepNote = {
      id: `keep-${video.id}-${Date.now()}`,
      title: `${video.title} (Summary)`,
      content: formattedContent,
      color: color,
      videoId: video.id,
      pinned: video.isPinned || false,
      updatedAt: new Date().toISOString()
    };

    setKeepNotes(prev => [newNote, ...prev]);
  };

  // Sync Video Summary to Google Tasks API across all connected accounts
  const handleSyncToGoogleTasks = async (video: VideoItem): Promise<boolean> => {
    let activeAccounts = [...linkedAccounts];
    
    // If not signed in or no linked accounts, prompt OAuth sign-in first
    if (activeAccounts.length === 0) {
      const confirmLogin = window.confirm("Authentication Required: To sync summaries directly into your real Google Tasks accounts, you need to connect your Google accounts first. Would you like to connect an account now?");
      if (!confirmLogin) return false;
      
      setIsAuthLoading(true);
      try {
        const result = await googleSignIn();
        if (result) {
          setUser(result.user);
          setToken(result.accessToken);
          
          const newAccount: LinkedAccount = {
            email: result.user.email || 'unknown@gmail.com',
            displayName: result.user.displayName || 'Google User',
            photoURL: result.user.photoURL || '',
            accessToken: result.accessToken,
            linkedAt: new Date().toISOString()
          };
          activeAccounts = [newAccount];
          setLinkedAccounts(activeAccounts);
          localStorage.setItem('tubekeep_linked_accounts', JSON.stringify(activeAccounts));
        } else {
          return false;
        }
      } catch (err) {
        alert("Google Sign-In failed. Please try again.");
        return false;
      } finally {
        setIsAuthLoading(false);
      }
    }

    if (activeAccounts.length === 0) return false;

    try {
      const taskNotes = `📌 Category: ${video.category}
📊 Conceptual Complexity: ${video.conceptualComplexity || 'Not Analyzed'}
🌀 Interdisciplinary Field: ${video.interdisciplinaryField || 'Not Analyzed'}
⭐ Curation Rating: ${video.rating}/5 stars
🔗 Watch: ${video.url}

📝 AI Summary:
${video.summary}

🔑 Bullet Takeaways:
${video.takeaways.map((t, i) => `${i + 1}. ${t}`).join('\n')}

---
Synced via CurateMind AI`;

      const results: { email: string; success: boolean; error?: string }[] = [];
      
      for (const account of activeAccounts) {
        try {
          await createGoogleTask(`CurateMind: ${video.title}`, taskNotes, account.accessToken);
          results.push({ email: account.email, success: true });
        } catch (err: any) {
          console.error(`Sync failed for ${account.email}:`, err);
          results.push({ email: account.email, success: false, error: err.message });
        }
      }

      const succeeded = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      if (failed.length === 0) {
        // Update local tracking of synced task IDs
        const updatedSyncList = [...syncedTaskIds, video.id];
        setSyncedTaskIds(updatedSyncList);
        localStorage.setItem('tubekeep_synced_tasks', JSON.stringify(updatedSyncList));
        
        // Refresh tasks panel list and switch active tab to tasks
        setTasksTrigger(prev => prev + 1);
        setRightPanelTab('tasks');

        showToast(`Successfully Synced to Google Tasks across all ${succeeded.length} connected accounts:\n${succeeded.map(r => `✅ ${r.email}`).join('\n')}\n\nCheck your Google Tasks app!`, 'success');
        return true;
      } else if (succeeded.length > 0) {
        // Partial success
        const updatedSyncList = [...syncedTaskIds, video.id];
        setSyncedTaskIds(updatedSyncList);
        localStorage.setItem('tubekeep_synced_tasks', JSON.stringify(updatedSyncList));
        
        setTasksTrigger(prev => prev + 1);
        setRightPanelTab('tasks');

        showToast(`Synced to Google Tasks (Partial success):\n${succeeded.map(r => `✅ Synced: ${r.email}`).join('\n')}\n${failed.map(r => `❌ Failed: ${r.email} - ${r.error}`).join('\n')}`, 'info');
        return true;
      } else {
        throw new Error(`Sync failed on all accounts. Errors:\n${failed.map(r => `${r.email}: ${r.error}`).join('\n')}`);
      }
    } catch (error: any) {
      console.error(error);
      showToast(`Syncing failed: ${error.message || "An unexpected error occurred."}`, 'error');
      return false;
    }
  };

  // Keep Notes Board Handlers
  const handleAddKeepNote = (noteData: Omit<KeepNote, 'id' | 'updatedAt'>) => {
    const newNote: KeepNote = {
      ...noteData,
      id: `note-manual-${Date.now()}`,
      updatedAt: new Date().toISOString()
    };
    setKeepNotes(prev => [newNote, ...prev]);
  };

  const handleUpdateNoteColor = (id: string, color: string) => {
    setKeepNotes(prev => prev.map(note => {
      if (note.id === id) {
        return { ...note, color, updatedAt: new Date().toISOString() };
      }
      return note;
    }));
  };

  const handleToggleNotePin = (id: string) => {
    setKeepNotes(prev => prev.map(note => {
      if (note.id === id) {
        return { ...note, pinned: !note.pinned, updatedAt: new Date().toISOString() };
      }
      return note;
    }));
  };

  const handleDeleteKeepNote = (id: string) => {
    setKeepNotes(prev => prev.filter(note => note.id !== id));
  };

  const handleUpdateVideo = (updatedVideo: VideoItem) => {
    setVideos(prev => {
      const updated = prev.map(v => v.id === updatedVideo.id ? updatedVideo : v);
      localStorage.setItem('tubekeep_videos', JSON.stringify(updated));
      return updated;
    });
    if (selectedVideo?.id === updatedVideo.id) {
      setSelectedVideo(updatedVideo);
    }
  };

  const handleToggleWatchedStatus = (id: string, status: 'To Watch' | 'Watching' | 'Done') => {
    setVideos(prev => {
      const updated = prev.map(v => v.id === id ? { ...v, watchedStatus: status } : v);
      localStorage.setItem('tubekeep_videos', JSON.stringify(updated));
      return updated;
    });
    if (selectedVideo?.id === id) {
      setSelectedVideo(prev => prev ? { ...prev, watchedStatus: status } : null);
    }
  };

  // Multi-select and bulk actions handlers
  const handleToggleSelectVideo = (id: string) => {
    setSelectedVideoIds(prev => 
      prev.includes(id) ? prev.filter(itemId => itemId !== id) : [...prev, id]
    );
  };

  const handleSelectAllVisible = () => {
    const visibleIds = processedVideos.map(v => v.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedVideoIds.includes(id));
    if (allSelected) {
      setSelectedVideoIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedVideoIds(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleBulkDelete = () => {
    if (selectedVideoIds.length === 0) return;
    const count = selectedVideoIds.length;
    setConfirmModal({
      title: "Bulk Delete Curations",
      message: `Are you sure you want to delete the ${count} selected curated videos? This cannot be undone.`,
      onConfirm: () => {
        setVideos(prev => {
          const updated = prev.filter(v => !selectedVideoIds.includes(v.id));
          localStorage.setItem('tubekeep_videos', JSON.stringify(updated));
          return updated;
        });
        setSelectedVideoIds([]);
        showToast(`Successfully deleted ${count} curated videos.`, 'success');
      }
    });
  };

  const performBulkSync = async (activeAccounts: LinkedAccount[]) => {
    setIsBulkSyncing(true);
    try {
      const videosToSync = videos.filter(v => selectedVideoIds.includes(v.id));
      const successfulVideoIds: string[] = [];
      const syncErrors: string[] = [];

      for (const video of videosToSync) {
        const taskNotes = `📌 Category: ${video.category}\n📊 Conceptual Complexity: ${video.conceptualComplexity || 'Not Analyzed'}\n🌀 Interdisciplinary Field: ${video.interdisciplinaryField || 'Not Analyzed'}\nChannel: ${video.channelTitle}\nURL: ${video.url}\n⭐ Rating: ${video.rating}/5 stars\n"${video.ratingJustification}"\n\n📝 SUMMARY:\n${video.summary}\n\n🔑 STUDY WORKSPACE CHECKLIST:\n${video.takeaways.map((t, idx) => `[ ] ${t}`).join('\n')}\n\n---\nSynced via CurateMind AI`;

        let anySuccess = false;
        for (const account of activeAccounts) {
          try {
            await createGoogleTask(`CurateMind: ${video.title}`, taskNotes, account.accessToken);
            anySuccess = true;
          } catch (err: any) {
            console.error(`Bulk sync failed for video "${video.title}" on ${account.email}:`, err);
            syncErrors.push(`- "${video.title}" on ${account.email}: ${err.message || 'Error'}`);
          }
        }
        
        if (anySuccess) {
          successfulVideoIds.push(video.id);
        }
      }

      if (successfulVideoIds.length > 0) {
        const updatedSyncList = Array.from(new Set([...syncedTaskIds, ...successfulVideoIds]));
        setSyncedTaskIds(updatedSyncList);
        localStorage.setItem('tubekeep_synced_tasks', JSON.stringify(updatedSyncList));
        
        setTasksTrigger(prev => prev + 1);
        setRightPanelTab('tasks');
      }

      if (syncErrors.length === 0) {
        showToast(`Successfully synced ${successfulVideoIds.length} video checklists across all ${activeAccounts.length} connected Google Tasks accounts!`, 'success');
        setSelectedVideoIds([]);
      } else if (successfulVideoIds.length > 0) {
        showToast(`Bulk sync completed with partial success. Synced ${successfulVideoIds.length} videos. Errors encountered:\n${syncErrors.join('\n')}`, 'info');
        setSelectedVideoIds([]);
      } else {
        showToast(`Failed to sync any of the selected videos. Errors encountered:\n${syncErrors.join('\n')}`, 'error');
      }
    } catch (err: any) {
      console.error(err);
      showToast(`Bulk sync failed: ${err.message || 'An unexpected error occurred.'}`, 'error');
    } finally {
      setIsBulkSyncing(false);
    }
  };

  const handleBulkSyncToGoogleTasks = async () => {
    if (selectedVideoIds.length === 0) return;
    
    const activeAccounts = [...linkedAccounts];
    if (activeAccounts.length === 0) {
      setConfirmModal({
        title: "Authentication Required",
        message: "To sync selected summaries directly to your Google Tasks, you need to connect your Google accounts first. Would you like to connect an account now?",
        onConfirm: async () => {
          setIsAuthLoading(true);
          try {
            const result = await googleSignIn();
            if (result) {
              setUser(result.user);
              setToken(result.accessToken);
              
              const newAccount: LinkedAccount = {
                email: result.user.email || 'unknown@gmail.com',
                displayName: result.user.displayName || 'Google User',
                photoURL: result.user.photoURL || '',
                accessToken: result.accessToken,
                linkedAt: new Date().toISOString()
              };
              const updatedAccounts = [newAccount];
              setLinkedAccounts(updatedAccounts);
              localStorage.setItem('tubekeep_linked_accounts', JSON.stringify(updatedAccounts));
              
              // Proceed with bulk sync using newly connected account
              performBulkSync(updatedAccounts);
            }
          } catch (err: any) {
            console.error("Sign-in failed during bulk sync", err);
            showToast("Sign-in failed. Cannot perform bulk sync.", "error");
          } finally {
            setIsAuthLoading(false);
          }
        }
      });
      return;
    }

    performBulkSync(activeAccounts);
  };

  // Restore preset demo videos
  const handleRestoreDemoLibrary = () => {
    setVideos(presetVideos);
    localStorage.setItem('tubekeep_videos', maybeEncode(presetVideos, appSettings.encryptLocalStorage || false));
    showToast("Loaded high-quality educational demo videos! Click around to edit notes and sync checklists.", "success");
  };

  // Delete all videos from bookshelf (empty state test)
  const handleClearAllVideos = () => {
    setConfirmModal({
      title: "Clear All Curations",
      message: "Are you sure you want to delete all curated videos from your library? This clears your local workspace and cannot be undone.",
      onConfirm: () => {
        setVideos([]);
        localStorage.removeItem('tubekeep_videos');
        showToast("Bookshelf cleared! Welcome to your fresh slate.", "success");
      }
    });
  };

  // Filtered and Sorted list calculation
  const processedVideos = videos
    .filter(v => {
      const matchesCategory = activeCategory === 'All' || v.category === activeCategory;
      const matchesSearch = v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            v.channelTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            v.summary.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRating = ratingFilter === 0 || v.rating === ratingFilter;
      return matchesCategory && matchesSearch && matchesRating;
    })
    .sort((a, b) => {
      // Pinned items always go first
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;

      // Secondary sort options
      if (sortBy === 'rating') {
        return b.rating - a.rating;
      }
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  if (academicFocusMode) {
    const focusVideo = selectedVideo || videos[0];
    if (focusVideo) {
      return (
        <AcademicFocusMode
          video={focusVideo}
          videos={videos}
          onSelectVideo={(v) => setSelectedVideo(v)}
          onUpdateVideo={handleUpdateVideo}
          onExit={() => setAcademicFocusMode(false)}
          onSaveToKeep={handleSaveToKeep}
          onSyncTasks={handleSyncToGoogleTasks}
          isSyncedToTasks={syncedTaskIds.includes(focusVideo.id)}
          isInKeep={keepNotes.some(note => note.id === `keep-${focusVideo.id}` || note.videoId === focusVideo.id)}
        />
      );
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col antialiased selection:bg-indigo-100 selection:text-indigo-950">
      
      {/* Header Bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200/60 shadow-xs backdrop-blur-md bg-white/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            {/* Real-life Marginalia Folded Page Logo */}
            <div 
              className="relative w-8 h-[36px] bg-brand-ink rounded-l-[6px] rounded-br-[6px] shrink-0 shadow-xs group cursor-pointer transition-transform duration-300 hover:scale-[1.03]"
              style={{
                clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%)'
              }}
              id="brand-logo"
            >
              {/* Red folded corner flap */}
              <div 
                className="absolute top-0 right-0 w-[10px] h-[10px] bg-brand-red origin-top-left transition-all duration-300 ease-out group-hover:scale-130 group-hover:-rotate-[10deg] group-hover:brightness-110 animate-flap-flare"
                style={{
                  clipPath: 'polygon(0 0, 100% 100%, 0 100%)'
                }}
              />
            </div>
            
            <div className="flex flex-col justify-center">
              <h1 className="text-xl md:text-2xl font-semibold font-serif tracking-tight text-brand-ink leading-tight select-none flex items-center gap-1.5">
                Marginalia
              </h1>
              <span className="text-[9px] font-black tracking-[0.25em] text-brand-red uppercase leading-none block mt-0.5 select-none">
                Curation, Verified
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Dynamic Leitner Streak Indicator */}
            {currentStreak > 0 ? (
              <button 
                onClick={() => setRightPanelTab('study')}
                className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200/50 rounded-xl text-xs font-bold shadow-2xs cursor-pointer transition-colors"
                title={`You have a ${currentStreak}-day educational study streak active! Keep reviewing flashcards to maintain your streak.`}
              >
                <Flame className="w-4.5 h-4.5 text-[#C4342B] fill-[#C4342B] animate-pulse" />
                <span className="text-[#C4342B] font-black">{currentStreak} Day Streak</span>
              </button>
            ) : (
              <div 
                className="hidden md:flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200/50 rounded-xl text-xs font-bold text-slate-400"
                title="Start watching or reviewing videos to build your active learning streak!"
              >
                <Flame className="w-4 h-4 text-slate-300" />
                <span>0 Day Streak</span>
              </div>
            )}

            {/* Guided Tour Button */}
            <button
              onClick={() => setIsTourOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 hover:text-amber-800 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs border border-amber-200/40"
              title="Launch interactive onboarding dashboard walkthrough"
            >
              <Sparkles className="w-4.5 h-4.5 text-amber-500 fill-amber-500/10" />
              <span className="hidden sm:inline text-amber-800 font-extrabold text-xs">Guided Tour</span>
            </button>

            {/* Academic Focus Button */}
            <button
              onClick={() => {
                if (!selectedVideo && videos.length > 0) {
                  setSelectedVideo(videos[0]);
                }
                setAcademicFocusMode(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-800 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs border border-indigo-200/40"
              title="Enter distraction-free Academic Focus Mode"
            >
              <BookOpen className="w-4.5 h-4.5 text-indigo-500" />
              <span className="hidden sm:inline text-indigo-800 font-extrabold text-xs">Academic Focus</span>
            </button>

            {/* Settings Button */}
            <button
              id="onboarding-settings-btn"
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs border border-slate-200/40"
              title="Open Workspace Settings"
            >
              <Settings className="w-4.5 h-4.5 text-amber-500 animate-spin-slow" />
              <span className="hidden sm:inline text-slate-700 font-extrabold text-xs">Settings</span>
            </button>

            <SignInButton 
              user={user} 
              isLoading={isAuthLoading} 
              onSignIn={handleSignIn} 
              onSignOut={handleSignOut} 
            />
          </div>
        </div>
      </header>

      {/* Primary Workspace Layout */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left 8 Columns: Video Curation Dashboard */}
        <div className="lg:col-span-8 flex flex-col space-y-6">
          


          {/* Form component to add new links */}
          <div id="onboarding-import-form">
            <VideoForm 
              onAnalyze={handleAnalyzeVideo} 
              isAnalyzing={isAnalyzing} 
              value={videoFormUrl}
              onChange={setVideoFormUrl}
            />
          </div>

          {/* D3 Force Directed Network Graph for Discovering Connections */}
          {videos.length > 0 && (
            <TopicDiscoveryGraph 
              videos={videos}
              onSelectVideo={setSelectedVideo}
              onSelectConcept={setActiveConcept}
              activeConcept={activeConcept}
            />
          )}

          {/* Filters & Control Station */}
          <div id="onboarding-bookshelf" className="space-y-6 lg:space-y-8 xl:space-y-10">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              
              {/* Row 1: Search & Sorts */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Search curations by title, creator, or topic keyword..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-amber-400 focus:bg-white rounded-xl text-xs outline-hidden text-slate-700 placeholder-slate-400"
                  />
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {/* Bookshelf Layout Switcher */}
                  <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
                    <button
                      type="button"
                      onClick={() => setBookshelfLayout('grid')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        bookshelfLayout === 'grid'
                          ? 'bg-white text-slate-800 shadow-2xs border border-slate-200/20'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                      title="Grid Layout View"
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setBookshelfLayout('kanban')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        bookshelfLayout === 'kanban'
                          ? 'bg-white text-slate-800 shadow-2xs border border-slate-200/20 font-black'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                      title="Study Progress Kanban Board"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Rating Filter Selector */}
                  <div className="flex items-center gap-1.5 border border-slate-200 rounded-xl px-3 py-2 bg-slate-50">
                    <span className="text-[10px] font-bold text-slate-500">Stars:</span>
                    <select
                      value={ratingFilter}
                      onChange={(e) => setRatingFilter(Number(e.target.value))}
                      className="text-xs font-semibold text-slate-700 bg-transparent border-none outline-hidden cursor-pointer"
                    >
                      <option value={0}>All Ratings</option>
                      <option value={5}>⭐⭐⭐⭐⭐ (5)</option>
                      <option value={4}>⭐⭐⭐⭐ (4)</option>
                      <option value={3}>⭐⭐⭐ (3)</option>
                      <option value={2}>⭐⭐ (2)</option>
                      <option value={1}>⭐ (1)</option>
                    </select>
                  </div>

                  {/* Sort selector */}
                  <div className="flex items-center gap-1.5 border border-slate-200 rounded-xl px-3 py-2 bg-slate-50">
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as 'date' | 'rating' | 'title')}
                      className="text-xs font-semibold text-slate-700 bg-transparent border-none outline-hidden cursor-pointer"
                    >
                      <option value="date">Newest Added</option>
                      <option value="rating">Rating (High to Low)</option>
                      <option value="title">Alphabetical Title</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Row 2: Category Filters Tabs */}
              <div className="border-t border-slate-100 pt-3">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin">
                  {dynamicCategories.map((cat) => {
                    const isActive = activeCategory === cat;
                    return (
                      <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap transition-all border cursor-pointer ${
                          isActive 
                            ? 'bg-amber-400 border-amber-400 text-white shadow-xs' 
                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Row 3: Study & Completion Progress Bar */}
              {videos.length > 0 && (
                <div className="border-t border-slate-100 pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
                    <span className="font-extrabold text-slate-500 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                      <ListTodo className="w-3.5 h-3.5 text-amber-500" />
                      Study Progress Dashboard
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-600 flex items-center gap-1 font-medium text-[11px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                        To Watch: <strong>{videos.filter(v => !v.watchedStatus || v.watchedStatus === 'To Watch').length}</strong>
                      </span>
                      <span className="text-indigo-600 flex items-center gap-1 font-medium text-[11px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                        Watching: <strong>{videos.filter(v => v.watchedStatus === 'Watching').length}</strong>
                      </span>
                      <span className="text-emerald-600 flex items-center gap-1 font-medium text-[11px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Done: <strong>{videos.filter(v => v.watchedStatus === 'Done').length}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-1 sm:max-w-[280px]">
                    <div className="relative w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                      {/* Watching progress */}
                      <div 
                        className="absolute left-0 top-0 h-full bg-indigo-400 transition-all duration-500"
                        style={{ 
                          width: `${videos.length > 0 ? Math.round(((videos.filter(v => v.watchedStatus === 'Watching').length + videos.filter(v => v.watchedStatus === 'Done').length) / videos.length) * 100) : 0}%` 
                        }}
                      />
                      {/* Done progress */}
                      <div 
                        className="absolute left-0 top-0 h-full bg-emerald-500 transition-all duration-500"
                        style={{ 
                          width: `${videos.length > 0 ? Math.round((videos.filter(v => v.watchedStatus === 'Done').length / videos.length) * 100) : 0}%` 
                        }}
                      />
                    </div>
                    <span className="text-xs font-black text-slate-700 shrink-0 min-w-[36px] text-right">
                      {videos.length > 0 ? Math.round((videos.filter(v => v.watchedStatus === 'Done').length / videos.length) * 100) : 0}%
                    </span>
                  </div>
                </div>
              )}

            </div>

            {/* Curated List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Compass className="w-4 h-4 text-amber-500" />
                    Curation Bookshelf ({processedVideos.length})
                  </h2>
                  {processedVideos.length > 0 && (
                    <button
                      onClick={handleSelectAllVisible}
                      className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                      title="Toggle selection of all visible curation cards"
                    >
                      {processedVideos.every(v => selectedVideoIds.includes(v.id)) ? (
                        <>
                          <CheckSquare className="w-3.5 h-3.5 text-amber-500 fill-amber-50/50" />
                          <span>Deselect All</span>
                        </>
                      ) : (
                        <>
                          <Square className="w-3.5 h-3.5 text-slate-400" />
                          <span>Select All</span>
                        </>
                      )}
                    </button>
                  )}
                  {videos.length > 0 && (
                    <button
                      onClick={handleClearAllVideos}
                      className="flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50/50 bg-slate-100 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                      title="Clear all videos from your local library"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear Shelf</span>
                    </button>
                  )}
                </div>
                {searchQuery || ratingFilter > 0 || activeCategory !== 'All' ? (
                  <button
                    onClick={() => {
                      setActiveCategory('All');
                      setSearchQuery('');
                      setRatingFilter(0);
                    }}
                    className="text-xs text-amber-600 font-semibold hover:underline cursor-pointer"
                  >
                    Clear all filters
                  </button>
                ) : null}
              </div>

              {videos.length > 0 ? (
                processedVideos.length > 0 ? (
                  bookshelfLayout === 'kanban' ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6 xl:gap-8">
                      {/* Column 1: To Watch */}
                      <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 flex flex-col space-y-3 min-h-[480px]">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">⏳ To Watch</span>
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-200/50 px-2.5 py-0.5 rounded-full">
                            {processedVideos.filter(v => (v.watchedStatus || 'To Watch') === 'To Watch').length}
                          </span>
                        </div>
                        <div className="space-y-4 flex-1 overflow-y-auto max-h-[550px] scrollbar-thin pr-0.5">
                          {processedVideos.filter(v => (v.watchedStatus || 'To Watch') === 'To Watch').map((video) => (
                            <VideoCard
                              key={video.id}
                              video={video}
                              onPin={handlePinVideo}
                              onDelete={handleDeleteVideo}
                              onSaveToKeep={handleSaveToKeep}
                              onSyncTasks={handleSyncToGoogleTasks}
                              isSyncedToTasks={syncedTaskIds.includes(video.id)}
                              isInKeep={keepNotes.some(note => note.videoId === video.id)}
                              onSelect={setSelectedVideo}
                              isSelected={selectedVideoIds.includes(video.id)}
                              onToggleSelect={handleToggleSelectVideo}
                              isSelectionMode={selectedVideoIds.length > 0}
                              onChangeWatchedStatus={handleToggleWatchedStatus}
                            />
                          ))}
                          {processedVideos.filter(v => (v.watchedStatus || 'To Watch') === 'To Watch').length === 0 && (
                            <div className="flex flex-col items-center justify-center py-16 border border-dashed border-slate-200 rounded-2xl text-slate-400 text-center">
                              <p className="text-[10px] font-bold">No videos queued</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Column 2: Watching */}
                      <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 flex flex-col space-y-3 min-h-[480px]">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700">📺 Watching</span>
                          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100/50 px-2.5 py-0.5 rounded-full">
                            {processedVideos.filter(v => v.watchedStatus === 'Watching').length}
                          </span>
                        </div>
                        <div className="space-y-4 flex-1 overflow-y-auto max-h-[550px] scrollbar-thin pr-0.5">
                          {processedVideos.filter(v => v.watchedStatus === 'Watching').map((video) => (
                            <VideoCard
                              key={video.id}
                              video={video}
                              onPin={handlePinVideo}
                              onDelete={handleDeleteVideo}
                              onSaveToKeep={handleSaveToKeep}
                              onSyncTasks={handleSyncToGoogleTasks}
                              isSyncedToTasks={syncedTaskIds.includes(video.id)}
                              isInKeep={keepNotes.some(note => note.videoId === video.id)}
                              onSelect={setSelectedVideo}
                              isSelected={selectedVideoIds.includes(video.id)}
                              onToggleSelect={handleToggleSelectVideo}
                              isSelectionMode={selectedVideoIds.length > 0}
                              onChangeWatchedStatus={handleToggleWatchedStatus}
                            />
                          ))}
                          {processedVideos.filter(v => v.watchedStatus === 'Watching').length === 0 && (
                            <div className="flex flex-col items-center justify-center py-16 border border-dashed border-slate-200 rounded-2xl text-slate-400 text-center">
                              <p className="text-[10px] font-bold">No active study sessions</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Column 3: Done */}
                      <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 flex flex-col space-y-3 min-h-[480px]">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">✅ Done</span>
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100/50 px-2.5 py-0.5 rounded-full">
                            {processedVideos.filter(v => v.watchedStatus === 'Done').length}
                          </span>
                        </div>
                        <div className="space-y-4 flex-1 overflow-y-auto max-h-[550px] scrollbar-thin pr-0.5">
                          {processedVideos.filter(v => v.watchedStatus === 'Done').map((video) => (
                            <VideoCard
                              key={video.id}
                              video={video}
                              onPin={handlePinVideo}
                              onDelete={handleDeleteVideo}
                              onSaveToKeep={handleSaveToKeep}
                              onSyncTasks={handleSyncToGoogleTasks}
                              isSyncedToTasks={syncedTaskIds.includes(video.id)}
                              isInKeep={keepNotes.some(note => note.videoId === video.id)}
                              onSelect={setSelectedVideo}
                              isSelected={selectedVideoIds.includes(video.id)}
                              onToggleSelect={handleToggleSelectVideo}
                              isSelectionMode={selectedVideoIds.length > 0}
                              onChangeWatchedStatus={handleToggleWatchedStatus}
                            />
                          ))}
                          {processedVideos.filter(v => v.watchedStatus === 'Done').length === 0 && (
                            <div className="flex flex-col items-center justify-center py-16 border border-dashed border-slate-200 rounded-2xl text-slate-400 text-center">
                              <p className="text-[10px] font-bold">No completed studies yet</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 lg:gap-8 xl:gap-10">
                      {processedVideos.map((video) => (
                        <VideoCard
                          key={video.id}
                          video={video}
                          onPin={handlePinVideo}
                          onDelete={handleDeleteVideo}
                          onSaveToKeep={handleSaveToKeep}
                          onSyncTasks={handleSyncToGoogleTasks}
                          isSyncedToTasks={syncedTaskIds.includes(video.id)}
                          isInKeep={keepNotes.some(note => note.videoId === video.id)}
                          onSelect={setSelectedVideo}
                          isSelected={selectedVideoIds.includes(video.id)}
                          onToggleSelect={handleToggleSelectVideo}
                          isSelectionMode={selectedVideoIds.length > 0}
                          onChangeWatchedStatus={handleToggleWatchedStatus}
                        />
                      ))}
                    </div>
                  )
                ) : (
                  <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center flex flex-col items-center justify-center text-slate-400">
                    <LayoutGrid className="w-12 h-12 text-slate-200 mb-3" />
                    <p className="text-sm font-semibold">No curated videos found</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm">
                      Try adjusting your search criteria, choosing a different category filter, or pasting a new YouTube URL in the form above to analyze it.
                    </p>
                  </div>
                )
              ) : (
                /* MAGNIFICENT GETTING STARTED ONBOARDING EMPTY STATE */
                <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-8 relative overflow-hidden shadow-xs flex flex-col space-y-6">
                  
                  {/* Decorative elements */}
                  <div className="absolute top-0 right-0 w-36 h-36 bg-amber-100/30 rounded-full blur-2xl -mr-12 -mt-12 pointer-events-none" />
                  <div className="absolute bottom-0 left-0 w-36 h-36 bg-indigo-100/30 rounded-full blur-2xl -ml-12 -mb-12 pointer-events-none" />

                  <div className="flex flex-col md:flex-row items-start gap-6 relative z-10">
                    <div className="w-14 h-14 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 shrink-0 shadow-2xs">
                      <BookOpen className="w-7 h-7" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-black font-display tracking-tight text-slate-900">
                        Begin Your Research & Curation Journey! 🚀
                      </h3>
                      <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
                        Welcome to <strong>CurateMind AI Workspace</strong>. This scholarly workspace is designed for intensive educational curation and deep content research. Say goodbye to mindless scrolling—input raw informational videos, audio files, or web resources to automatically strip clickbait, assign precise academic categories, analyze high-fidelity takeaways, and synchronize study logs directly to your cloud workspace.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 xl:gap-10 relative z-10">
                    {/* How it works */}
                    <div className="bg-slate-50/50 border border-slate-150 rounded-2xl p-5 space-y-4">
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-1.5 h-3 bg-indigo-600 rounded-full inline-block"></span>
                        How It Works in 3 Steps
                      </h4>
                      
                      <ul className="space-y-3.5">
                        <li className="flex gap-3 items-start">
                          <span className="w-5 h-5 bg-indigo-100 text-indigo-700 text-xs font-extrabold rounded-full flex items-center justify-center shrink-0 mt-0.5">1</span>
                          <div>
                            <p className="text-xs font-extrabold text-slate-700">Paste resource watch URL</p>
                            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">Grab any standard YouTube video watch link, audio URL, or educational resource and paste it into the Curation Form above.</p>
                          </div>
                        </li>
                        <li className="flex gap-3 items-start">
                          <span className="w-5 h-5 bg-indigo-100 text-indigo-700 text-xs font-extrabold rounded-full flex items-center justify-center shrink-0 mt-0.5">2</span>
                          <div>
                            <p className="text-xs font-extrabold text-slate-700">Run Gemini Research Engine</p>
                            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">Our advanced models grade clickbait titles, write comprehensive chapter outlines, assign granular educational tags, and map structural connections.</p>
                          </div>
                        </li>
                        <li className="flex gap-3 items-start">
                          <span className="w-5 h-5 bg-indigo-100 text-indigo-700 text-xs font-extrabold rounded-full flex items-center justify-center shrink-0 mt-0.5">3</span>
                          <div>
                            <p className="text-xs font-extrabold text-slate-700">Synthesize & Map Concepts</p>
                            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">Explore key sections via interactive D3 topology graphs, draft precise notes on the study pad, and sync checklist task logs to your cloud workspace.</p>
                          </div>
                        </li>
                      </ul>
                    </div>

                    {/* Hot Start Pathways */}
                    <div className="bg-slate-50/50 border border-slate-150 rounded-2xl p-5 flex flex-col justify-between space-y-4">
                      <div className="space-y-3">
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <span className="w-1.5 h-3 bg-indigo-500 rounded-full inline-block"></span>
                          Quick Onboarding Pathways
                        </h4>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          No video link handy? Try pasting one of our curated educational test URLs, or populate the whole bookshelf with sample templates to play instantly!
                        </p>

                        {/* Sample paste quick links */}
                        <div className="space-y-2 pt-1">
                          <button
                            onClick={() => {
                              setVideoFormUrl("https://www.youtube.com/watch?v=BickMFHAZR0");
                              document.getElementById("onboarding-import-form")?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }}
                            className="w-full flex items-center justify-between text-left text-xs bg-white hover:bg-amber-50/30 border border-slate-200 hover:border-amber-200 rounded-xl px-3 py-2 text-slate-600 hover:text-amber-800 transition-all font-semibold cursor-pointer"
                          >
                            <span className="truncate">🧪 Veritasium: Physics of Trees</span>
                            <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md font-bold shrink-0">Paste Link</span>
                          </button>
                          <button
                            onClick={() => {
                              setVideoFormUrl("https://www.youtube.com/watch?v=spUNpyF58BY");
                              document.getElementById("onboarding-import-form")?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }}
                            className="w-full flex items-center justify-between text-left text-xs bg-white hover:bg-amber-50/30 border border-slate-200 hover:border-amber-200 rounded-xl px-3 py-2 text-slate-600 hover:text-amber-800 transition-all font-semibold cursor-pointer"
                          >
                            <span className="truncate">📐 3Blue1Brown: Fourier Series</span>
                            <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md font-bold shrink-0">Paste Link</span>
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <button
                          onClick={handleRestoreDemoLibrary}
                          className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-slate-150 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-black rounded-xl transition-all cursor-pointer shadow-3xs"
                          title="Load our pre-analyzed default educational demo curations"
                        >
                          <Compass className="w-3.5 h-3.5" />
                          <span>Load Demo Shelf</span>
                        </button>
                        <button
                          onClick={() => setIsTourOpen(true)}
                          className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-amber-500 hover:bg-amber-600 text-white text-xs font-black rounded-xl transition-all cursor-pointer shadow-xs shadow-amber-500/10"
                          title="Launch step-by-step interactive screen highlight tour"
                        >
                          <Sparkles className="w-3.5 h-3.5 fill-white/20" />
                          <span>Start Guide Tour</span>
                        </button>
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </div>
          </div>

        </div>

        {/* Right 4 Columns: Keep Panel Clipboard & Tasks */}
        <div id="onboarding-keep-panel" className="lg:col-span-4 flex flex-col h-full space-y-4">
          {/* Workspace Side Panel Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shrink-0">
            <button
              onClick={() => setRightPanelTab('keep')}
              className={`flex-1 flex items-center justify-center gap-1.5 text-[10px] font-bold py-2 rounded-xl transition-all cursor-pointer ${
                rightPanelTab === 'keep' 
                  ? 'bg-white text-slate-800 shadow-xs border border-slate-200/30 font-black' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Keep Board</span>
            </button>
            <button
              id="onboarding-tasks-tab"
              onClick={() => setRightPanelTab('tasks')}
              className={`flex-1 flex items-center justify-center gap-1.5 text-[10px] font-bold py-2 rounded-xl transition-all cursor-pointer ${
                rightPanelTab === 'tasks' 
                  ? 'bg-white text-slate-800 shadow-xs border border-slate-200/30 font-black' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <ListTodo className="w-3.5 h-3.5 text-indigo-500" />
              <span>Google Tasks</span>
            </button>
            <button
              onClick={() => setRightPanelTab('study')}
              className={`flex-1 flex items-center justify-center gap-1.5 text-[10px] font-bold py-2 rounded-xl transition-all cursor-pointer relative ${
                rightPanelTab === 'study' 
                  ? 'bg-white text-slate-800 shadow-xs border border-slate-200/30 font-black' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-[#C4342B]" />
              <span>Leitner Deck</span>
              {videos.some(v => (v.watchedStatus === 'Watching' || v.watchedStatus === 'Done') && !v.lastReviewedDate) && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#C4342B] animate-pulse"></span>
              )}
            </button>
          </div>

          <div className="flex-1">
            {rightPanelTab === 'keep' ? (
              <KeepPanel 
                notes={keepNotes}
                onAddNote={handleAddKeepNote}
                onUpdateNoteColor={handleUpdateNoteColor}
                onTogglePin={handleToggleNotePin}
                onDeleteNote={handleDeleteKeepNote}
                extractedLinks={keepExtractedLinks}
                getCuratedItemForLink={getCuratedItemForLink}
                onSelectVideo={setSelectedVideo}
                onQuickNote={handleCreateQuickNote}
                onAiCurate={handleAnalyzeVideo}
                isAnalyzing={isAnalyzing}
                onOpenImportModal={() => setIsImportModalOpen(true)}
              />
            ) : rightPanelTab === 'tasks' ? (
              <TasksPanel 
                user={user}
                onSignIn={handleSignIn}
                syncedTrigger={tasksTrigger}
                linkedAccounts={linkedAccounts}
                onLinkAccount={handleLinkNewAccount}
                onUnlinkAccount={handleUnlinkAccount}
              />
            ) : (
              <LeitnerStudyPanel 
                videos={videos}
                onUpdateVideo={handleUpdateVideo}
                showToast={showToast}
              />
            )}
          </div>
        </div>

      </main>

      {/* Expanded Video Curation Modal */}
      {selectedVideo && (
        <VideoDetailModal
          video={selectedVideo}
          isOpen={!!selectedVideo}
          onClose={() => setSelectedVideo(null)}
          onSaveToKeep={handleSaveToKeep}
          onSyncTasks={handleSyncToGoogleTasks}
          isSyncedToTasks={syncedTaskIds.includes(selectedVideo.id)}
          isInKeep={keepNotes.some(note => note.id === `keep-${selectedVideo.id}` || note.videoId === selectedVideo.id)}
          onUpdateVideo={handleUpdateVideo}
        />
      )}

      {/* Keep Bulk Takeout Importer Modal */}
      {isImportModalOpen && (
        <KeepImportModal 
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          existingVideos={videos}
          onImportComplete={(newVideos) => {
            const updated = [...newVideos, ...videos];
            setVideos(updated);
            localStorage.setItem('tubekeep_videos', maybeEncode(updated, appSettings.encryptLocalStorage));
            showToast(`Successfully imported ${newVideos.length} educational curations into your Bookshelf!`, 'success');
          }}
          appSettings={appSettings}
          showToast={showToast}
        />
      )}

      {/* Floating Bulk Actions Toolbar */}
      <AnimatePresence>
        {selectedVideoIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4"
          >
            <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 backdrop-blur-md bg-slate-900/95">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-amber-400 rounded-xl flex items-center justify-center text-slate-950 font-black text-xs shadow-xs">
                  {selectedVideoIds.length}
                </div>
                <div>
                  <p className="text-xs font-extrabold font-display text-white leading-tight">
                    {selectedVideoIds.length} Video{selectedVideoIds.length > 1 ? 's' : ''} Selected
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Sync or delete all selected curations simultaneously</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
                {/* Deselect button */}
                <button
                  onClick={() => setSelectedVideoIds([])}
                  className="flex items-center gap-1 text-slate-400 hover:text-white hover:bg-slate-800/80 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cancel</span>
                </button>

                {/* Bulk Delete button */}
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center gap-1.5 bg-rose-500 hover:bg-rose-600 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border border-rose-600 shadow-xs"
                  title="Delete all selected curated videos"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>

                {/* Bulk Sync button */}
                <button
                  onClick={handleBulkSyncToGoogleTasks}
                  disabled={isBulkSyncing}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-xs border border-indigo-700"
                  title="Sync all selected videos to Google Tasks across linked accounts"
                >
                  {isBulkSyncing ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Syncing...</span>
                    </>
                  ) : (
                    <>
                      <ListTodo className="w-3.5 h-3.5" />
                      <span>Sync to Google Tasks</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-8 mt-12 text-center shrink-0">
        <p className="text-xs text-slate-400">
          CurateMind AI Academic Workspace © 2026. Built with Google Gemini 3.5 & advanced scholastic research integration.
        </p>
      </footer>

      {/* Settings & Scale Simulation Panel Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={appSettings}
        onSaveSettings={(newSettings) => {
          setAppSettings(newSettings);
          localStorage.setItem('tubekeep_settings', JSON.stringify(newSettings));
        }}
      />

      {/* Onboarding Interactive Guided Tour */}
      <GuidedTour
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
        onHighlightElement={(id) => {
          if (id === 'onboarding-keep-panel') {
            setRightPanelTab('keep');
          } else if (id === 'onboarding-tasks-tab') {
            setRightPanelTab('tasks');
          }
        }}
      />

      {/* Elegant Toast Notifications */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-white border rounded-2xl p-4 shadow-xl flex items-start gap-3"
            style={{
              borderColor: toast.type === 'success' ? '#10B981' : toast.type === 'error' ? '#EF4444' : '#F59E0B'
            }}
          >
            <div className="flex-1">
              <span className={`text-[10px] font-black uppercase tracking-wider block mb-0.5 ${
                toast.type === 'success' ? 'text-emerald-600' : toast.type === 'error' ? 'text-rose-600' : 'text-amber-600'
              }`}>
                {toast.type === 'success' ? '✓ Completed' : toast.type === 'error' ? '⚠ System Error' : 'ℹ Sync Update'}
              </span>
              <p className="text-xs text-slate-700 font-semibold leading-relaxed whitespace-pre-line">{toast.message}</p>
            </div>
            <button
              onClick={() => setToast(null)}
              className="text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer self-start"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Glassmorphic Confirmation Modal */}
      <AnimatePresence>
        {confirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="space-y-1.5">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider font-display">
                  {confirmModal.title || 'Are you absolutely sure?'}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                  {confirmModal.message}
                </p>
              </div>
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setConfirmModal(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black uppercase rounded-xl transition-all cursor-pointer border border-slate-200/50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    confirmModal.onConfirm();
                    setConfirmModal(null);
                  }}
                  className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white text-xs font-black uppercase rounded-xl transition-all cursor-pointer shadow-xs"
                >
                  Confirm Action
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
