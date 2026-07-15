import React, { useState, useRef } from 'react';
import { X, FileJson, Link, Check, Loader2, Play, Square, AlertCircle, CheckCircle2, HelpCircle, Info, RefreshCw, FileText, ClipboardList } from 'lucide-react';
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

type TabType = 'upload' | 'paste';

export default function KeepImportModal({
  isOpen,
  onClose,
  existingVideos,
  onImportComplete,
  appSettings,
  showToast
}: KeepImportModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('upload');
  const [dragActive, setDragActive] = useState(false);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [extractedLinks, setExtractedLinks] = useState<ExtractedLinkItem[]>([]);
  const [importTier, setImportTier] = useState<'lite' | 'deep'>('lite');
  const [isImporting, setIsImporting] = useState(false);
  const [currentImportIndex, setCurrentImportIndex] = useState(-1);
  const [rawPasteText, setRawPasteText] = useState('');
  
  const importStopRequested = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const extractUrlsFromText = (text: string): string[] => {
    const urlRegex = /(https?:\/\/[^\s\n\r"']+)/gi;
    const matches = text.match(urlRegex);
    return matches ? Array.from(new Set(matches)) : [];
  };

  const parseCsv = (csvText: string): string[] => {
    const urls: string[] = [];
    const lines = csvText.split(/\r?\n/);
    if (lines.length === 0) return [];
    
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const urlColIndex = headers.indexOf('url');
    
    if (urlColIndex !== -1) {
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const cols = lines[i].split(',');
        if (cols[urlColIndex]) {
          const urlVal = cols[urlColIndex].trim().replace(/^["']|["']$/g, '');
          if (urlVal.startsWith('http')) {
            urls.push(urlVal);
          }
        }
      }
    } else {
      lines.forEach(line => {
        const found = extractUrlsFromText(line);
        urls.push(...found);
      });
    }
    return Array.from(new Set(urls));
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

  const processImportFiles = async (files: FileList) => {
    setIsProcessingFiles(true);
    const linkItemsMap: Record<string, ExtractedLinkItem> = { ...extractedLinks.reduce((acc, item) => ({ ...acc, [item.url]: item }), {}) };

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
      const filenameLower = file.name.toLowerCase();
      const content = await readFileAsText(file);

      let urls: string[] = [];
      let sourceName = file.name;

      if (filenameLower.endsWith('.json')) {
        try {
          const json = JSON.parse(content);
          sourceName = json.title || file.name;
          const text = [json.title, json.textContent].filter(Boolean).join('\n');
          urls = extractUrlsFromText(text);
        } catch (err) {
          console.warn("Failed to parse JSON file", file.name, err);
        }
      } else if (filenameLower.endsWith('.csv')) {
        urls = parseCsv(content);
      } else if (filenameLower.endsWith('.txt')) {
        urls = extractUrlsFromText(content);
      } else {
        urls = extractUrlsFromText(content);
      }

      urls.forEach(url => {
        const isDup = existingVideos.some(v => v.url === url);
        if (!linkItemsMap[url]) {
          linkItemsMap[url] = {
            id: `${url}-${Date.now()}-${Math.random()}`,
            url,
            noteTitle: sourceName,
            isDuplicate: isDup,
            selected: !isDup,
            status: 'pending'
          };
        }
      });
    }

    const items = Object.values(linkItemsMap);
    setExtractedLinks(items);
    setIsProcessingFiles(false);
    
    if (items.length === 0) {
      showToast("No academic resource URLs extracted from the selected files.", "info");
    } else {
      showToast(`Scan complete. Found ${items.length} unique resource links.`, "success");
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processImportFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processImportFiles(e.target.files);
    }
  };

  const handleRawPasteExtract = () => {
    if (!rawPasteText.trim()) {
      showToast("Please enter or paste some text first.", "info");
      return;
    }

    const urls = extractUrlsFromText(rawPasteText);
    if (urls.length === 0) {
      showToast("No valid URLs found in the pasted text.", "error");
      return;
    }

    const linkItemsMap: Record<string, ExtractedLinkItem> = { ...extractedLinks.reduce((acc, item) => ({ ...acc, [item.url]: item }), {}) };
    let addedCount = 0;

    urls.forEach(url => {
      const isDup = existingVideos.some(v => v.url === url);
      if (!linkItemsMap[url]) {
        linkItemsMap[url] = {
          id: `${url}-${Date.now()}-${Math.random()}`,
          url,
          noteTitle: 'Pasted Raw Text',
          isDuplicate: isDup,
          selected: !isDup,
          status: 'pending'
        };
        addedCount++;
      }
    });

    setExtractedLinks(Object.values(linkItemsMap));
    setRawPasteText('');
    showToast(`Successfully extracted ${addedCount} new links from pasted text!`, "success");
  };

  const handleToggleSelect = (id: string) => {
    setExtractedLinks(prev => prev.map(item => 
      item.id === id ? { ...item, selected: !item.selected } : item
    ));
  };

  const handleSelectAll = (select: boolean) => {
    setExtractedLinks(prev => prev.map(item => {
      if (item.isDuplicate) return { ...item, selected: false };
      return { ...item, selected: select };
    }));
  };

  const startBulkImport = async () => {
    const selectedItems = extractedLinks.filter(item => item.selected && item.status !== 'success');
    if (selectedItems.length === 0) {
      showToast("Please select at least one pending resource link to import.", "info");
      return;
    }

    setIsImporting(true);
    importStopRequested.current = false;
    const newlyCurated: VideoItem[] = [];

    setExtractedLinks(prev => prev.map(item => 
      item.selected && item.status !== 'success' ? { ...item, status: 'pending', error: undefined } : item
    ));

    for (let i = 0; i < extractedLinks.length; i++) {
      if (importStopRequested.current) {
        showToast("Bulk import paused by user.", "info");
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
          watchedStatus: 'To Watch'
        };

        newlyCurated.push(finalVideo);

        setExtractedLinks(prev => prev.map((it, idx) => 
          idx === i ? { ...it, status: 'success' } : it
        ));
      } catch (err: any) {
        console.error("Bulk item curation error", item.url, err);
        setExtractedLinks(prev => prev.map((it, idx) => 
          idx === i ? { ...it, status: 'failed', error: err.message || "Analysis failed" } : it
        ));
      }

      await new Promise(resolve => setTimeout(resolve, 800));
    }

    setIsImporting(false);
    setCurrentImportIndex(-1);

    if (newlyCurated.length > 0) {
      onImportComplete(newlyCurated);
      showToast(`Successfully curated ${newlyCurated.length} new academic resources!`, "success");
    }
  };

  const handleStopImport = () => {
    importStopRequested.current = true;
  };

  const successCount = extractedLinks.filter(it => it.status === 'success').length;
  const failedCount = extractedLinks.filter(it => it.status === 'failed').length;
  const totalSelected = extractedLinks.filter(it => it.selected).length;

  return (
    <div className="fixed inset-0 bg-brand-ink/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-brand-paper border-2 border-brand-ink rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-scale-in">
        
        {/* Header */}
        <div className="p-5 border-b-2 border-brand-ink bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand-ink text-brand-paper rounded-xl">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider font-display text-brand-ink">
                Bulk Resource Importer
              </h3>
              <p className="text-[10px] text-slate-500 font-semibold">Extract and curate multiple links in bulk</p>
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

        {/* Tab Selection */}
        <div className="border-b border-slate-150 bg-slate-50 px-5 py-2 flex gap-4">
          <button
            type="button"
            disabled={isImporting}
            onClick={() => setActiveTab('upload')}
            className={`text-xs font-black uppercase tracking-wider py-2 px-1 border-b-2 transition-all cursor-pointer ${
              activeTab === 'upload'
                ? 'border-brand-ink text-brand-ink font-extrabold'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            File Upload (JSON, TXT, CSV)
          </button>
          <button
            type="button"
            disabled={isImporting}
            onClick={() => setActiveTab('paste')}
            className={`text-xs font-black uppercase tracking-wider py-2 px-1 border-b-2 transition-all cursor-pointer ${
              activeTab === 'paste'
                ? 'border-brand-ink text-brand-ink font-extrabold'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            Raw Text Paste
          </button>
        </div>

        {/* Scroll Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {extractedLinks.length === 0 && activeTab === 'upload' && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex items-start gap-3">
                <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <h4 className="font-bold text-slate-700">Supported Formats</h4>
                  <p className="text-slate-500 leading-relaxed font-semibold">
                    1. <strong>Google Keep JSON</strong>: Unzip your Keep Takeout folder and drop files directly.<br />
                    2. <strong>Text Notes (.txt)</strong>: Upload any plain text file containing links.<br />
                    3. <strong>CSV Files (.csv)</strong>: Upload standard CSV files. It will match rows containing URLs.
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
                    ? 'border-brand-ink bg-slate-50' 
                    : 'border-slate-300 bg-white hover:border-brand-ink'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".json,.txt,.csv,application/json,text/plain,text/csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                
                {isProcessingFiles ? (
                  <>
                    <RefreshCw className="w-10 h-10 text-brand-ink animate-spin" />
                    <p className="text-xs font-black text-brand-ink">Analyzing import files...</p>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-500 border border-slate-100">
                      <FileJson className="w-6 h-6" />
                    </div>
                    <div className="space-y-1 max-w-xs">
                      <p className="text-xs font-black text-brand-ink">Drag & Drop Import files</p>
                      <p className="text-[10px] text-slate-500 leading-relaxed">Select multiple Keep JSONs, TXT, or CSV files from your system</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {extractedLinks.length === 0 && activeTab === 'paste' && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex items-start gap-3">
                <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <h4 className="font-bold text-slate-700 font-display">Extract from Block of Text</h4>
                  <p className="text-slate-500 leading-relaxed font-semibold">
                    Paste any block of text containing learning material links. We will extract all unique URL instances automatically.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <textarea
                  rows={6}
                  value={rawPasteText}
                  onChange={(e) => setRawPasteText(e.target.value)}
                  placeholder="Paste raw notes, bookmarks, or reading lists here..."
                  className="w-full p-4 border-2 border-brand-ink rounded-2xl bg-white text-xs text-brand-ink font-mono focus:outline-none placeholder-slate-400"
                />
                <button
                  type="button"
                  onClick={handleRawPasteExtract}
                  className="w-full bg-brand-ink hover:bg-slate-800 text-brand-paper text-xs font-extrabold uppercase py-3 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <ClipboardList className="w-4 h-4" />
                  <span>Scan and Extract URLs</span>
                </button>
              </div>
            </div>
          )}

          {/* List display */}
          {extractedLinks.length > 0 && (
            <div className="space-y-5">
              
              {/* Curation Tier */}
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
                          ? 'border-brand-ink bg-slate-100 ring-1 ring-brand-ink text-brand-ink'
                          : 'border-slate-200 hover:border-slate-300 text-slate-600'
                      }`}
                    >
                      <span className="text-[11px] font-black uppercase tracking-wider flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-slate-900 rounded-full"></span>
                        Lite Import
                      </span>
                      <span className="text-[9px] text-slate-400 mt-1 font-semibold">Fast summaries and rapid tags. Uses 70% fewer tokens.</span>
                    </button>

                    <button
                      type="button"
                      disabled={isImporting}
                      onClick={() => setImportTier('deep')}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                        importTier === 'deep'
                          ? 'border-brand-ink bg-slate-100 ring-1 ring-brand-ink text-brand-ink'
                          : 'border-slate-200 hover:border-slate-300 text-slate-600'
                      }`}
                    >
                      <span className="text-[11px] font-black uppercase tracking-wider flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-brand-ink rounded-full"></span>
                        Deep Curation
                      </span>
                      <span className="text-[9px] text-slate-400 mt-1 font-semibold">Exhaustive multi-paragraph detailed analysis and deep takeaways.</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Progress Display */}
              {isImporting && (
                <div className="bg-brand-ink text-brand-paper rounded-2xl p-4.5 space-y-3.5 animate-slide-in">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold uppercase tracking-widest flex items-center gap-1.5 text-brand-paper">
                      <Loader2 className="w-4 h-4 animate-spin text-slate-300" />
                      Active Curation Queue
                    </span>
                    <span className="font-mono text-[11px] text-slate-400">
                      Progress: {successCount + failedCount} / {totalSelected}
                    </span>
                  </div>

                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-brand-paper transition-all duration-300"
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
                      className="bg-brand-paper hover:bg-slate-200 text-brand-ink font-black text-[9px] uppercase tracking-wider px-3 py-1 rounded-lg cursor-pointer transition-colors"
                    >
                      Halt Import
                    </button>
                  </div>
                </div>
              )}

              {/* Selection Controls */}
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

              {/* Items List */}
              <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1 border border-slate-200 rounded-2xl p-2 bg-white select-text">
                {extractedLinks.map((item, idx) => {
                  const isDup = item.isDuplicate;
                  const isCurating = idx === currentImportIndex;
                  return (
                    <div 
                      key={item.id}
                      className={`flex items-start gap-3 p-2.5 rounded-xl border text-xs transition-all ${
                        isCurating 
                          ? 'bg-slate-100 border-brand-ink ring-1 ring-brand-ink' 
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
                              ? 'text-brand-ink' 
                              : 'text-slate-400 hover:text-brand-ink'
                        }`}
                      >
                        {item.selected ? (
                          <div className="w-4 h-4 bg-brand-ink text-white flex items-center justify-center rounded">
                            <Check className="w-3 h-3 stroke-[4]" />
                          </div>
                        ) : (
                          <div className="w-4 h-4 border border-slate-300 rounded bg-white" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-black text-slate-400 truncate max-w-[200px]">
                            Source: "{item.noteTitle}"
                          </span>
                          {isDup ? (
                            <span className="text-[9px] font-black uppercase text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
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
                            <span className="text-[9px] font-black uppercase text-brand-ink bg-slate-100 px-1.5 py-0.5 rounded flex items-center gap-1 animate-pulse">
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
                            {item.error}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {!isImporting && (
                <button
                  type="button"
                  onClick={() => setExtractedLinks([])}
                  className="text-xs font-black text-slate-500 hover:text-brand-ink block underline cursor-pointer"
                >
                  Clear and start over
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t-2 border-brand-ink bg-white flex items-center justify-between flex-wrap gap-3">
          <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Files are parsed locally in browser sandbox.</span>
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
                className="bg-brand-ink border-2 border-brand-ink hover:bg-slate-800 text-brand-paper font-extrabold text-xs uppercase px-5 py-2 rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run Curation Queue</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
