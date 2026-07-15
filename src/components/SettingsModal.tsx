import React, { useState, useEffect } from 'react';
import { 
  X, 
  Settings, 
  Shield, 
  Eye, 
  EyeOff, 
  Check, 
  AlertCircle, 
  Info, 
  LockKeyhole,
  Database,
  Trash2,
  HardDrive,
  RefreshCw,
  Key,
  ShieldCheck,
  Copy,
  ExternalLink,
  Users,
  User,
  Plus,
  AlertTriangle,
  LogOut,
  Power,
  CheckCircle2,
  Terminal
} from 'lucide-react';
import { AppSettings, VideoItem, LinkedAccount } from '../types';
import { 
  getTokenLogs, 
  clearTokenLogs, 
  getTokenThreshold, 
  setTokenThreshold, 
  getTokenTotals, 
  isThresholdExceeded,
  TokenLogItem
} from '../lib/tokenTracker';
import { Cpu, Coins, ShieldAlert, BadgeInfo } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (newSettings: AppSettings) => void;
  videos: VideoItem[];
  onUpdateVideos: (updatedVideos: VideoItem[]) => void;
  user?: any;
  token?: string | null;
  onSetToken?: (token: string | null) => void;
  onSetUser?: (user: any) => void;
  linkedAccounts?: LinkedAccount[];
  onUpdateLinkedAccounts?: (accounts: LinkedAccount[]) => void;
  onLinkNewAccount?: () => void;
  onUnlinkAccount?: (email: string) => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  videos,
  onUpdateVideos,
  user,
  token,
  onSetToken,
  onSetUser,
  linkedAccounts = [],
  onUpdateLinkedAccounts,
  onLinkNewAccount,
  onUnlinkAccount
}: SettingsModalProps) {
  // Tabs
  const [activeTab, setActiveTab] = useState<'api' | 'security' | 'storage' | 'tokens'>('api');

  // Form State
  const [openRouterApiKey, setOpenRouterApiKey] = useState(settings.openRouterApiKey || '');
  const [customGeminiApiKey, setCustomGeminiApiKey] = useState(settings.customGeminiApiKey || '');
  const [useOpenRouter, setUseOpenRouter] = useState(settings.useOpenRouter || false);
  const [openRouterModel, setOpenRouterModel] = useState(settings.openRouterModel || 'google/gemini-2.5-flash');
  const [googleClientId, setGoogleClientId] = useState(settings.googleClientId || '');
  const [settingsPassword, setSettingsPassword] = useState(settings.settingsPassword || '');
  const [encryptLocalStorage, setEncryptLocalStorage] = useState(settings.encryptLocalStorage || false);

  // Password Verification Lock
  const [isLockedByPass, setIsLockedByPass] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  // Visibilities
  const [showORKey, setShowORKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showPassVerify, setShowPassVerify] = useState(false);

  // Token tracker states
  const [tokenLogs, setTokenLogs] = useState<TokenLogItem[]>([]);
  const [tokenThreshold, setTokenThresholdState] = useState(100000);
  const [tokenTotals, setTokenTotalsState] = useState({
    totalPromptChars: 0,
    totalResponseChars: 0,
    totalPromptTokens: 0,
    totalResponseTokens: 0,
    totalCost: 0,
  });
  const [thresholdExceeded, setThresholdExceeded] = useState(false);

  useEffect(() => {
    const updateTokenData = () => {
      setTokenLogs(getTokenLogs());
      setTokenThresholdState(getTokenThreshold());
      setTokenTotalsState(getTokenTotals());
      setThresholdExceeded(isThresholdExceeded());
    };

    if (isOpen) {
      updateTokenData();
    }

    window.addEventListener('marginalia-token-updated', updateTokenData);
    return () => {
      window.removeEventListener('marginalia-token-updated', updateTokenData);
    };
  }, [isOpen]);

  // Storage Stats State
  const [storageEstimate, setStorageEstimate] = useState<{ usage: number; quota: number } | null>(null);
  const [localStorageUsage, setLocalStorageUsage] = useState<{ bytes: number; kb: number; percentage: number }>({ bytes: 0, kb: 0, percentage: 0 });

  // Function to refresh storage stats
  const refreshStorageStats = () => {
    // 1. Browser overall estimate (IndexedDB, Cache API, etc.)
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then((estimate) => {
        setStorageEstimate({
          usage: estimate.usage || 0,
          quota: estimate.quota || 1,
        });
      }).catch((e) => console.error("Failed to estimate storage", e));
    }

    // 2. LocalStorage precise count
    let lsTotal = 0;
    try {
      for (const key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          const val = localStorage[key];
          lsTotal += (key.length + (val ? val.length : 0)) * 2; // Approximate byte size for UTF-16 characters
        }
      }
    } catch (e) {
      console.error("LocalStorage counting failed", e);
    }
    const kb = lsTotal / 1024;
    const maxLocalStorageBytes = 5 * 1024 * 1024; // 5MB standard limit
    const percentage = Math.min((lsTotal / maxLocalStorageBytes) * 100, 100);
    setLocalStorageUsage({ bytes: lsTotal, kb, percentage });
  };

  // Trigger statistics calculation on active tab changes
  useEffect(() => {
    if (isOpen) {
      refreshStorageStats();
    }
  }, [isOpen, activeTab]);

  // Global Pruning Actions
  const handlePruneTranscripts = () => {
    if (window.confirm("Are you sure you want to prune transcripts for all non-pinned videos? This will keep all metadata (summaries, ratings, bookmarks) but remove the detailed segment texts to free up storage.")) {
      const updated = videos.map(video => {
        if (video.isPinned) return video;
        const { transcript, ...rest } = video;
        return rest;
      });
      onUpdateVideos(updated);
      setTimeout(refreshStorageStats, 100);
      alert("Transcripts for non-pinned videos cleared successfully!");
    }
  };

  const handleCleanStaleVideos = () => {
    if (window.confirm("Are you sure you want to clear older unpinned videos from your library? Pinned videos will be preserved.")) {
      const updated = videos.filter(video => video.isPinned);
      onUpdateVideos(updated);
      setTimeout(refreshStorageStats, 100);
      alert(`Library cleared! Retained ${updated.length} pinned videos.`);
    }
  };

  const handlePruneSingleTranscript = (videoId: string) => {
    const video = videos.find(v => v.id === videoId);
    if (!video) return;
    if (window.confirm(`Are you sure you want to delete the transcript segments for "${video.title}"? This will keep its summary, bookmarks, and rating, but free up storage.`)) {
      const updated = videos.map(v => {
        if (v.id === videoId) {
          const { transcript, ...rest } = v;
          return rest;
        }
        return v;
      });
      onUpdateVideos(updated);
      setTimeout(refreshStorageStats, 100);
    }
  };

  const handleDeleteSingleVideo = (videoId: string) => {
    const video = videos.find(v => v.id === videoId);
    if (!video) return;
    if (window.confirm(`Are you sure you want to completely delete "${video.title}" from your workspace library? This action is irreversible.`)) {
      const updated = videos.filter(v => v.id !== videoId);
      onUpdateVideos(updated);
      setTimeout(refreshStorageStats, 100);
    }
  };

  const getVideoSizeStr = (v: VideoItem) => {
    const str = JSON.stringify(v);
    const bytes = str.length * 2;
    if (bytes > 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  // Token Manager states
  const [manualTokenInput, setManualTokenInput] = useState('');
  const [showActiveToken, setShowActiveToken] = useState(false);
  const [isValidatingToken, setIsValidatingToken] = useState(false);
  const [tokenValidationInfo, setTokenValidationInfo] = useState<any>(null);
  const [tokenValidationError, setTokenValidationError] = useState<string | null>(null);
  
  // Test connection for a specific linked account
  const [testingAccountEmail, setTestingAccountEmail] = useState<string | null>(null);
  const [accountTestResults, setAccountTestResults] = useState<Record<string, { success: boolean; message: string }>>({});

  const handleVerifyActiveToken = async () => {
    if (!token) {
      setTokenValidationError("No active token found to verify.");
      return;
    }
    setIsValidatingToken(true);
    setTokenValidationError(null);
    setTokenValidationInfo(null);
    try {
      const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${token}`);
      if (res.ok) {
        const data = await res.json();
        setTokenValidationInfo(data);
      } else {
        const errData = await res.json();
        setTokenValidationError(errData.error_description || errData.error || "Verification failed");
      }
    } catch (e: any) {
      setTokenValidationError(e.message || "Failed to contact Google OAuth Verification Server");
    } finally {
      setIsValidatingToken(false);
    }
  };

  const handleTestAccountToken = async (email: string, testToken: string) => {
    setTestingAccountEmail(email);
    try {
      const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${testToken}`);
      if (res.ok) {
        const data = await res.json();
        const expIn = parseInt(data.expires_in, 10);
        const minsLeft = Math.floor(expIn / 60);
        setAccountTestResults(prev => ({
          ...prev,
          [email]: { success: true, message: `Active! Expires in ~${minsLeft} mins. Scopes: ${data.scope?.split(' ').length || 0} granted.` }
        }));
      } else {
        const errData = await res.json();
        setAccountTestResults(prev => ({
          ...prev,
          [email]: { success: false, message: `Expired or Revoked: ${errData.error_description || errData.error}` }
        }));
      }
    } catch (e: any) {
      setAccountTestResults(prev => ({
        ...prev,
        [email]: { success: false, message: `Failed to verify: ${e.message}` }
      }));
    } finally {
      setTestingAccountEmail(null);
    }
  };

  const handleApplyManualToken = () => {
    if (!manualTokenInput.trim()) {
      alert("Please enter a valid non-empty access token");
      return;
    }
    const tokenStr = manualTokenInput.trim();
    if (onSetToken && onSetUser) {
      onSetToken(tokenStr);
      onSetUser({
        email: "manual-developer-session@gmail.com",
        displayName: "Scholastic Developer (Override)",
        photoURL: ""
      });
      alert("Manual Token Override Applied Successfully!");
      setManualTokenInput('');
    }
  };

  const handleSwitchActiveAccount = (account: LinkedAccount) => {
    if (onSetToken && onSetUser) {
      onSetToken(account.accessToken);
      onSetUser({
        email: account.email,
        displayName: account.displayName,
        photoURL: account.photoURL
      });
      alert(`Switched active session to: ${account.email}`);
    }
  };

  // Export Curation Library & Notes Database
  const handleExportDatabase = () => {
    try {
      const dataStr = JSON.stringify({
        appName: "Marginalia Curation & Notes",
        version: "2.0",
        exportDate: new Date().toISOString(),
        videos: videos
      }, null, 2);
      
      const blob = new Blob([dataStr], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      
      const exportFileDefaultName = `marginalia_library_backup_${new Date().toISOString().slice(0, 10)}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', url);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      
      // Cleanup
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (e: any) {
      alert("Failed to export library backup: " + e.message);
    }
  };

  // Import and Sanitize Curation Library Database
  const handleImportDatabase = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          
          if (!parsed || !Array.isArray(parsed.videos)) {
            alert("Security/Format Validation Error: The selected file does not contain a valid Marginalia database export.");
            return;
          }

          // Secure Schema Validation & Sanitization: Ensure each item has required properties
          const validatedVideos: VideoItem[] = [];
          for (const item of parsed.videos) {
            if (typeof item === 'object' && item !== null && item.title && (item.url || item.videoId)) {
              validatedVideos.push({
                id: item.id || item.videoId || `import-${Date.now()}-${Math.random()}`,
                videoId: item.videoId || '',
                title: String(item.title),
                channelTitle: String(item.channelTitle || 'Imported Resource'),
                thumbnail: String(item.thumbnail || ''),
                url: String(item.url || ''),
                summary: String(item.summary || ''),
                category: String(item.category || 'Science & Education'),
                rating: Number(item.rating) || 5,
                ratingJustification: String(item.ratingJustification || ''),
                takeaways: Array.isArray(item.takeaways) ? item.takeaways.map(String) : [],
                createdAt: String(item.createdAt || new Date().toISOString()),
                isPinned: !!item.isPinned,
                keepNoteColor: String(item.keepNoteColor || ''),
                watchedStatus: item.watchedStatus || 'To Watch',
                studyNotes: String(item.studyNotes || ''),
                extractedLinks: Array.isArray(item.extractedLinks) ? item.extractedLinks.map(String) : [],
                actualPurpose: String(item.actualPurpose || ''),
                debunkedClickbait: String(item.debunkedClickbait || ''),
                conceptualComplexity: String(item.conceptualComplexity || 'Intermediate (advanced-undergraduate)'),
                interdisciplinaryField: String(item.interdisciplinaryField || ''),
                conceptTags: Array.isArray(item.conceptTags) ? item.conceptTags.map(String) : [],
                bookmarks: Array.isArray(item.bookmarks) ? item.bookmarks : []
              });
            }
          }

          if (validatedVideos.length === 0) {
            alert("No valid curated video records found in the import payload.");
            return;
          }

          const mode = window.confirm(
            `Found ${validatedVideos.length} curation items in the backup file!\n\n` +
            `Click OK (or Confirm) to APPEND & MERGE (adds missing items and updates existing ones).\n` +
            `Click Cancel to OVERWRITE ENTIRE LIBRARY (completely deletes your current bookshelf and replaces it).`
          );

          if (mode) {
            // Append and Merge
            const videoMap = new Map(videos.map(v => [v.id || v.videoId, v]));
            validatedVideos.forEach(v => {
              const key = v.id || v.videoId;
              videoMap.set(key, v);
            });
            const merged = Array.from(videoMap.values());
            onUpdateVideos(merged);
            alert(`Database import completed! Successfully merged/updated library. Now contains ${merged.length} total items.`);
          } else {
            // Overwrite
            const doubleCheck = window.confirm("WARNING: This will completely ERASE your current local database and replace it with the import file. This cannot be undone. Proceed?");
            if (doubleCheck) {
              onUpdateVideos(validatedVideos);
              alert(`Database overwrite completed! Loaded ${validatedVideos.length} curations.`);
            }
          }
          refreshStorageStats();
        } catch (err: any) {
          alert("Import failed: File content is corrupt or invalid JSON. Error: " + err.message);
        }
      };
      fileReader.readAsText(file);
    }
  };

  // Check lock on open
  useEffect(() => {
    if (isOpen) {
      if (settings.settingsPassword && settings.isSettingsLocked) {
        setIsLockedByPass(true);
        setPasswordInput('');
        setPasswordError(false);
      } else {
        setIsLockedByPass(false);
      }
      
      // Load current form state
      setOpenRouterApiKey(settings.openRouterApiKey || '');
      setCustomGeminiApiKey(settings.customGeminiApiKey || '');
      setUseOpenRouter(settings.useOpenRouter || false);
      setOpenRouterModel(settings.openRouterModel || 'google/gemini-2.5-flash');
      setGoogleClientId(settings.googleClientId || '');
      setSettingsPassword(settings.settingsPassword || '');
      setEncryptLocalStorage(settings.encryptLocalStorage || false);
    }
  }, [isOpen, settings]);

  // Auto-save form changes locally
  const handleSave = (updatedFields: Partial<AppSettings>) => {
    const nextSettings: AppSettings = {
      openRouterApiKey,
      customGeminiApiKey,
      useOpenRouter,
      openRouterModel,
      googleClientId,
      settingsPassword,
      encryptLocalStorage,
      isSettingsLocked: settingsPassword ? true : false,
      ...updatedFields
    };
    onSaveSettings(nextSettings);
  };

  const handleMapCategoryToAccount = (category: string, email: string) => {
    const currentMap = settings.categoryAccountMap || {};
    const newMap = { ...currentMap };
    if (email === '') {
      delete newMap[category];
    } else {
      newMap[category] = email;
    }
    handleSave({ categoryAccountMap: newMap });
  };

  if (!isOpen) return null;

  // Unlock with password
  const handleUnlockSettings = () => {
    if (passwordInput === settings.settingsPassword) {
      setIsLockedByPass(false);
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-xs">
      
      {/* If Settings is Locked by Password */}
      {isLockedByPass ? (
        <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 text-center space-y-4">
          <div className="mx-auto w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center border border-rose-100">
            <LockKeyhole className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 font-display">Settings Locked</h3>
            <p className="text-xs text-slate-400 mt-1">This workspace's settings are password protected. Enter the administrator password to manage API keys.</p>
          </div>
          <div className="space-y-2">
            <input
              type={showPassVerify ? "text" : "password"}
              placeholder="Enter password..."
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUnlockSettings()}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-rose-500 rounded-xl text-xs outline-hidden text-center font-bold tracking-widest text-slate-800"
            />
            {passwordError && (
              <p className="text-[10px] text-rose-600 font-bold flex items-center gap-1 justify-center">
                <AlertCircle className="w-3 h-3" />
                <span>Incorrect administrator password. Try again!</span>
              </p>
            )}
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 text-xs font-bold px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleUnlockSettings}
              className="flex-1 text-xs font-black px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl cursor-pointer"
            >
              Unlock Settings
            </button>
          </div>
        </div>
      ) : (
        /* Actual Settings UI Panel */
        <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[88vh] overflow-hidden shadow-2xl flex flex-col relative transition-all duration-300">
          
          {/* Header */}
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-amber-100 text-amber-800 rounded-xl border border-amber-200">
                <Settings className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900 font-display flex items-center gap-2">
                  <span>Workspace Settings</span>
                </h2>
                <p className="text-[10px] text-slate-400">Configure your personal API keys and local persistence security</p>
              </div>
            </div>
            
            <button
              onClick={onClose}
              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex bg-slate-100/50 p-1 border-b border-slate-100 shrink-0 gap-1">
            <button
              onClick={() => setActiveTab('api')}
              className={`flex-1 py-2 text-xs font-black rounded-lg transition-all cursor-pointer ${
                activeTab === 'api' 
                  ? 'bg-white text-slate-900 shadow-2xs font-extrabold border border-slate-200/55' 
                  : 'text-slate-500 hover:text-slate-800 hover:bg-white/30'
              }`}
            >
              🔑 Bring Your Own Key (BYOK)
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={`flex-1 py-2 text-xs font-black rounded-lg transition-all cursor-pointer ${
                activeTab === 'security' 
                  ? 'bg-white text-slate-900 shadow-2xs font-extrabold border border-slate-200/55' 
                  : 'text-slate-500 hover:text-slate-800 hover:bg-white/30'
              }`}
            >
              🛡️ Workspace Security & Locks
            </button>
            <button
              onClick={() => setActiveTab('storage')}
              className={`flex-1 py-2 text-xs font-black rounded-lg transition-all cursor-pointer ${
                activeTab === 'storage' 
                  ? 'bg-white text-slate-900 shadow-2xs font-extrabold border border-slate-200/55' 
                  : 'text-slate-500 hover:text-slate-800 hover:bg-white/30'
              }`}
            >
              📦 Storage Cache
            </button>
            <button
              onClick={() => setActiveTab('tokens')}
              className={`flex-1 py-2 text-xs font-black rounded-lg transition-all cursor-pointer ${
                activeTab === 'tokens' 
                  ? 'bg-white text-slate-900 shadow-2xs font-extrabold border border-slate-200/55' 
                  : 'text-slate-500 hover:text-slate-800 hover:bg-white/30'
              }`}
            >
              🎫 Token Manager
            </button>
          </div>

          {/* Modal Content Panels */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">

            {/* TAB 1: API KEYS */}
            {activeTab === 'api' && (
              <div className="space-y-5">
                
                {/* Bring Your Own Key notice */}
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 flex gap-3 text-xs text-slate-600">
                  <Info className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-extrabold text-indigo-950 block">Individual API Configuration (Bring Your Own Key)</span>
                    <p className="leading-relaxed font-medium">
                      This platform operates on a <strong>Bring Your Own Key (BYOK)</strong> model. All API keys and preferences you paste are stored strictly within your local browser's secure cache. No billing or token limits are tied to the developer—it is your private, individual environment!
                    </p>
                  </div>
                </div>

                {/* OpenRouter Config */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4.5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                      <h3 className="font-extrabold text-xs text-slate-700 uppercase tracking-wider font-display">OpenRouter Key Integration</h3>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={useOpenRouter} 
                        onChange={(e) => {
                          setUseOpenRouter(e.target.checked);
                          handleSave({ useOpenRouter: e.target.checked });
                        }}
                        className="sr-only peer" 
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-500"></div>
                      <span className="ml-2 text-xs font-extrabold text-slate-600">Enable OpenRouter Mode</span>
                    </label>
                  </div>

                  <div className={`space-y-3.5 transition-all duration-300 ${useOpenRouter ? 'opacity-100' : 'opacity-55 pointer-events-none'}`}>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Your Personal OpenRouter API Key:</label>
                      <div className="relative">
                        <input
                          type={showORKey ? "text" : "password"}
                          placeholder="sk-or-v1-..."
                          value={openRouterApiKey}
                          onChange={(e) => {
                            setOpenRouterApiKey(e.target.value);
                            handleSave({ openRouterApiKey: e.target.value });
                          }}
                          className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 focus:border-rose-500 rounded-xl text-xs outline-hidden text-slate-700 font-mono"
                        />
                        <button
                          onClick={() => setShowORKey(!showORKey)}
                          className="absolute right-2.5 top-1.5 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {showORKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">If blank, our backend server fallbacks to standard system keys when available.</p>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Select OpenRouter Model:</label>
                      <select
                        value={openRouterModel}
                        onChange={(e) => {
                          setOpenRouterModel(e.target.value);
                          handleSave({ openRouterModel: e.target.value });
                        }}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-rose-500 rounded-xl text-xs outline-hidden text-slate-700 font-semibold cursor-pointer"
                      >
                        <option value="google/gemini-2.5-flash">Google Gemini 2.5 Flash (Fast & Cheap) (Default)</option>
                        <option value="google/gemini-2.5-pro">Google Gemini 2.5 Pro (Extreme Curation Quality)</option>
                        <option value="meta-llama/llama-3.3-70b-instruct">Meta LLaMA 3.3 70B Instruct (Powerful Open Source)</option>
                        <option value="deepseek/deepseek-chat">DeepSeek V3 Chat (High Speed Intelligence)</option>
                        <option value="qwen/qwen-2.5-72b-instruct">Alibaba Qwen 2.5 72B Instruct (Highly Precise)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Direct Gemini Custom API Key */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4.5 space-y-3.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                    <h3 className="font-extrabold text-xs text-slate-700 uppercase tracking-wider font-display">Custom Google Gemini API Key</h3>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Your Direct Gemini API Key:</label>
                    <div className="relative">
                      <input
                        type={showGeminiKey ? "text" : "password"}
                        placeholder="AIzaSy..."
                        value={customGeminiApiKey}
                        onChange={(e) => {
                          setCustomGeminiApiKey(e.target.value);
                          handleSave({ customGeminiApiKey: e.target.value });
                        }}
                        className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 focus:border-amber-500 rounded-xl text-xs outline-hidden text-slate-700 font-mono"
                      />
                      <button
                        onClick={() => setShowGeminiKey(!showGeminiKey)}
                        className="absolute right-2.5 top-1.5 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showGeminiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Directly overrides the backend server client key inside your current browser session.</p>
                  </div>
                </div>

                {/* Google OAuth Config (Client-Side Direct Login) */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4.5 space-y-3.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                    <h3 className="font-extrabold text-xs text-slate-700 uppercase tracking-wider font-display">Google Sync Integration (OAuth BYOK)</h3>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed font-medium">
                    This workspace operates 100% in your browser. To sync video studies directly to <strong>Google Tasks</strong> and export study packets to <strong>Google Docs</strong>, bring your own Google Client ID.
                  </p>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Your Google OAuth Client ID:</label>
                    <input
                      type="text"
                      placeholder="1234567890-abcdefg.apps.googleusercontent.com"
                      value={googleClientId}
                      onChange={(e) => {
                        setGoogleClientId(e.target.value);
                        handleSave({ googleClientId: e.target.value });
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl text-xs outline-hidden text-slate-700 font-mono"
                    />
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wide block">How to configure your credentials:</span>
                    <ol className="text-[10px] text-slate-500 list-decimal pl-4 space-y-1 leading-normal font-medium">
                      <li>Go to the <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-extrabold">Google Cloud Console</a>.</li>
                      <li>Create an <strong>OAuth Client ID</strong> configured for a <strong>Web application</strong>.</li>
                      <li>Under <strong>Authorized JavaScript Origins</strong>, add your current App URL:
                        <code className="block bg-slate-100 border border-slate-200 px-2 py-1 rounded-md text-[9px] font-bold text-slate-700 mt-1 select-all font-mono break-all">{window.location.origin}</code>
                      </li>
                      <li>Under <strong>Authorized redirect URIs</strong>, add the exact same URL:
                        <code className="block bg-slate-100 border border-slate-200 px-2 py-1 rounded-md text-[9px] font-bold text-slate-700 mt-1 select-all font-mono break-all">{window.location.origin}/</code>
                      </li>
                      <li>Copy your Client ID, paste it above, and click <strong>Done & Save</strong>. You are fully set up securely!</li>
                    </ol>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: STORAGE CACHE */}
            {activeTab === 'storage' && (
              <div className="space-y-5">
                {/* Browser Storage Estimate */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4.5 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
                        <HardDrive className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-xs text-slate-700 uppercase tracking-wider font-display">IndexedDB & Sandbox Quota</h3>
                        <p className="text-[10px] text-slate-400 font-medium">Browser-allocated local disk space for this application</p>
                      </div>
                    </div>
                    <button 
                      type="button"
                      onClick={refreshStorageStats} 
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 rounded-lg transition-all cursor-pointer border border-slate-200"
                      title="Refresh storage statistics"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {storageEstimate ? (
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold text-slate-600">
                        <span>Used Space: {((storageEstimate.usage || 0) / (1024 * 1024)).toFixed(2)} MB</span>
                        <span>Total Quota Limit: {((storageEstimate.quota || 1) / (1024 * 1024 * 1024)).toFixed(2)} GB</span>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                        <div 
                          className="h-full bg-blue-500 transition-all duration-500"
                          style={{ width: `${Math.max((((storageEstimate.usage || 0) / (storageEstimate.quota || 1)) * 100), 0.5)}%` }}
                        ></div>
                      </div>
                      
                      <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                        <span>Percentage Consumed: {(((storageEstimate.usage || 0) / (storageEstimate.quota || 1)) * 100).toFixed(4)}%</span>
                        <span>Available Space: {(((storageEstimate.quota - storageEstimate.usage) || 0) / (1024 * 1024)).toFixed(2)} MB</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">Estimating browser storage quota...</p>
                  )}
                </div>

                {/* LocalStorage precise count */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4.5 space-y-3.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
                      <Database className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-xs text-slate-700 uppercase tracking-wider font-display">Local Storage Cache (5MB Max)</h3>
                      <p className="text-[10px] text-slate-400 font-medium">Core video indices, study booklets, and session metadata reside here</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold text-slate-600">
                      <span>Used Space: {localStorageUsage.kb.toFixed(2)} KB</span>
                      <span>Max Standard Limit: 5,120.00 KB</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                      <div 
                        className={`h-full transition-all duration-500 ${
                          localStorageUsage.percentage > 85 ? 'bg-rose-500' : localStorageUsage.percentage > 55 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.max(localStorageUsage.percentage, 1)}%` }}
                      ></div>
                    </div>

                    <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                      <span>Percentage Consumed: {localStorageUsage.percentage.toFixed(2)}%</span>
                      <span>Free Capacity Left: {Math.max(5120 - localStorageUsage.kb, 0).toFixed(2)} KB</span>
                    </div>
                  </div>
                </div>

                {/* Clear / Pruning Actions */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4.5 space-y-4">
                  <h3 className="font-extrabold text-xs text-slate-700 uppercase tracking-wider font-display border-b border-slate-100 pb-2">Global Cache Mitigation</h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 border border-slate-200/60 rounded-xl space-y-2 flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-black text-slate-700">Prune Transcripts Cache</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed font-medium">
                          Delete generated transcript dialog segment nodes from all <strong>unpinned</strong> video studies. This retains summaries, notes, links, bookmarks, and ratings intact.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handlePruneTranscripts}
                        className="w-full text-center text-xs font-bold py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-all cursor-pointer shadow-xs mt-2"
                      >
                        Prune All Transcripts
                      </button>
                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-200/60 rounded-xl space-y-2 flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-black text-rose-700">Clear Unpinned Videos</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed font-medium">
                          Purge all unpinned resources from your offline index workspace. Only your starred favorites, critical bookmarks, and manual logs will be preserved.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleCleanStaleVideos}
                        className="w-full text-center text-xs font-bold py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-all cursor-pointer shadow-xs mt-2"
                      >
                        Prune Unpinned Studies
                      </button>
                    </div>
                  </div>
                </div>

                {/* JSON Database Backup & Recovery */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4.5 space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                    <Database className="w-4 h-4 text-emerald-600" />
                    <div>
                      <h3 className="font-extrabold text-xs text-slate-700 uppercase tracking-wider font-display">Backup & Portability Suite</h3>
                      <p className="text-[10px] text-slate-400 font-medium">Protect your research from cache clearings, device migration, or browser data loss</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Export Card */}
                    <div className="p-3.5 bg-emerald-50/40 border border-emerald-100 rounded-xl flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-black text-emerald-800">Export Library (JSON)</h4>
                        <p className="text-[10px] text-emerald-600/85 mt-0.5 leading-relaxed font-medium">
                          Saves all curated videos, notes, bookmarks, Leitner decks, and ratings into a secure standalone JSON file. Keep backups safe locally!
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleExportDatabase}
                        className="w-full text-center text-xs font-bold py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all cursor-pointer shadow-xs mt-3 border border-emerald-700"
                      >
                        Download JSON Backup
                      </button>
                    </div>

                    {/* Import Card */}
                    <div className="p-3.5 bg-blue-50/40 border border-blue-100 rounded-xl flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-black text-blue-800">Import Library (JSON)</h4>
                        <p className="text-[10px] text-blue-600/85 mt-0.5 leading-relaxed font-medium">
                          Upload a previously saved backup. You can choose to either safely <strong>merge/upsert</strong> new items, or completely <strong>overwrite</strong> the existing bookshelf.
                        </p>
                      </div>
                      <div className="relative mt-3">
                        <input
                          type="file"
                          accept=".json"
                          onChange={handleImportDatabase}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <button
                          type="button"
                          className="w-full text-center text-xs font-bold py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all pointer-events-none border border-blue-700"
                        >
                          Select JSON Backup File
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Specific Video List for Granular Management */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4.5 space-y-3.5">
                  <div className="border-b border-slate-100 pb-2">
                    <h3 className="font-extrabold text-xs text-slate-700 uppercase tracking-wider font-display">Granular Resource Inspector</h3>
                    <p className="text-[10px] text-slate-400 font-medium">View exact storage footprints and selectively delete stale summaries or heavy transcripts</p>
                  </div>

                  <div className="max-h-64 overflow-y-auto space-y-2.5 pr-1 divide-y divide-slate-100">
                    {videos.length === 0 ? (
                      <p className="text-xs text-slate-400 italic text-center py-6 font-medium">No video analyses found in your library.</p>
                    ) : (
                      videos.map((video, idx) => {
                        const hasTranscript = !!video.transcript;
                        const sizeStr = getVideoSizeStr(video);
                        
                        return (
                          <div key={video.id || idx} className="flex items-center justify-between pt-2.5 first:pt-0 gap-3">
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <img 
                                src={video.thumbnail} 
                                alt={video.title} 
                                className="w-12 h-8 rounded-md object-cover border border-slate-200 bg-slate-100 shrink-0"
                              />
                              <div className="min-w-0">
                                <h4 className="text-xs font-extrabold text-slate-700 truncate font-display leading-tight">{video.title}</h4>
                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wide">{video.category}</span>
                                  <span className="text-[9px] font-mono text-slate-500 bg-slate-100 border border-slate-200/60 px-1 rounded font-bold">{sizeStr}</span>
                                  {hasTranscript && (
                                    <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1 border border-blue-100 rounded">Has Transcript</span>
                                  )}
                                  {video.isPinned && (
                                    <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1 border border-amber-100 rounded">Pinned ⭐</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {hasTranscript && (
                                <button
                                  type="button"
                                  onClick={() => handlePruneSingleTranscript(video.id)}
                                  className="px-2 py-1 text-[10px] font-bold bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-800 border border-slate-200 hover:border-slate-300 rounded-md shadow-3xs cursor-pointer transition-all"
                                  title="Prune this video's transcript only"
                                >
                                  Prune Transcript
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteSingleVideo(video.id)}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 rounded-md cursor-pointer border border-rose-150/60 transition-all"
                                title="Delete this video analysis completely"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: SECURITY */}
            {activeTab === 'security' && (
              <div className="space-y-5 animate-fade-in">
                
                {/* Settings Protection Password */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4.5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-slate-700 fill-slate-100" />
                    <h3 className="font-extrabold text-xs text-slate-700 uppercase tracking-wider font-display">Lock & Password Protect Settings</h3>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed font-medium">
                    Prevent other users of this device or visitors of your public link from opening this Settings modal to see, edit, or copy your custom API keys. Perfect when running public demos!
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Set Administrator Password:</label>
                      <div className="relative">
                        <input
                          type={showPass ? "text" : "password"}
                          placeholder="Enter desired password..."
                          value={settingsPassword}
                          onChange={(e) => {
                            setSettingsPassword(e.target.value);
                            handleSave({ settingsPassword: e.target.value, isSettingsLocked: e.target.value ? true : false });
                          }}
                          className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 focus:border-slate-500 rounded-xl text-xs outline-hidden text-slate-700 font-bold"
                        />
                        <button
                          onClick={() => setShowPass(!showPass)}
                          className="absolute right-2.5 top-1.5 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                      {settingsPassword ? (
                        <p className="text-xs text-emerald-700 font-semibold flex items-center gap-1.5">
                          <Check className="w-4 h-4 text-emerald-500" />
                          <span>Password Lock Active! Settings secured.</span>
                        </p>
                      ) : (
                        <p className="text-xs text-slate-400 italic font-medium">
                          No password set. Anyone can access settings.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Local Storage Cryptography / Data obscurity */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4.5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <LockKeyhole className="w-4 h-4 text-slate-700" />
                      <h3 className="font-extrabold text-xs text-slate-700 uppercase tracking-wider font-display">LocalStorage Encrypted Obscurity</h3>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={encryptLocalStorage} 
                        onChange={(e) => {
                          setEncryptLocalStorage(e.target.checked);
                          handleSave({ encryptLocalStorage: e.target.checked });
                          
                          // Alert on the fly
                          if (e.target.checked) {
                            alert("Local obscurity activated! Your curated videos and notes will be encoded in base64 within browser cache to protect against snooping network plugins.");
                          }
                        }}
                        className="sr-only peer" 
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                      <span className="ml-2 text-xs font-extrabold text-slate-600">Obscure My Local Library</span>
                    </label>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed font-medium">
                    This encodes your local storage records under a Base64 cipher block. Even if someone inspects the storage of this browser (using extensions or developer tools), they cannot read your curated studies, summaries, or custom notepad text directly.
                  </p>
                </div>

              </div>
            )}

            {/* TAB 4: TOKEN MANAGER */}
            {activeTab === 'tokens' && (
              <div className="space-y-5 animate-fade-in">
                {/* Generative AI Token & Cost Auditor */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4.5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                        <Coins className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-xs text-slate-700 uppercase tracking-wider font-display">Generative AI Token & Cost Auditor</h3>
                        <p className="text-[10px] text-slate-400 font-medium">Estimate real-time character volume and individual API cost liability</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("Are you sure you want to clear all recorded token usage history logs?")) {
                          clearTokenLogs();
                        }
                      }}
                      className="px-2.5 py-1 text-[10px] font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-150 rounded-lg cursor-pointer transition-all"
                    >
                      Clear Logs
                    </button>
                  </div>

                  {/* Threshold warning */}
                  {thresholdExceeded && (
                    <div className="p-3 bg-amber-50 border border-amber-150 rounded-xl flex gap-2.5 text-xs text-amber-800 animate-pulse">
                      <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-black">Warning: High Context Usage Exceeded!</span>
                        <p className="text-[10px] text-amber-600 mt-0.5 leading-relaxed font-medium">
                          Your cumulative character usage ({ (tokenTotals.totalPromptChars + tokenTotals.totalResponseChars).toLocaleString() } Chars) has exceeded your configured safety threshold of { tokenThreshold.toLocaleString() } Chars.
                        </p>
                        <p className="text-[10px] text-amber-500 mt-1 font-semibold">
                          Consider selecting faster models or enabling rapid Bulk summaries to conserve individual API key quotas!
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Bento statistics counters */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-50 border border-slate-150/60 p-3 rounded-xl">
                      <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">Total Prompts</span>
                      <span className="text-sm font-black text-slate-800 block mt-0.5">
                        {tokenTotals.totalPromptTokens.toLocaleString()} <span className="text-[10px] font-medium text-slate-400">tokens</span>
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono">({tokenTotals.totalPromptChars.toLocaleString()} chars)</span>
                    </div>

                    <div className="bg-slate-50 border border-slate-150/60 p-3 rounded-xl">
                      <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">Total Responses</span>
                      <span className="text-sm font-black text-slate-800 block mt-0.5">
                        {tokenTotals.totalResponseTokens.toLocaleString()} <span className="text-[10px] font-medium text-slate-400">tokens</span>
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono">({tokenTotals.totalResponseChars.toLocaleString()} chars)</span>
                    </div>

                    <div className="bg-slate-50 border border-slate-150/60 p-3 rounded-xl col-span-1">
                      <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">Estimated Cost</span>
                      <span className="text-sm font-black text-emerald-600 block mt-0.5">
                        ${tokenTotals.totalCost.toFixed(5)} <span className="text-[9px] font-medium text-emerald-500">USD</span>
                      </span>
                      <span className="text-[9px] text-slate-400">Micro-billed individually</span>
                    </div>

                    <div className="bg-slate-50 border border-slate-150/60 p-3 rounded-xl">
                      <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">Safety Status</span>
                      {thresholdExceeded ? (
                        <span className="px-2 py-0.5 inline-block text-[9px] font-black text-rose-700 bg-rose-50 border border-rose-150 rounded mt-2 animate-bounce">
                          EXCEEDED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 inline-block text-[9px] font-black text-emerald-700 bg-emerald-50 border border-emerald-150 rounded mt-2">
                          SAFE RANGE
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Configure Warning Threshold */}
                  <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <label className="text-xs font-extrabold text-slate-700 block">Context Warning Safety Threshold</label>
                      <p className="text-[10px] text-slate-400 font-medium">Trigger warning dialogs once cumulative prompt and response text exceeds this volume</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="5000"
                        step="5000"
                        value={tokenThreshold}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 10000;
                          setTokenThreshold(val);
                        }}
                        className="w-28 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-hidden text-slate-700 font-mono font-bold"
                      />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Chars</span>
                    </div>
                  </div>

                  {/* Token Request Audit Trail */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">Recent AI API Operations Log ({tokenLogs.length})</span>
                    {tokenLogs.length === 0 ? (
                      <div className="p-3 bg-slate-50 border border-slate-150/60 rounded-xl text-center text-[10px] text-slate-400 font-medium">
                        No AI operations tracked in this session yet. Submit summaries or transcripts to begin auditing.
                      </div>
                    ) : (
                      <div className="max-h-56 overflow-y-auto border border-slate-150 rounded-xl divide-y divide-slate-100 bg-slate-50/50">
                        {tokenLogs.map((log) => (
                          <div key={log.id} className="p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50 transition-colors">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="px-1.5 py-0.5 text-[8px] font-extrabold text-slate-700 bg-white border border-slate-200 rounded-sm uppercase tracking-wide">
                                  {log.action}
                                </span>
                                <span className="text-[10px] font-semibold text-slate-600 truncate max-w-[120px] sm:max-w-xs" title={log.model}>
                                  {log.model}
                                </span>
                              </div>
                              <span className="text-[9px] text-slate-400 block mt-0.5">
                                {new Date(log.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <div className="flex items-center gap-3.5 shrink-0 text-right text-xs self-end sm:self-auto">
                              <div className="font-medium text-slate-500">
                                <span className="font-mono text-slate-700 font-bold">{(log.promptChars + log.responseChars).toLocaleString()}</span> <span className="text-[9px] text-slate-400">chars</span>
                                <span className="block text-[9px] text-slate-400 font-mono">
                                  ({(log.promptTokens + log.responseTokens).toLocaleString()} tokens)
                                </span>
                              </div>
                              <div className="font-mono text-emerald-600 font-extrabold bg-emerald-50/70 border border-emerald-100/60 px-1.5 py-0.5 rounded-sm">
                                +${log.cost.toFixed(5)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Active Session Overview */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4.5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                        <Key className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-xs text-slate-700 uppercase tracking-wider font-display">Active Session Access Token</h3>
                        <p className="text-[10px] text-slate-400 font-medium">Underlying OAuth credentials used to query Google Tasks and Keep APIs</p>
                      </div>
                    </div>
                    {token && (
                      <span className="px-2 py-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full">
                        Connected Active
                      </span>
                    )}
                  </div>

                  {token ? (
                    <div className="space-y-3.5">
                      {/* User profile layout */}
                      <div className="flex items-center gap-3 bg-slate-50 border border-slate-150/60 p-3 rounded-xl">
                        {user?.photoURL ? (
                          <img 
                            src={user.photoURL} 
                            alt={user.displayName || "User"} 
                            className="w-10 h-10 rounded-full border border-slate-200"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="p-2 bg-indigo-100 text-indigo-700 rounded-full">
                            <User className="w-5 h-5" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-black text-slate-700 font-display">{user?.displayName || "Google Scholar"}</h4>
                          <p className="text-[10px] text-slate-400 font-mono truncate">{user?.email || "No email bound"}</p>
                        </div>
                        {onUnlinkAccount && user?.email && (
                          <button
                            type="button"
                            onClick={() => onUnlinkAccount(user.email)}
                            className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-150 rounded-lg cursor-pointer transition-all"
                          >
                            <Power className="w-3 h-3" />
                            <span>Sign Out</span>
                          </button>
                        )}
                      </div>

                      {/* Token Value Display */}
                      <div className="space-y-1.5">
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">Access Token Hash Key</label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <input
                              type={showActiveToken ? "text" : "password"}
                              readOnly
                              value={token}
                              className="w-full pl-3 pr-10 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs outline-hidden text-slate-600 font-mono select-all"
                            />
                            <button
                              type="button"
                              onClick={() => setShowActiveToken(!showActiveToken)}
                              className="absolute right-2.5 top-1.5 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                              title="Toggle token visibility"
                            >
                              {showActiveToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(token);
                              alert("Access Token copied to clipboard!");
                            }}
                            className="flex items-center gap-1 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 font-bold border border-slate-200 rounded-xl shadow-3xs cursor-pointer text-xs transition-all"
                          >
                            <Copy className="w-3.5 h-3.5 text-slate-500" />
                            <span>Copy</span>
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-relaxed font-medium">
                          🔑 Google Workspace access tokens remain valid for exactly <strong>3600 seconds (1 hour)</strong>. After expiration, a refresh signature or logging back in triggers automatically.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 bg-slate-50 border border-slate-150 rounded-xl space-y-3">
                      <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
                      <div>
                        <h4 className="text-xs font-black text-slate-700">No Active Session Token</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed font-medium">
                          You are currently working in offline sandbox mode. Let's link your Google Account to access real-time sync capabilities!
                        </p>
                      </div>
                      {onLinkNewAccount && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            setTimeout(() => {
                              onLinkNewAccount();
                            }, 200);
                          }}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs transition-all"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Connect Google Workspace</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Google OAuth Live Validation Station */}
                {token && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-4.5 space-y-4">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <h3 className="font-extrabold text-xs text-slate-700 uppercase tracking-wider font-display">Live Security & Scope Verification</h3>
                    </div>

                    <p className="text-xs text-slate-500 leading-relaxed font-medium">
                      Interrogate Google's secure <code>oauth2/v2/tokeninfo</code> API servers in real-time to audit exact scopes granted and remaining minutes until token expiry.
                    </p>

                    <button
                      type="button"
                      disabled={isValidatingToken}
                      onClick={handleVerifyActiveToken}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs transition-all"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isValidatingToken ? 'animate-spin' : ''}`} />
                      <span>{isValidatingToken ? 'Querying Google Servers...' : 'Validate Active Session Token'}</span>
                    </button>

                    {tokenValidationInfo && (
                      <div className="p-4 bg-emerald-50/50 border border-emerald-150 rounded-xl space-y-3">
                        <div className="flex items-center gap-2 text-emerald-800">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span className="text-xs font-black">Google Token Audited successfully!</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-medium text-slate-600">
                          <div className="space-y-1">
                            <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">Remaining Lifespan:</span>
                            <span className="font-bold text-slate-700">{Math.floor(parseInt(tokenValidationInfo.expires_in, 10) / 60)} minutes left</span>
                            <span className="text-[10px] text-slate-400 font-mono block">({tokenValidationInfo.expires_in} seconds remaining)</span>
                          </div>
                          <div className="space-y-1">
                            <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">Client Identity (Audience):</span>
                            <span className="font-mono text-[10px] text-slate-700 truncate block" title={tokenValidationInfo.audience}>
                              {tokenValidationInfo.audience?.slice(0, 24)}...
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1.5 pt-1.5 border-t border-emerald-150/40">
                          <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">Authorized Scopes & Permissions:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {tokenValidationInfo.scope?.split(' ').map((sc: string, sIdx: number) => {
                              let niceName = sc.replace('https://www.googleapis.com/auth/', '');
                              return (
                                <span key={sIdx} className="px-2 py-0.5 text-[9px] font-bold text-slate-600 bg-white border border-slate-200 rounded font-mono" title={sc}>
                                  {niceName}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {tokenValidationError && (
                      <div className="p-3 bg-rose-50 border border-rose-150 rounded-xl flex gap-2.5 text-xs text-rose-800">
                        <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-black">Validation Rejected:</span>
                          <p className="text-[10px] text-rose-600 mt-0.5 font-mono">{tokenValidationError}</p>
                          <p className="text-[10px] text-rose-400 mt-1">This token might be expired, or your custom Google Client ID configured in tab 1 may be mismatched.</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Multi-Account Linked Directory */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4.5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-600" />
                    <h3 className="font-extrabold text-xs text-slate-700 uppercase tracking-wider font-display">Linked Google Workspace Accounts</h3>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed font-medium">
                    Maintain multiple authenticated Google sessions simultaneously. Seamlessly hot-swap primary active channels to cross-reference multiple task logs or notebooks.
                  </p>

                  <div className="space-y-2.5">
                    {linkedAccounts.length === 0 ? (
                      <div className="p-4 bg-slate-50 border border-slate-150/60 rounded-xl text-center">
                        <p className="text-xs text-slate-400 italic font-medium">No secondary connected accounts found.</p>
                      </div>
                    ) : (
                      linkedAccounts.map((account, index) => {
                        const isActive = user?.email === account.email;
                        const testResult = accountTestResults[account.email];
                        const isTesting = testingAccountEmail === account.email;

                        return (
                          <div key={account.email || index} className="p-3.5 bg-slate-50 border border-slate-150/60 rounded-xl space-y-2.5 transition-all">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <div className="flex items-center gap-2.5 min-w-0">
                                {account.photoURL ? (
                                  <img 
                                    src={account.photoURL} 
                                    alt={account.displayName} 
                                    className="w-7 h-7 rounded-full border border-slate-200"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <div className="p-1.5 bg-slate-200 text-slate-600 rounded-full">
                                    <User className="w-4 h-4" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <h4 className="text-xs font-bold text-slate-700 truncate font-display leading-tight">{account.displayName}</h4>
                                  <span className="text-[9px] font-mono text-slate-400 block truncate">{account.email}</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5">
                                {isActive ? (
                                  <span className="px-2 py-0.5 text-[9px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 rounded">
                                    Primary Active
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleSwitchActiveAccount(account)}
                                    className="px-2 py-0.5 text-[9px] font-black text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 rounded cursor-pointer transition-all"
                                  >
                                    Switch Session
                                  </button>
                                )}

                                <button
                                  type="button"
                                  disabled={isTesting}
                                  onClick={() => handleTestAccountToken(account.email, account.accessToken)}
                                  className="px-2 py-0.5 text-[9px] font-bold text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded cursor-pointer transition-all"
                                >
                                  {isTesting ? 'Testing...' : 'Test Connection'}
                                </button>

                                {onUnlinkAccount && (
                                  <button
                                    type="button"
                                    onClick={() => onUnlinkAccount(account.email)}
                                    className="p-1 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded cursor-pointer transition-all"
                                    title="Disconnect this account"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Inline Connection Test Status */}
                            {testResult && (
                              <div className={`p-2 rounded-lg text-[10px] font-medium border ${
                                testResult.success 
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-150' 
                                  : 'bg-rose-50 text-rose-800 border-rose-150'
                              }`}>
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-1.5 h-1.5 rounded-full ${testResult.success ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                  <span className="font-mono">{testResult.message}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}

                    {onLinkNewAccount && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          setTimeout(() => {
                            onLinkNewAccount();
                          }, 200);
                        }}
                        className="w-full text-center text-xs font-bold py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5 text-slate-500" />
                        <span>Link Additional Google Session</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Smart Category-Based Account Routing */}
                {linkedAccounts.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-4.5 space-y-4">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-emerald-600" />
                      <h3 className="font-extrabold text-xs text-slate-700 uppercase tracking-wider font-display">Smart Category-Based Account Routing</h3>
                    </div>

                    <p className="text-xs text-slate-500 leading-relaxed font-medium">
                      Automatically route Google Tasks exports to specific connected accounts depending on the video's classified study category. Mapped categories export directly to their assigned accounts.
                    </p>

                    <div className="border border-slate-150 rounded-xl overflow-hidden divide-y divide-slate-150 bg-white">
                      {[
                        'AI & Data Science',
                        'Technology & Development',
                        'Productivity & Design',
                        'Business & Finance',
                        'Science & Education',
                        'Entertainment',
                        'Lifestyle & Health'
                      ].map((category) => {
                        const mappedEmail = (settings.categoryAccountMap || {})[category] || '';
                        return (
                          <div key={category} className="flex items-center justify-between p-3 gap-4 flex-wrap">
                            <span className="text-xs font-bold text-slate-700 font-display">{category}</span>
                            <select
                              value={mappedEmail}
                              onChange={(e) => handleMapCategoryToAccount(category, e.target.value)}
                              className="text-xs font-semibold p-1.5 border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 outline-none max-w-xs cursor-pointer focus:border-brand-ink"
                            >
                              <option value="">Default (First Linked / Active Account)</option>
                              {linkedAccounts.map((acc) => (
                                <option key={acc.email} value={acc.email}>
                                  {acc.displayName} ({acc.email})
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Developer Command Station Manual Token Paste Override */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4.5 space-y-4 text-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-slate-800 text-indigo-400 rounded-xl border border-slate-700">
                      <Terminal className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-xs text-slate-200 uppercase tracking-wider font-display">Developer Token Command Station</h3>
                      <p className="text-[10px] text-slate-400 font-medium">Inject temporary or OAuth playground tokens directly</p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed font-medium">
                    Are you developing under restrictive iframe sandbox constraints or using a secure temporary developer access key? Paste any pre-authorized OAuth token below to establish immediate sync sessions!
                  </p>

                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider font-display">Paste Pre-Authorized Access Token:</label>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          placeholder="ya29.a0Acvmd..."
                          value={manualTokenInput}
                          onChange={(e) => setManualTokenInput(e.target.value)}
                          className="flex-1 px-3 py-2 bg-slate-850 border border-slate-800 rounded-xl text-xs outline-hidden text-slate-200 font-mono focus:border-slate-700 placeholder-slate-600"
                        />
                        <button
                          type="button"
                          onClick={handleApplyManualToken}
                          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-all cursor-pointer shadow-xs"
                        >
                          Apply Override
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
            <span className="text-[10px] text-slate-400 font-medium">Configured settings store locally and persist automatically.</span>
            <button
              onClick={onClose}
              className="text-xs font-black px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition-all cursor-pointer shadow-2xs"
            >
              Done & Save
            </button>
          </div>

        </div>
      )}

    </div>
  );
}
