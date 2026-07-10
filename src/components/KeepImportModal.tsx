import React, { useState, useRef } from 'react';
import { X, FileJson, Link, Check, Loader2, Play, Square, AlertCircle, CheckCircle2, HelpCircle, Info, RefreshCw } from 'lucide-react';
import { VideoItem } from '../types';
import { generateSummary } from '../lib/gemini';

interface KeepImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingVideos: VideoItem[];
  onImportComplete: (newVideos: VideoItem[]) => void;
  appSettings: any;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

interface ExtractedLinkItem {
  id: string;
  url: string;
  noteTitle: string;
  isDuplicate: boolean;
  selected: boolean;
  status: 'pending' | 'processing' | 'success' | 'failed';
  error?: string;
}

export default function KeepImportModal({
  isOpen,
  onClose,
  existingVideos,
  onImportComplete,
  appSettings,
  showToast
}: KeepImportModalProps) {
  const [dragActive, setDragActive] = useState(false);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [extractedLinks, setExtractedLinks] = useState<ExtractedLinkItem[]>([]);
  const [importTier, setImportTier] = useState<'lite' | 'deep'>('lite');
  const [isImporting, setIsImporting] = useState(false);
  const [currentImportIndex, setCurrentImportIndex] = useState(-1);
  const importStopRequested = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const extractUrlsFromText = (text: string): string[] => {
    const urlRegex = /(https?:\/\/[^\s\n\r"']+)/gi;
    const matches = text.match(urlRegex);
    return matches ? Array.from(new Set(matches)) : [];
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processKeepFiles = async (files: FileList) => {
    setIsProcessingFiles(true);
    const linkItemsMap: Record<string, ExtractedLinkItem> = {};

    const readFileAsText = (file: File): Promise<string> => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve((e.target?.result as string) || '');
        reader.onerror = () => resolve('');
        reader.readAsText(file);
      });
    };

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
        continue;
      }

      const content = await readFileAsText(file);
      try {
        const json = JSON.parse(content);
        const text = [json.title, json.textContent].filter(Boolean).join('\n');
        const urls = extractUrlsFromText(text);

        urls.forEach(url => {
          // Normalize URL (strip trailing slash or hash slightly if needed, but simple string match is safest)
          const isDup = existingVideos.some(v => v.url === url);
          if (!linkItemsMap[url]) {
            linkItemsMap[url] = {
              id: `${url}-${Date.now()}-${Math.random()}`,
              url,
              noteTitle: json.title || 'Untitled Note',
              isDuplicate: isDup,
              selected: !isDup, // auto-select only non-duplicates
              status: 'pending'
            };
          }
        });
      } catch (err) {
        console.warn("Failed to parse JSON file", file.name, err);
      }
    }

    const items = Object.values(linkItemsMap);
    setExtractedLinks(items);
    setIsProcessingFiles(false);
    
    if (items.length === 0) {
      showToast("No academic resource URLs extracted from the selected Keep files.", "info");
    } else {
      showToast(`Successfully scanned Keep notes! Found ${items.length} unique resource links.`, "success");
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processKeepFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processKeepFiles(e.target.files);
    }
  };

  const handleToggleSelect = (id: string) => {
    setExtractedLinks(prev => prev.map(item => 
      item.id === id ? { ...item, selected: !item.selected } : item
    ));
  };

  const handleSelectAll = (select: boolean) => {
    setExtractedLinks(prev => prev.map(item => {
      if (item.isDuplicate) return { ...item, selected: false }; // Keep duplicates unselected
      return { ...item, selected: select };
    }));
  };

  // Run bulk import one resource at a time
  const startBulkImport = async () => {
    const selectedItems = extractedLinks.filter(item => item.selected && item.status !== 'success');
    if (selectedItems.length === 0) {
      showToast("Please select at least one pending resource link to import.", "info");
      return;
    }

    setIsImporting(true);
    importStopRequested.current = false;
    const newlyCurated: VideoItem[] = [];

    // Reset status of pending/failed items in selection
    setExtractedLinks(prev => prev.map(item => 
      item.selected && item.status !== 'success' ? { ...item, status: 'pending', error: undefined } : item
    ));

    for (let i = 0; i < extractedLinks.length; i++) {
      if (importStopRequested.current) {
        showToast("Bulk import paused/halted by user.", "info");
        break;
      }

      const item = extractedLinks[i];
      if (!item.selected || item.status === 'success') continue;

      setCurrentImportIndex(i);
      setExtractedLinks(prev => prev.map((it, idx) => 
        idx === i ? { ...it, status: 'processing' } : it
      ));

      try {
        const curatedData = await generateSummary(item.url, appSettings, importTier === 'lite');
        const finalVideo: VideoItem = {
          ...curatedData,
          id: curatedData.videoId || `bulk-${Date.now()}-${Math.random()}`,
          createdAt: new Date().toISOString(),
          watchedStatus: 'To Watch' // default Kanban column
        };

        newlyCurated.push(finalVideo);

        setExtractedLinks(prev => prev.map((it, idx) => 
          idx === i ? { ...it, status: 'success' } : it
        ));
      } catch (err: any) {
        console.error("Bulk item fail", item.url, err);
        setExtractedLinks(prev => prev.map((it, idx) => 
          idx === i ? { ...it, status: 'failed', error: err.message || "Analysis failed" } : it
        ));
      }

      // Small pause between sequential requests to prevent triggering extreme rate limits
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    setIsImporting(false);
    setCurrentImportIndex(-1);

    if (newlyCurated.length > 0) {
      onImportComplete(newlyCurated);
      showToast(`Successfully imported and curated ${newlyCurated.length} new academic resources!`, "success");
    }
  };

  const handleStopImport = () => {
    importStopRequested.current = true;
  };

  const pendingCount = extractedLinks.filter(it => it.selected && it.status === 'pending').length;
  const successCount = extractedLinks.filter(it => it.status === 'success').length;
  const failedCount = extractedLinks.filter(it => it.status === 'failed').length;
  const totalSelected = extractedLinks.filter(it => it.selected).length;

  return (
    <div className="fixed inset-0 bg-brand-ink/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in select-none">
      <div className="bg-brand-paper border-2 border-brand-ink rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-scale-in">
        
        {/* Header */}
        <div className="p-5 border-b-2 border-brand-ink bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand-ink text-brand-paper rounded-xl">
              <FileJson className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider font-display text-brand-ink">
                Google Keep Takeout Importer
              </h3>
              <p className="text-[10px] text-slate-500 font-semibold">Bulk-extract resource links from exported Keep JSON cards</p>
            </div>
          </div>
          <button 
            disabled={isImporting}
            onClick={onClose} 
            className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-brand-ink hover:border-brand-ink transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Inner Content scroll area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Step 1: Upload and parse */}
          {extractedLinks.length === 0 && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex items-start gap-3">
                <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <h4 className="font-bold text-slate-700">How to get your Keep Takeout export?</h4>
                  <p className="text-slate-500 leading-relaxed font-semibold">
                    1. Go to <a href="https://takeout.google.com" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline font-extrabold hover:text-indigo-800">Google Takeout</a>. <br />
                    2. Deselect all, check <strong className="text-slate-700">Keep</strong>, and request export. <br />
                    3. Download the ZIP, extract it, and drop or select the individual <strong className="text-slate-700">.json</strong> files here!
                  </p>
                </div>
              </div>

              {/* Drag Zone */}
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-10 text-center flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
                  dragActive 
                    ? 'border-brand-red bg-amber-500/5' 
                    : 'border-slate-300 bg-white hover:border-brand-ink'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".json,application/json"
                  onChange={handleFileChange}
                  className="hidden"
                />
                
                {isProcessingFiles ? (
                  <>
                    <RefreshCw className="w-10 h-10 text-brand-red animate-spin" />
                    <p className="text-xs font-black text-brand-ink">Scrutinizing Keep cards...</p>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center text-amber-500 border border-amber-100">
                      <FileJson className="w-6 h-6" />
                    </div>
                    <div className="space-y-1 max-w-xs">
                      <p className="text-xs font-black text-brand-ink">Drag & Drop Keep JSON files</p>
                      <p className="text-[10px] text-slate-500 leading-relaxed">Multi-select the files from your Takeout folder, or click to browse</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Extracted links & batch controls */}
          {extractedLinks.length > 0 && (
            <div className="space-y-5">
              
              {/* Batch Configuration */}
              <div className="bg-white border-2 border-brand-ink rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                  <h4 className="text-xs font-black text-brand-ink uppercase tracking-wide">Select Curation Tier</h4>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      disabled={isImporting}
                      onClick={() => setImportTier('lite')}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                        importTier === 'lite'
                          ? 'border-brand-red bg-amber-50/40 ring-1 ring-brand-red text-brand-ink'
                          : 'border-slate-200 hover:border-slate-300 text-slate-600'
                      }`}
                    >
                      <span className="text-[11px] font-black uppercase tracking-wider flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-brand-red rounded-full"></span>
                        Lite Import Pass
                      </span>
                      <span className="text-[9px] text-slate-400 mt-1 font-semibold">Fast titles, 1-paragraph summaries. Uses 70% fewer tokens.</span>
                    </button>

                    <button
                      type="button"
                      disabled={isImporting}
                      onClick={() => setImportTier('deep')}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                        importTier === 'deep'
                          ? 'border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-600 text-indigo-950'
                          : 'border-slate-200 hover:border-slate-300 text-slate-600'
                      }`}
                    >
                      <span className="text-[11px] font-black uppercase tracking-wider flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full"></span>
                        Deep Curation
                      </span>
                      <span className="text-[9px] text-slate-400 mt-1 font-semibold">Exhaustive multi-paragraph summaries and scholarly deep insights.</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Progress Bar & Logs */}
              {isImporting && (
                <div className="bg-brand-ink text-brand-paper rounded-2xl p-4.5 space-y-3.5 animate-slide-in">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold uppercase tracking-widest flex items-center gap-1.5 text-brand-paper">
                      <Loader2 className="w-4 h-4 animate-spin text-brand-red" />
                      Active Curation Queue
                    </span>
                    <span className="font-mono text-[11px] text-slate-400">
                      Progress: {successCount + failedCount} / {totalSelected}
                    </span>
                  </div>

                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-brand-red transition-all duration-300"
                      style={{ width: `${totalSelected > 0 ? ((successCount + failedCount) / totalSelected) * 100 : 0}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-[10px] uppercase font-black text-slate-400">
                      <span className="text-emerald-400">Success: {successCount}</span>
                      <span className="text-rose-400">Failed: {failedCount}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleStopImport}
                      className="bg-brand-red hover:bg-red-700 text-white font-black text-[9px] uppercase tracking-wider px-3 py-1 rounded-lg cursor-pointer transition-colors"
                    >
                      Halt Import
                    </button>
                  </div>
                </div>
              )}

              {/* Actions Header Row */}
              <div className="flex items-center justify-between flex-wrap gap-2 pt-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isImporting}
                    onClick={() => handleSelectAll(true)}
                    className="text-[10px] font-black uppercase text-brand-ink bg-white border border-slate-200 px-2 py-1 rounded-lg hover:border-brand-ink disabled:opacity-50 cursor-pointer"
                  >
                    Select All non-dups
                  </button>
                  <button
                    type="button"
                    disabled={isImporting}
                    onClick={() => handleSelectAll(false)}
                    className="text-[10px] font-black uppercase text-brand-ink bg-white border border-slate-200 px-2 py-1 rounded-lg hover:border-brand-ink disabled:opacity-50 cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>

                <span className="text-[10px] font-bold text-slate-500 font-mono">
                  {totalSelected} of {extractedLinks.length} Links Queued
                </span>
              </div>

              {/* Checklist list */}
              <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1 border border-slate-200 rounded-2xl p-2 bg-white select-text">
                {extractedLinks.map((item, idx) => {
                  const isDup = item.isDuplicate;
                  const isCurating = idx === currentImportIndex;
                  return (
                    <div 
                      key={item.id}
                      className={`flex items-start gap-3 p-2.5 rounded-xl border text-xs transition-all ${
                        isCurating 
                          ? 'bg-amber-500/10 border-brand-red ring-1 ring-brand-red' 
                          : isDup 
                            ? 'bg-slate-50 border-slate-200 opacity-60' 
                            : 'bg-white border-slate-100 hover:border-slate-300'
                      }`}
                    >
                      <button
                        type="button"
                        disabled={isDup || isImporting}
                        onClick={() => handleToggleSelect(item.id)}
                        className={`mt-0.5 shrink-0 rounded transition-all cursor-pointer ${
                          isDup 
                            ? 'text-slate-300' 
                            : item.selected 
                              ? 'text-brand-red' 
                              : 'text-slate-400 hover:text-brand-ink'
                        }`}
                      >
                        {item.selected ? (
                          <div className="w-4 h-4 bg-brand-red text-white flex items-center justify-center rounded">
                            <Check className="w-3 h-3 stroke-[4]" />
                          </div>
                        ) : (
                          <div className="w-4 h-4 border border-slate-300 rounded bg-white" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-black text-slate-400 truncate max-w-[200px]">
                            📁 From note: "{item.noteTitle}"
                          </span>
                          {isDup ? (
                            <span className="text-[9px] font-black uppercase text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                              Already Curated
                            </span>
                          ) : item.status === 'success' ? (
                            <span className="text-[9px] font-black uppercase text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Curated
                            </span>
                          ) : item.status === 'failed' ? (
                            <span className="text-[9px] font-black uppercase text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded flex items-center gap-0.5" title={item.error}>
                              <AlertCircle className="w-2.5 h-2.5" /> Error
                            </span>
                          ) : isCurating ? (
                            <span className="text-[9px] font-black uppercase text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded flex items-center gap-1 animate-pulse">
                              <Loader2 className="w-2.5 h-2.5 animate-spin" /> Analyzing...
                            </span>
                          ) : (
                            <span className="text-[9px] font-black uppercase text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                              Queued
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 text-slate-700 select-all font-mono font-bold text-[11px] truncate">
                          <Link className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{item.url}</span>
                        </div>

                        {item.error && (
                          <p className="text-[10px] text-rose-600 font-semibold leading-relaxed">
                            ⚠️ {item.error}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reset Upload state */}
              {!isImporting && (
                <button
                  type="button"
                  onClick={() => setExtractedLinks([])}
                  className="text-xs font-black text-slate-500 hover:text-brand-red block underline cursor-pointer"
                >
                  Clear and start over with different Keep Takeout files
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer controls */}
        <div className="p-5 border-t-2 border-brand-ink bg-white flex items-center justify-between flex-wrap gap-3">
          <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Files are fully parsed inside your browser sandbox.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isImporting}
              onClick={onClose}
              className="bg-white border-2 border-slate-300 text-slate-700 font-extrabold text-xs uppercase px-4 py-2 rounded-xl hover:border-brand-ink hover:text-brand-ink transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            {extractedLinks.length > 0 && (
              <button
                type="button"
                disabled={isImporting || totalSelected === 0}
                onClick={startBulkImport}
                className="bg-brand-red border-2 border-brand-ink hover:bg-red-700 text-white font-extrabold text-xs uppercase px-5 py-2 rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Run Curation Queue</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
