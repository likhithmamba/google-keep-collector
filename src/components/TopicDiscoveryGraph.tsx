import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { 
  Network, 
  Sparkles, 
  Filter, 
  RotateCcw, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Search,
  BookOpen,
  Info,
  Layers,
  Sliders,
  HelpCircle
} from 'lucide-react';

interface VideoItem {
  id: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  url: string;
  summary: string;
  category: string;
  rating: number;
  ratingJustification: string;
  takeaways: string[];
  watchedStatus?: 'To Watch' | 'Watching' | 'Done';
}

interface TopicDiscoveryGraphProps {
  videos: VideoItem[];
  onSelectVideo: (video: VideoItem) => void;
  onSelectCategory: (category: string) => void;
  activeCategory: string;
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  type: 'category' | 'video' | 'keyword';
  group: number;
  size: number;
  color: string;
  details?: string;
  associatedData?: any;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  value: number;
}

export default function TopicDiscoveryGraph({
  videos,
  onSelectVideo,
  onSelectCategory,
  activeCategory
}: TopicDiscoveryGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });
  const [isExpanded, setIsExpanded] = useState(true);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [graphSearch, setGraphSearch] = useState('');
  const [repulsionStrength, setRepulsionStrength] = useState(-150);
  const [linkDistance, setLinkDistance] = useState(80);
  const [selectedNodeType, setSelectedNodeType] = useState<'all' | 'category' | 'video' | 'keyword'>('all');
  const [showTutorial, setShowTutorial] = useState(true);

  // Helper to extract clean keywords from video takeaways and titles
  const getKeywordsForVideo = (video: VideoItem): string[] => {
    const words = new Set<string>();
    const textToScan = `${video.title} ${video.category} ${video.takeaways.join(' ')}`.toLowerCase();
    
    const domains = [
      { key: 'ai', display: 'Artificial Intelligence' },
      { key: 'gemini', display: 'Gemini Systems' },
      { key: 'neural', display: 'Neural Networks' },
      { key: 'devin', display: 'Devin Automation' },
      { key: 'cognitive', display: 'Cognitive Science' },
      { key: 'framework', display: 'System Frameworks' },
      { key: 'design', display: 'Creative Design' },
      { key: 'typography', display: 'Typography & Layout' },
      { key: 'retention', display: 'Active Retention' },
      { key: 'memory', display: 'Memory Models' },
      { key: 'learning', display: 'Metacognitive Learning' },
      { key: 'architecture', display: 'Software Architecture' },
      { key: 'intelligence', display: 'Business Intelligence' },
      { key: 'strategy', display: 'Growth Strategy' },
      { key: 'leader', display: 'Leadership Systems' },
      { key: 'productivity', display: 'Productivity Engines' }
    ];

    domains.forEach(d => {
      if (textToScan.includes(d.key)) {
        words.add(d.display);
      }
    });

    // Extract prominent capitalized words from takeaways
    video.takeaways.forEach((takeaway: string) => {
      const matches = takeaway.match(/[A-Z][a-zA-Z]{3,}/g);
      if (matches) {
        matches.forEach(m => {
          if (!['This', 'That', 'With', 'From', 'Your', 'They', 'Then', 'What', 'How', 'When', 'Study', 'Code', 'Devin', 'Abdaal', 'Sung'].includes(m)) {
            words.add(m);
          }
        });
      }
    });

    return Array.from(words).slice(0, 4); // Limit to top 4 per video for layout neatness
  };

  // ResizeObserver for modern fluid layout sizing
  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({
          width: Math.max(width, 320),
          height: Math.max(height, 350)
        });
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [isExpanded]);

  // Transform video data into Nodes and Links for D3
  const graphData = useMemo(() => {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const nodeSet = new Set<string>();

    // Unique Categories list
    const categories = Array.from(new Set(videos.map(v => v.category)));

    // 1. Add Category Nodes
    categories.forEach(cat => {
      const id = `category:${cat}`;
      if (!nodeSet.has(id)) {
        nodes.push({
          id,
          label: cat,
          type: 'category',
          group: 1,
          size: 24,
          color: cat === activeCategory ? '#F59E0B' : '#1E293B', // Highlight active category
          details: `Workspace core domain for organizing related curations. Click to filter curation list.`,
          associatedData: cat
        });
        nodeSet.add(id);
      }
    });

    // 2. Add Video Nodes and link them to Categories
    videos.forEach(video => {
      const videoId = `video:${video.id}`;
      if (!nodeSet.has(videoId)) {
        nodes.push({
          id: videoId,
          label: video.title,
          type: 'video',
          group: 2,
          size: 16,
          color: '#3F51B5',
          details: `Curated Video by ${video.channelTitle}. Rating: ⭐ ${video.rating}/5. Double-click to open Study workspace.`,
          associatedData: video
        });
        nodeSet.add(videoId);

        // Link video to its category
        links.push({
          source: `category:${video.category}`,
          target: videoId,
          value: 2
        });
      }

      // 3. Extract Keywords, create Keyword nodes, and link to Video
      const keywords = getKeywordsForVideo(video);
      keywords.forEach(kw => {
        const keywordId = `keyword:${kw}`;
        if (!nodeSet.has(keywordId)) {
          nodes.push({
            id: keywordId,
            label: kw,
            type: 'keyword',
            group: 3,
            size: 10,
            color: '#10B981',
            details: `Cross-curation learning pillar concept.`
          });
          nodeSet.add(keywordId);
        }

        // Link video to keyword
        links.push({
          source: videoId,
          target: keywordId,
          value: 1
        });
      });
    });

    return { nodes, links };
  }, [videos, activeCategory]);

  const zoomRef = useRef<any>(null);

  const handleResetZoom = () => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(750)
        .call(zoomRef.current.transform, d3.zoomIdentity);
    }
  };

  const handleZoomIn = () => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(300)
        .call(zoomRef.current.scaleBy, 1.3);
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(300)
        .call(zoomRef.current.scaleBy, 0.7);
    }
  };

  // Main D3 force layout effect
  useEffect(() => {
    if (!svgRef.current || graphData.nodes.length === 0) return;

    const width = dimensions.width;
    const height = dimensions.height;

    // Clear previous elements
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Create container group for zoom/pan
    const container = svg.append('g').attr('class', 'graph-container');

    // Add zoom capability
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', (event) => {
        container.attr('transform', event.transform);
      });

    svg.call(zoom);
    zoomRef.current = zoom;

    // Create deep copies to avoid mutation issues in D3
    const nodes: GraphNode[] = graphData.nodes.map(d => ({ ...d }));
    const links: GraphLink[] = graphData.links.map(d => ({
      ...d,
      source: d.source,
      target: d.target
    }));

    // Setup force simulation
    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(links)
        .id(d => d.id)
        .distance(linkDistance)
      )
      .force('charge', d3.forceManyBody().strength(repulsionStrength))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<GraphNode>().radius(d => d.size + 15));

    // Render connections (links)
    const link = container.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .enter().append('line')
      .attr('stroke', '#E2E8F0')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', d => d.value === 2 ? 2.5 : 1.2)
      .attr('stroke-dasharray', d => d.value === 1 ? '3,3' : 'none');

    // Drag helper methods
    function dragstarted(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: any) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    // Render nodes
    const node = container.append('g')
      .attr('class', 'nodes')
      .selectAll<SVGGElement, GraphNode>('g')
      .data(nodes)
      .enter().append('g')
      .call(d3.drag<SVGGElement, GraphNode>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended)
      );

    // Filter nodes styling based on search and selected node filters
    const isNodeHighlighted = (d: GraphNode) => {
      if (selectedNodeType !== 'all' && d.type !== selectedNodeType) return false;
      if (graphSearch.trim()) {
        const query = graphSearch.toLowerCase();
        return d.label.toLowerCase().includes(query) || (d.details && d.details.toLowerCase().includes(query));
      }
      return true;
    };

    // Node representation: Circle/Glow
    node.append('circle')
      .attr('r', d => d.size)
      .attr('fill', d => {
        if (d.type === 'category') {
          return d.id === `category:${activeCategory}` ? '#F59E0B' : '#0F172A';
        }
        return d.color;
      })
      .attr('stroke', '#ffffff')
      .attr('stroke-width', d => d.type === 'category' ? 3 : 1.5)
      .attr('shadow-md', 'true')
      .style('opacity', d => isNodeHighlighted(d) ? 1 : 0.15)
      .style('cursor', 'grab')
      .on('mouseover', (event, d) => {
        setHoveredNode(d);
        d3.select(event.currentTarget)
          .transition()
          .duration(150)
          .attr('r', d.size + 4)
          .attr('stroke-width', d.type === 'category' ? 4 : 2.5)
          .attr('fill', d.type === 'video' ? '#4F46E5' : d.color);
      })
      .on('mouseout', (event, d) => {
        setHoveredNode(null);
        d3.select(event.currentTarget)
          .transition()
          .duration(150)
          .attr('r', d.size)
          .attr('stroke-width', d.type === 'category' ? 3 : 1.5)
          .attr('fill', d.type === 'category' && d.id === `category:${activeCategory}` ? '#F59E0B' : d.color);
      })
      .on('click', (event, d) => {
        if (d.type === 'category') {
          onSelectCategory(d.associatedData);
        } else if (d.type === 'video') {
          onSelectVideo(d.associatedData);
        }
      });

    // Add category specific visual icons inside nodes or a clean text label
    node.append('text')
      .attr('dy', d => d.size + 14)
      .attr('text-anchor', 'middle')
      .attr('font-size', d => d.type === 'category' ? '10px' : '9px')
      .attr('font-weight', d => d.type === 'category' ? '900' : '600')
      .attr('font-family', '"Inter", sans-serif')
      .attr('fill', d => d.type === 'category' ? '#0F172A' : '#475569')
      .style('opacity', d => isNodeHighlighted(d) ? 1 : 0.1)
      .style('pointer-events', 'none')
      .text(d => {
        if (d.type === 'video') {
          return d.label.length > 18 ? d.label.substring(0, 15) + '...' : d.label;
        }
        return d.label;
      });

    // Simulation update handler
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as GraphNode).x!)
        .attr('y1', d => (d.source as GraphNode).y!)
        .attr('x2', d => (d.target as GraphNode).x!)
        .attr('y2', d => (d.target as GraphNode).y!);

      node
        .attr('transform', d => `translate(${d.x}, ${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [graphData, dimensions, repulsionStrength, linkDistance, graphSearch, selectedNodeType, activeCategory]);

  return (
    <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs transition-all duration-300">
      
      {/* Visual Station Header */}
      <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-amber-500 to-rose-400 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-md shadow-amber-500/10 shrink-0">
            <Network className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider font-display flex items-center gap-2">
              <span>Topic Discovery Station</span>
              <span className="bg-emerald-500 text-white text-[9px] px-2 py-0.5 rounded-full font-black">
                Interactive D3 Network
              </span>
            </h2>
            <p className="text-[11px] text-slate-500 font-medium">Explore thematic connection meshes between core categories and video concept pillars.</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-end sm:self-auto">
          {/* Active Tutorial Badge */}
          <button
            onClick={() => setShowTutorial(!showTutorial)}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
            title="Toggle interaction guide"
          >
            <HelpCircle className="w-4.5 h-4.5" />
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer"
          >
            {isExpanded ? 'Collapse Engine' : 'Expand Network'}
          </button>
        </div>
      </div>

      {showTutorial && isExpanded && (
        <div className="mx-5 mt-4 p-4 bg-amber-50/50 border border-amber-200/40 rounded-2xl flex items-start gap-3 animate-slide-in">
          <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-amber-800 font-display">Interaction Matrix Guide</h4>
            <p className="text-[11px] text-slate-600 leading-relaxed font-semibold">
              • <strong className="text-amber-800">Drag nodes</strong> to dynamically redirect the physical forces. <br />
              • <strong className="text-amber-800">Scroll wheel</strong> or pinch-to-zoom to zoom in/out of the topological space. <br />
              • <strong className="text-amber-800">Click categories</strong> to filter the bookshelf. <br />
              • <strong className="text-amber-800">Click videos</strong> to trigger side-by-side workspace focus immediately.
            </p>
          </div>
        </div>
      )}

      {isExpanded && (
        <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
          
          {/* Control Deck (Left panel inside graph) */}
          <div className="lg:w-64 p-5 bg-slate-50/50 space-y-4 shrink-0">
            
            {/* Quick Node Search */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Search className="w-3 h-3" /> Node Search
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Filter nodes..."
                  value={graphSearch}
                  onChange={(e) => setGraphSearch(e.target.value)}
                  className="w-full pl-3 pr-8 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold outline-hidden text-slate-700 focus:border-amber-400"
                />
                {graphSearch && (
                  <button 
                    onClick={() => setGraphSearch('')}
                    className="absolute right-2 top-2 text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer font-black"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Filter by Node Type */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Layers className="w-3 h-3" /> Visual Filter
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {(['all', 'category', 'video', 'keyword'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setSelectedNodeType(type)}
                    className={`px-2 py-1.5 border rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer truncate ${
                      selectedNodeType === type
                        ? 'bg-slate-900 border-slate-900 text-white shadow-2xs'
                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Physics sliders */}
            <div className="space-y-3.5 pt-2 border-t border-slate-200/60">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Sliders className="w-3 h-3" /> Physical Forces
              </span>

              {/* Repulsion charge */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] font-semibold text-slate-600">
                  <span>Charge force</span>
                  <span className="font-mono">{repulsionStrength}</span>
                </div>
                <input
                  type="range"
                  min="-400"
                  max="-50"
                  step="10"
                  value={repulsionStrength}
                  onChange={(e) => setRepulsionStrength(Number(e.target.value))}
                  className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              {/* Link Distance */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] font-semibold text-slate-600">
                  <span>Link distance</span>
                  <span className="font-mono">{linkDistance}px</span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="180"
                  step="5"
                  value={linkDistance}
                  onChange={(e) => setLinkDistance(Number(e.target.value))}
                  className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>
            </div>

            {/* Render details of hovered node */}
            <div className="pt-3 border-t border-slate-200/60 min-h-[110px] flex flex-col justify-between">
              {hoveredNode ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${
                      hoveredNode.type === 'category' ? 'bg-amber-400' : hoveredNode.type === 'video' ? 'bg-indigo-500' : 'bg-emerald-500'
                    }`} />
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                      {hoveredNode.type}
                    </span>
                  </div>
                  <h4 className="text-xs font-black text-slate-800 line-clamp-2 leading-snug">
                    {hoveredNode.label}
                  </h4>
                  <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-1">
                    {hoveredNode.details}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center h-full text-slate-400 py-3">
                  <div className="text-lg">🧭</div>
                  <p className="text-[10px] font-semibold mt-1">Hover over nodes to inspect concepts & associations</p>
                </div>
              )}
            </div>

          </div>

          {/* Graph Display Area */}
          <div ref={containerRef} className="flex-1 relative bg-slate-50/20 min-h-[380px] lg:min-h-[440px]">
            <svg 
              ref={svgRef} 
              width={dimensions.width} 
              height={dimensions.height}
              className="w-full h-full block select-none"
            />

            {/* Navigation and Utility buttons */}
            <div className="absolute bottom-4 right-4 bg-white/95 border border-slate-200/80 p-1.5 rounded-2xl flex items-center gap-1 shadow-sm backdrop-blur-xs">
              <button
                onClick={handleZoomIn}
                className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={handleZoomOut}
                className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={handleResetZoom}
                className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
                title="Reset Fit"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {/* Floating Stats Badge */}
            <div className="absolute top-4 left-4 bg-slate-900/90 text-white border border-slate-700/50 px-3 py-1.5 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-wider backdrop-blur-xs">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Topology: {graphData.nodes.length} Nodes & {graphData.links.length} Links</span>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
