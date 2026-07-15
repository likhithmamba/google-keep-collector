import React, { useMemo } from 'react';
import { VideoItem } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area 
} from 'recharts';
import { Award, Brain, BookOpen, Clock, CheckCircle, GraduationCap, FileText, Sparkles, Folder } from 'lucide-react';

interface StudyDashboardProps {
  videos: VideoItem[];
  projectsCount: number;
}

export default function StudyDashboard({ videos, projectsCount }: StudyDashboardProps) {
  const now = useMemo(() => new Date(), []);

  // 1. Core Analytics Metrics
  const metrics = useMemo(() => {
    const total = videos.length;
    const completed = videos.filter(v => v.watchedStatus === 'Done').length;
    const watching = videos.filter(v => v.watchedStatus === 'Watching').length;
    const toWatch = videos.filter(v => v.watchedStatus === 'To Watch' || !v.watchedStatus).length;
    
    const notesChars = videos.reduce((sum, v) => sum + (v.studyNotes?.length || 0), 0);
    
    // Cards due today
    const dueCount = videos.filter(v => {
      if (!v.leitnerBox || v.leitnerBox === 0) return false;
      if (!v.nextReviewDate) return true;
      return new Date(v.nextReviewDate) <= now;
    }).reduce((sum, v) => sum + (v.takeaways?.length || 0), 0);

    return { total, completed, watching, toWatch, notesChars, dueCount };
  }, [videos, now]);

  // 2. Category Distribution Bar Chart Data
  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {};
    videos.forEach(v => {
      const cat = v.category || 'General';
      counts[cat] = (counts[cat] || 0) + 1;
    });

    return Object.entries(counts).map(([name, value]) => ({
      name: name.split('&')[0].trim(), // shorten name for charts
      value
    })).sort((a, b) => b.value - a.value);
  }, [videos]);

  // 3. Study Status Pie Chart Data
  const statusData = useMemo(() => {
    return [
      { name: 'Completed', value: metrics.completed, color: '#0f172a' }, // Slate-900 (brand ink)
      { name: 'Studying', value: metrics.watching, color: '#475569' },  // Slate-600
      { name: 'In Queue', value: metrics.toWatch, color: '#94a3b8' }   // Slate-400
    ].filter(item => item.value > 0);
  }, [metrics]);

  // 4. Monthly Curation Activity Area Chart Data
  const activityData = useMemo(() => {
    const dailyMap: Record<string, number> = {};
    
    // Sort videos by date
    const sorted = [...videos].sort((a, b) => {
      return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    });

    sorted.forEach(v => {
      const dateStr = v.createdAt 
        ? new Date(v.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : 'N/A';
      dailyMap[dateStr] = (dailyMap[dateStr] || 0) + 1;
    });

    let cumulative = 0;
    return Object.entries(dailyMap).map(([date, count]) => {
      cumulative += count;
      return {
        date,
        count,
        cumulative
      };
    });
  }, [videos]);

  // 5. Cognitive Synthesis Health Check & Grade
  const synthesisReport = useMemo(() => {
    const { total, completed, notesChars, dueCount } = metrics;
    
    let score = 0;
    if (total > 0) {
      score += (completed / total) * 40; // up to 40 points for completions
      score += Math.min((notesChars / (total * 200)) * 40, 40); // up to 40 points for notes quality (aiming for ~200 chars avg)
      score += Math.min((projectsCount * 10), 20); // up to 20 points for project structures
    }

    let grade = 'D';
    let label = 'Establishing Curation Foundations';
    let color = 'text-slate-500 bg-slate-50 border-slate-200';
    
    if (score >= 85) {
      grade = 'A';
      label = 'Elite Synthesizer';
      color = 'text-slate-900 bg-slate-50 border-slate-900';
    } else if (score >= 65) {
      grade = 'B';
      label = 'Advanced Researcher';
      color = 'text-slate-700 bg-slate-100 border-slate-300';
    } else if (score >= 40) {
      grade = 'C';
      label = 'Active Practitioner';
      color = 'text-slate-600 bg-slate-50 border-slate-200';
    }

    const suggestions: string[] = [];
    if (dueCount > 0) {
      suggestions.push(`You have ${dueCount} flashcard concepts due today inside the Leitner Arena. Run a study session now to keep your memory consolidated.`);
    }
    if (total > 0 && notesChars === 0) {
      suggestions.push("Write some annotations or session notes for your videos. Taking personalized notes helps lock in concepts.");
    }
    if (projectsCount === 0 && total >= 3) {
      suggestions.push("Create a research Project Workspace to group related video materials together and track progress systematically.");
    }
    if (total === 0) {
      suggestions.push("Add your first learning video curation from YouTube or import your notes to activate your cognitive console.");
    }

    if (suggestions.length === 0) {
      suggestions.push("Everything is optimally organized! Keep curating high-quality materials and expanding your knowledge workspace.");
    }

    return { grade, label, color, suggestions, score: Math.round(score) };
  }, [metrics, projectsCount]);

  return (
    <div className="space-y-6">
      
      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white border border-slate-200 rounded-2xl p-4.5 text-left flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Total Curations</span>
            <span className="text-2xl font-black text-brand-ink block">{metrics.total}</span>
            <span className="text-[9px] text-slate-400 font-semibold">academic entries</span>
          </div>
          <div className="p-2 bg-slate-50 rounded-xl border border-slate-150 text-slate-500">
            <BookOpen className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4.5 text-left flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Completions</span>
            <span className="text-2xl font-black text-brand-ink block">{metrics.completed}</span>
            <span className="text-[9px] text-slate-400 font-semibold">{metrics.total > 0 ? Math.round((metrics.completed / metrics.total) * 100) : 0}% success rate</span>
          </div>
          <div className="p-2 bg-slate-50 rounded-xl border border-slate-150 text-slate-500">
            <CheckCircle className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4.5 text-left flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Drafted Notes</span>
            <span className="text-2xl font-black text-brand-ink block">{metrics.notesChars.toLocaleString()}</span>
            <span className="text-[9px] text-slate-400 font-semibold">written characters</span>
          </div>
          <div className="p-2 bg-slate-50 rounded-xl border border-slate-150 text-slate-500">
            <FileText className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4.5 text-left flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Due Reviews</span>
            <span className="text-2xl font-black text-brand-ink block">{metrics.dueCount}</span>
            <span className="text-[9px] text-slate-400 font-semibold">cards in Leitner queue</span>
          </div>
          <div className="p-2 bg-slate-50 rounded-xl border border-slate-150 text-slate-500">
            <GraduationCap className="w-4 h-4" />
          </div>
        </div>

      </div>

      {/* Charts Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Category distribution chart */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-5 space-y-4">
          <div>
            <h3 className="text-xs font-black text-brand-ink uppercase tracking-wider font-display flex items-center gap-1.5">
              <Brain className="w-4.5 h-4.5" />
              <span>Categorical Specialization</span>
            </h3>
            <p className="text-[10px] text-slate-400 font-medium">Topic distributions of your active study index</p>
          </div>

          <div className="h-64">
            {categoryData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs italic">
                No topic data to graph yet. Add curations to see category analytics.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#64748b" fontSize={9} fontWeight="bold" tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={9} fontWeight="bold" tickLine={false} />
                  <Tooltip 
                    contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '12px', color: '#f8fafc', fontSize: '11px' }}
                    cursor={{ fill: 'rgba(15, 23, 42, 0.04)' }}
                  />
                  <Bar dataKey="value" fill="#0f172a" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Status Distribution Pie */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4">
          <div>
            <h3 className="text-xs font-black text-brand-ink uppercase tracking-wider font-display flex items-center gap-1.5">
              <Clock className="w-4.5 h-4.5" />
              <span>Curation Workflow State</span>
            </h3>
            <p className="text-[10px] text-slate-400 font-medium">Current study progression breakdown</p>
          </div>

          <div className="h-64 flex flex-col justify-between items-center">
            {statusData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs italic">
                No active curation progression.
              </div>
            ) : (
              <>
                <div className="w-full h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '12px', color: '#f8fafc', fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex justify-center gap-4 flex-wrap text-[9px] font-black uppercase text-slate-500">
                  {statusData.map((item, index) => (
                    <div key={index} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span>{item.name}: {item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

      </div>

      {/* Third row split - Activity Timeline and Cognitive Health report */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Activity Timeline Area Chart */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-5 space-y-4">
          <div>
            <h3 className="text-xs font-black text-brand-ink uppercase tracking-wider font-display flex items-center gap-1.5">
              <Sparkles className="w-4.5 h-4.5" />
              <span>Curation Growth Trajectory</span>
            </h3>
            <p className="text-[10px] text-slate-400 font-medium">Cumulative growth of your scholarship bookshelf</p>
          </div>

          <div className="h-56">
            {activityData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs italic">
                No timeline records established yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activityData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <XAxis dataKey="date" stroke="#64748b" fontSize={9} fontWeight="bold" tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={9} fontWeight="bold" tickLine={false} />
                  <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '12px', color: '#f8fafc', fontSize: '11px' }} />
                  <Area type="monotone" dataKey="cumulative" stroke="#0f172a" fill="rgba(15, 23, 42, 0.05)" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Synthesis Health Check */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-1.5">
            <h3 className="text-xs font-black text-brand-ink uppercase tracking-wider font-display flex items-center gap-1.5">
              <Award className="w-4.5 h-4.5" />
              <span>Cognitive Synthesis Health</span>
            </h3>
            <p className="text-[10px] text-slate-400 font-medium">Synthesis score and workspace calibration</p>
          </div>

          <div className="flex-1 flex flex-col justify-center space-y-4">
            
            {/* Big Grade Badge */}
            <div className="flex items-center gap-4.5 justify-center py-2">
              <div className={`w-16 h-16 border-2 rounded-2xl flex items-center justify-center text-2xl font-black font-display shadow-sm ${synthesisReport.color}`}>
                {synthesisReport.grade}
              </div>
              <div className="text-left space-y-0.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Workspace Level</span>
                <span className="text-xs font-black text-brand-ink uppercase block">{synthesisReport.label}</span>
                <span className="text-[9px] text-slate-400 font-mono block">Composite Score: {synthesisReport.score} / 100</span>
              </div>
            </div>

            {/* Structured suggestions list */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2.5 text-left">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                <Brain className="w-3 h-3 text-slate-500" /> Recommendations
              </span>
              <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                {synthesisReport.suggestions.map((suggestion, idx) => (
                  <p key={idx} className="text-[10px] leading-relaxed text-slate-600 font-semibold flex items-start gap-1.5">
                    <span className="text-brand-ink font-bold">&bull;</span>
                    <span>{suggestion}</span>
                  </p>
                ))}
              </div>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}
