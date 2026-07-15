import React, { useState } from 'react';
import { Project, VideoItem } from '../types';
import { FolderPlus, Folder, Trash2, Plus, X, GraduationCap, Clock, CheckCircle2, ChevronRight, BookOpen, AlertCircle, Sparkles } from 'lucide-react';

interface ProjectsPanelProps {
  projects: Project[];
  videos: VideoItem[];
  onCreateProject: (name: string, description?: string) => void;
  onUpdateProject: (project: Project) => void;
  onDeleteProject: (projectId: string) => void;
  onSelectVideo: (video: VideoItem) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function ProjectsPanel({
  projects,
  videos,
  onCreateProject,
  onUpdateProject,
  onDeleteProject,
  onSelectVideo,
  showToast
}: ProjectsPanelProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [showAddVideoDropdown, setShowAddVideoDropdown] = useState(false);

  const activeProject = projects.find(p => p.id === activeProjectId) || null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) {
      showToast("Project name is required.", "error");
      return;
    }
    onCreateProject(newProjectName.trim(), newProjectDesc.trim());
    setNewProjectName('');
    setNewProjectDesc('');
    setIsCreating(false);
    showToast(`Project "${newProjectName}" successfully established!`, "success");
  };

  const handleAddVideo = (videoId: string) => {
    if (!activeProject) return;
    if (activeProject.videoIds.includes(videoId)) {
      showToast("Video is already in this project.", "info");
      return;
    }
    const updated: Project = {
      ...activeProject,
      videoIds: [...activeProject.videoIds, videoId]
    };
    onUpdateProject(updated);
    setShowAddVideoDropdown(false);
    showToast("Academic resource linked to project workspace.", "success");
  };

  const handleRemoveVideo = (videoId: string) => {
    if (!activeProject) return;
    const updated: Project = {
      ...activeProject,
      videoIds: activeProject.videoIds.filter(id => id !== videoId)
    };
    onUpdateProject(updated);
    showToast("Linked resource unlinked from project.", "info");
  };

  // Calculate project completion stats
  const getProjectStats = (project: Project) => {
    const linkedVideos = videos.filter(v => project.videoIds.includes(v.id));
    const total = linkedVideos.length;
    if (total === 0) return { total, done: 0, watching: 0, toWatch: 0, percent: 0 };
    
    const done = linkedVideos.filter(v => v.watchedStatus === 'Done').length;
    const watching = linkedVideos.filter(v => v.watchedStatus === 'Watching').length;
    const toWatch = linkedVideos.filter(v => v.watchedStatus === 'To Watch' || !v.watchedStatus).length;
    const percent = Math.round((done / total) * 100);
    
    return { total, done, watching, toWatch, percent };
  };

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col h-full space-y-5">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-sm font-black text-brand-ink uppercase tracking-wider font-display flex items-center gap-1.5">
            <Folder className="w-5 h-5" />
            <span>Research Projects</span>
          </h2>
          <p className="text-[10px] text-slate-500 font-semibold">Group and monitor correlated video studies</p>
        </div>

        <button
          onClick={() => setIsCreating(true)}
          className="bg-brand-ink hover:bg-slate-800 text-brand-paper font-black text-[10px] uppercase tracking-wider py-1.5 px-3.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Project</span>
        </button>
      </div>

      {/* Creation form modal block inline */}
      {isCreating && (
        <form onSubmit={handleCreate} className="bg-brand-paper border-2 border-brand-ink rounded-2xl p-4.5 space-y-4 animate-slide-in">
          <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
            <h3 className="text-xs font-black text-brand-ink uppercase tracking-wide flex items-center gap-1">
              <FolderPlus className="w-4 h-4" />
              Establish Research Space
            </h3>
            <button 
              type="button" 
              onClick={() => setIsCreating(false)}
              className="p-1 text-slate-400 hover:text-brand-ink"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Project Name</label>
              <input
                type="text"
                required
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="e.g. Quantum Computing Foundations"
                className="w-full p-2 text-xs border border-slate-200 rounded-xl bg-white outline-none focus:border-brand-ink font-semibold"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Scope or Objective</label>
              <textarea
                value={newProjectDesc}
                onChange={(e) => setNewProjectDesc(e.target.value)}
                placeholder="Analyze quantum gate mechanics and algorithms..."
                className="w-full p-2 text-xs border border-slate-200 rounded-xl bg-white outline-none focus:border-brand-ink font-semibold"
                rows={2}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="bg-white border border-slate-200 text-slate-600 font-extrabold text-[10px] uppercase px-3 py-1.5 rounded-xl hover:border-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-brand-ink text-brand-paper font-extrabold text-[10px] uppercase px-4 py-1.5 rounded-xl hover:bg-slate-800 transition-all"
            >
              Initialize Space
            </button>
          </div>
        </form>
      )}

      {/* Main Workspace split */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-5 overflow-hidden">
        
        {/* Project List */}
        <div className="overflow-y-auto pr-1 space-y-3 max-h-[480px]">
          {projects.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 border border-slate-150/60 rounded-2xl">
              <Folder className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">No Active Projects</h3>
              <p className="text-[10px] text-slate-400 font-medium max-w-[200px] mx-auto mt-1 leading-relaxed">
                Establish Correlated Video Groupings to coordinate multiple studies into continuous learning tracks.
              </p>
            </div>
          ) : (
            projects.map(project => {
              const stats = getProjectStats(project);
              const isActive = activeProjectId === project.id;
              
              return (
                <div 
                  key={project.id}
                  onClick={() => setActiveProjectId(isActive ? null : project.id)}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer select-none text-left relative overflow-hidden group ${
                    isActive 
                      ? 'bg-slate-100 border-brand-ink ring-1 ring-brand-ink' 
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-start gap-3">
                      <h3 className="text-xs font-black text-brand-ink font-display uppercase tracking-wide truncate max-w-[180px]">
                        {project.name}
                      </h3>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Delete project "${project.name}"? Linked resources won't be deleted.`)) {
                            onDeleteProject(project.id);
                            if (activeProjectId === project.id) setActiveProjectId(null);
                          }
                        }}
                        className="text-slate-400 hover:text-rose-600 transition-colors opacity-0 group-hover:opacity-100 p-1"
                        title="Delete project workspace"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {project.description && (
                      <p className="text-[10px] text-slate-500 font-medium line-clamp-1">
                        {project.description}
                      </p>
                    )}

                    {/* Progress tracking */}
                    <div className="pt-2.5 space-y-1">
                      <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase tracking-wider">
                        <span>{stats.total} Linked Studies</span>
                        <span className="font-mono text-brand-ink">{stats.percent}% Done</span>
                      </div>
                      <div className="w-full bg-slate-200/50 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-brand-ink transition-all duration-300"
                          style={{ width: `${stats.percent}%` }}
                        />
                      </div>
                      
                      <div className="flex items-center gap-2.5 text-[8.5px] uppercase font-black text-slate-400 pt-0.5">
                        <span className="flex items-center gap-0.5"><GraduationCap className="w-3 h-3 text-brand-ink" /> {stats.done} Done</span>
                        <span className="flex items-center gap-0.5"><Clock className="w-3 h-3 text-slate-500" /> {stats.watching} Studying</span>
                        <span className="flex items-center gap-0.5"><BookOpen className="w-3 h-3 text-slate-300" /> {stats.toWatch} Queue</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Project Detail Board */}
        <div className="border border-slate-200 rounded-2xl p-4.5 bg-slate-50 flex flex-col justify-between max-h-[480px]">
          {activeProject ? (
            <div className="flex flex-col h-full justify-between space-y-4">
              
              {/* Active project header info */}
              <div className="space-y-1 text-left border-b border-slate-200/80 pb-3">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded uppercase">
                    Project Workspace
                  </span>
                  
                  {/* Add Video Button */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowAddVideoDropdown(!showAddVideoDropdown)}
                      className="bg-brand-ink hover:bg-slate-800 text-brand-paper text-[9px] font-black uppercase tracking-wider py-1 px-2 rounded-lg cursor-pointer transition-colors flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Link Study</span>
                    </button>

                    {showAddVideoDropdown && (
                      <div className="absolute right-0 mt-1.5 w-60 bg-white border-2 border-brand-ink rounded-xl shadow-xl z-20 py-1.5 max-h-48 overflow-y-auto">
                        <div className="px-2.5 py-1 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                          Select Unlinked Study
                        </div>
                        {videos.filter(v => !activeProject.videoIds.includes(v.id)).length === 0 ? (
                          <div className="px-3 py-2 text-[10px] text-slate-400 font-semibold italic text-center">
                            All indexed studies are linked.
                          </div>
                        ) : (
                          videos.filter(v => !activeProject.videoIds.includes(v.id)).map(video => (
                            <button
                              key={video.id}
                              type="button"
                              onClick={() => handleAddVideo(video.id)}
                              className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-[11px] font-extrabold truncate text-slate-700 block transition-colors border-b border-slate-50"
                            >
                              {video.title}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                </div>
                <h3 className="text-xs font-black text-brand-ink font-display uppercase tracking-wide mt-1.5 leading-tight">
                  {activeProject.name}
                </h3>
                {activeProject.description && (
                  <p className="text-[10px] text-slate-500 font-medium mt-0.5 leading-relaxed">
                    {activeProject.description}
                  </p>
                )}
              </div>

              {/* Linked Videos List */}
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 select-text">
                {activeProject.videoIds.length === 0 ? (
                  <div className="text-center py-10 text-slate-400">
                    <AlertCircle className="w-6 h-6 mx-auto mb-1.5" />
                    <p className="text-[10px] font-semibold max-w-[180px] mx-auto leading-normal">
                      No curated materials associated with this research space. Click <strong>Link Study</strong> above to associate academic videos.
                    </p>
                  </div>
                ) : (
                  videos
                    .filter(v => activeProject.videoIds.includes(v.id))
                    .map(video => (
                      <div 
                        key={video.id} 
                        className="bg-white p-2.5 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0 flex-1 text-left">
                          <button
                            type="button"
                            onClick={() => onSelectVideo(video)}
                            className="font-black text-brand-ink hover:underline truncate block leading-snug cursor-pointer"
                          >
                            {video.title}
                          </button>
                          <div className="flex items-center gap-2 mt-1 text-[9px] font-semibold text-slate-400">
                            <span>{video.channelTitle}</span>
                            <span>&bull;</span>
                            <span className={`font-black uppercase text-[8.5px] ${
                              video.watchedStatus === 'Done' 
                                ? 'text-emerald-600' 
                                : video.watchedStatus === 'Watching' 
                                  ? 'text-brand-ink' 
                                  : 'text-slate-400'
                            }`}>
                              {video.watchedStatus || 'To Watch'}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveVideo(video.id)}
                          className="p-1 text-slate-300 hover:text-rose-600 transition-all rounded-md"
                          title="Unlink from this project"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                )}
              </div>

            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-12">
              <Folder className="w-8 h-8 mb-2 text-slate-300" />
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Project Console</p>
              <p className="text-[9.5px] font-semibold text-slate-400 mt-1 max-w-[180px] leading-relaxed">
                Select a project on the left to review associate study progress, manage workspace tracks, or access material summaries.
              </p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
