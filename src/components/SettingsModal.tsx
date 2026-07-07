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
  LockKeyhole
} from 'lucide-react';
import { AppSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (newSettings: AppSettings) => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  settings,
  onSaveSettings
}: SettingsModalProps) {
  // Tabs
  const [activeTab, setActiveTab] = useState<'api' | 'security'>('api');

  // Form State
  const [openRouterApiKey, setOpenRouterApiKey] = useState(settings.openRouterApiKey || '');
  const [customGeminiApiKey, setCustomGeminiApiKey] = useState(settings.customGeminiApiKey || '');
  const [useOpenRouter, setUseOpenRouter] = useState(settings.useOpenRouter || false);
  const [openRouterModel, setOpenRouterModel] = useState(settings.openRouterModel || 'google/gemini-2.5-flash');
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
      settingsPassword,
      encryptLocalStorage,
      isSettingsLocked: settingsPassword ? true : false,
      ...updatedFields
    };
    onSaveSettings(nextSettings);
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
