import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { 
  Network, 
  RotateCcw, 
  ZoomIn, 
  ZoomOut, 
  Info,
  HelpCircle,
  Award,
  ArrowRight
} from 'lucide-react';
import { VideoItem } from '../types';

interface TopicDiscoveryGraphProps {
  videos: VideoItem[];
  onSelectVideo: (video: VideoItem) => void;
  onSelectConcept: (concept: string | null) => void;
  activeConcept: string | null;
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  type: 'concept' | 'video';
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
  type: 'concept-link' | 'curriculum-path';
}

export default function TopicDiscoveryGraph({
  videos,
  onSelectVideo,
  onSelectConcept,
  activeConcept
}: TopicDiscoveryGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });
  const [isExpanded, setIsExpanded] = useState(true);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [graphSearch, setGraphSearch] = useState('');
  const [showTutorial, setShowTutorial] = useState(true);

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

    // 1. Gather all unique concept tags from videos
    const allConceptsMap: Record<string, string[]> = {}; // conceptName -> list of videoIds
    videos.forEach(v => {
      const tags = v.conceptTags || [];
      // Fallback tags if none are extracted yet
      const tagsToUse = tags.length > 0 ? tags : [v.category, 'General Study'];
      
      tagsToUse.forEach(tag => {
        const cleanTag = tag.trim();
        if (!allConceptsMap[cleanTag]) {
          allConceptsMap[cleanTag] = [];
        }
        allConceptsMap[cleanTag].push(v.id);
      });
    });

    // 2. Add Concept Nodes
    Object.keys(allConceptsMap).forEach(concept => {
      const id = `concept:${concept}`;
      if (!nodeSet.has(id)) {
        const isCurrent = activeConcept === concept;
        nodes.push({
          id,
          label: concept,
          type: 'concept',
          group: 1,
          size: isCurrent ? 24 : 18,
          color: isCurrent ? '#C4342B' : '#15171B', // Red highlight if selected, dark Ink otherwise
          details: `Atomic research topic. Connected to ${allConceptsMap[concept].length} curated video(s). Click to isolate this concept.`,
          associatedData: concept
        });
        nodeSet.add(id);
      }
    });

    // 3. Add Video Nodes & Connect to Concepts
    videos.forEach(video => {
      const videoId = `video:${video.id}`;
      if (!nodeSet.has(videoId)) {
        nodes.push({
          id: videoId,
          label: video.title,
          type: 'video',
          group: 2,
          size: 13,
          color: '#8A9A86', // Sage/Paper accent tone
          details: `Curated Video by ${video.channelTitle}. Complexity: ${video.conceptualComplexity || 'Standard'}. Double-click to study side-by-side.`,
          associatedData: video
        });
        nodeSet.add(videoId);
      }

      // Link video to its concepts
      const tags = video.conceptTags || [];
      const tagsToUse = tags.length > 0 ? tags : [video.category, 'General Study'];
      tagsToUse.forEach(tag => {
        links.push({
          source: `concept:${tag.trim()}`,
          target: videoId,
          value: 1,
          type: 'concept-link'
        });
      });
    });

    // 4. Chronological Curriculum sequential links (A -> B -> C)
    // Group videos by category, sort by createdAt (ascending, oldest first)
    const categoryGroups: Record<string, VideoItem[]> = {};
    videos.forEach(v => {
      if (!categoryGroups[v.category]) {
        categoryGroups[v.category] = [];
      }
      categoryGroups[v.category].push(v);
    });

    Object.keys(categoryGroups).forEach(cat => {
      const groupVideos = categoryGroups[cat].sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      // Link consecutive videos together
      for (let i = 0; i < groupVideos.length - 1; i++) {
        const sourceId = `video:${groupVideos[i].id}`;
        const targetId = `video:${groupVideos[i+1].id}`;
        links.push({
          source: sourceId,
          target: targetId,
          value: 2.5,
          type: 'curriculum-path'
        });
      }
    });

    return { nodes, links };
  }, [videos, activeConcept]);

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

    // Define arrows for the curriculum path
    const defs = svg.append('defs');
    defs.append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 0 10 10')
      .attr('refX', 18) // Distance from target node center (caps close to circle boundary)
      .attr('refY', 5)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto-start-reverse')
      .append('path')
      .attr('d', 'M 0 1.5 L 10 5 L 0 8.5 z')
      .attr('fill', '#C4342B'); // Signal Red arrow

    // Create container group for zoom/pan
    const container = svg.append('g').attr('class', 'graph-container');

    // Add zoom capability
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 4])
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
        .distance(d => d.type === 'curriculum-path' ? 150 : 100)
      )
      .force('charge', d3.forceManyBody().strength(-280))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<GraphNode>().radius(d => d.size + 32));

    // Render connections (links)
    const link = container.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .enter().append('line')
      .attr('stroke', d => d.type === 'curriculum-path' ? '#C4342B' : '#CBD5E1') // Signal Red for curriculum path, light gray slate for concepts
      .attr('stroke-opacity', d => d.type === 'curriculum-path' ? 0.95 : 0.45)
      .attr('stroke-width', d => d.type === 'curriculum-path' ? 2.5 : 1.2)
      .attr('stroke-dasharray', d => d.type === 'concept-link' ? '4,4' : 'none')
      .attr('marker-end', d => d.type === 'curriculum-path' ? 'url(#arrow)' : null); // Arrowheads for study sequences!

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

    // Filter nodes styling based on search
    const isNodeHighlighted = (d: GraphNode) => {
      if (graphSearch.trim()) {
        const query = graphSearch.toLowerCase();
        return d.label.toLowerCase().includes(query) || (d.details && d.details.toLowerCase().includes(query));
      }
      return true;
    };

    // Render nodes
    const node = container.append('g')
      .attr('class', 'nodes')
      .selectAll<SVGGElement, GraphNode>('g')
      .data(nodes)
      .enter().append('g')
      .style('cursor', 'pointer')
      .style('opacity', d => isNodeHighlighted(d) ? 1 : 0.15)
      .call(d3.drag<SVGGElement, GraphNode>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended)
      );

    // 1. Render Concept Nodes (Solid Ink/Black circles, Red when active)
    node.filter(d => d.type === 'concept')
      .append('circle')
      .attr('class', 'node-shape')
      .attr('r', d => d.size)
      .attr('fill', d => d.id === `concept:${activeConcept}` ? '#C4342B' : '#15171B')
      .attr('stroke', '#FFFFFF')
      .attr('stroke-width', 2.5)
      .style('filter', d => d.id === `concept:${activeConcept}` ? 'drop-shadow(0 0 6px rgba(196,52,43,0.6))' : 'none');

    // 2. Render Video/Curation Nodes (Hollow soft-sage circles with central player dot)
    const videoGroup = node.filter(d => d.type === 'video');
    
    videoGroup.append('circle')
      .attr('class', 'node-shape')
      .attr('r', d => d.size)
      .attr('fill', '#F4F6F4')
      .attr('stroke', '#8A9A86')
      .attr('stroke-width', 2.5);

    videoGroup.append('circle')
      .attr('class', 'node-subshape')
      .attr('r', 3)
      .attr('fill', '#8A9A86')
      .style('pointer-events', 'none');

    // Attach high-fidelity mouse interaction handlers to the whole <g> node group
    node
      .on('mouseover', (event, d) => {
        setHoveredNode(d);
        
        const g = d3.select(event.currentTarget);
        g.select('.node-shape')
          .transition()
          .duration(120)
          .attr('r', d.size + 4)
          .style('filter', 'drop-shadow(0 4px 8px rgba(21,23,27,0.15))');
          
        if (d.type === 'video') {
          g.select('.node-shape')
            .attr('stroke', '#15171B')
            .attr('fill', '#FFFFFF');
          g.select('.node-subshape')
            .attr('fill', '#15171B')
            .attr('r', 4.5);
        } else {
          g.select('.node-shape')
            .attr('fill', d.id === `concept:${activeConcept}` ? '#C4342B' : '#334155');
        }
      })
      .on('mouseout', (event, d) => {
        setHoveredNode(null);
        
        const g = d3.select(event.currentTarget);
        g.select('.node-shape')
          .transition()
          .duration(120)
          .attr('r', d.size)
          .style('filter', d.id === `concept:${activeConcept}` ? 'drop-shadow(0 0 6px rgba(196,52,43,0.5))' : 'none');
          
        if (d.type === 'video') {
          g.select('.node-shape')
            .attr('stroke', '#8A9A86')
            .attr('fill', '#F4F6F4');
          g.select('.node-subshape')
            .attr('fill', '#8A9A86')
            .attr('r', 3);
        } else {
          g.select('.node-shape')
            .attr('fill', d.id === `concept:${activeConcept}` ? '#C4342B' : '#15171B');
        }
      })
      .on('click', (event, d) => {
        if (d.type === 'concept') {
          onSelectConcept(d.associatedData === activeConcept ? null : d.associatedData);
        } else if (d.type === 'video') {
          onSelectVideo(d.associatedData);
        }
      });

    // Add clean labels: concept above node, video below node to prevent crowding collisions completely
    node.append('text')
      .attr('dy', d => d.type === 'concept' ? -d.size - 8 : d.size + 14)
      .attr('text-anchor', 'middle')
      .attr('font-size', d => d.type === 'concept' ? '10px' : '9px')
      .attr('font-weight', d => d.type === 'concept' ? '800' : '600')
      .attr('font-family', '"Inter", sans-serif')
      .attr('fill', d => d.type === 'concept' ? '#15171B' : '#64748B')
      .style('pointer-events', 'none')
      .text(d => {
        if (d.type === 'video') {
          return d.label.length > 15 ? d.label.substring(0, 13) + '...' : d.label;
        }
        return d.label;
      });

    // Simulation tick handler
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
  }, [graphData, dimensions, graphSearch, activeConcept]);

  return (
    <div className="bg-white border-2 border-brand-ink rounded-3xl overflow-hidden shadow-xs transition-all duration-300">
      
      {/* Visual Station Header */}
      <div className="p-5 border-b-2 border-brand-ink flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-ink text-brand-paper rounded-2xl flex items-center justify-center font-bold text-xl shrink-0">
            <Network className="w-5 h-5 text-brand-paper" />
          </div>
          <div>
            <h2 className="text-sm font-black text-brand-ink uppercase tracking-wider font-display flex items-center gap-2">
              <span>Concept-Bridging Knowledge Graph</span>
              <span className="bg-brand-red text-white text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                Navigable Curriculum
              </span>
            </h2>
            <p className="text-[10px] text-slate-500 font-semibold">Explore atomic concept clusters linked by Signal Red sequential curriculum pathways.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={() => setShowTutorial(!showTutorial)}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
            title="Toggle interaction matrix guide"
          >
            <HelpCircle className="w-4.5 h-4.5" />
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-3 py-1.5 bg-brand-ink hover:bg-slate-800 text-brand-paper text-[9px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer"
          >
            {isExpanded ? 'Collapse Graph' : 'Open Graph'}
          </button>
        </div>
      </div>

      {showTutorial && isExpanded && (
        <div className="mx-5 mt-4 p-4 bg-brand-paper/50 border border-brand-ink/10 rounded-2xl flex items-start gap-3 animate-slide-in select-text">
          <Info className="w-4 h-4 text-brand-red shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-brand-ink font-display">How to Navigate this Curriculum:</h4>
            <p className="text-slate-600 leading-relaxed font-semibold">
              • <strong className="text-brand-ink">Atomic Concepts (Dark Nodes)</strong>: Click to filter your bookshelfed curations to this specific conceptual cluster. <br />
              • <strong className="text-brand-ink">Study Pathways (Signal Red Arrows)</strong>: Connects consecutive curations chronologically. Follow the arrows for a logically staged curriculum. <br />
              • <strong className="text-brand-ink">Curation Cards (Sage Nodes)</strong>: Click to select a video; double-click to load its transcript and study notes.
            </p>
          </div>
        </div>
      )}

      {isExpanded && (
        <div className="relative">
          {/* Active Concept Filter indicator */}
          {activeConcept && (
            <div className="absolute top-4 left-4 bg-brand-red text-white text-[9px] px-3 py-1.5 rounded-xl font-black uppercase tracking-widest flex items-center gap-1.5 shadow-md z-10">
              <Award className="w-3.5 h-3.5" />
              <span>Filtering Concept: {activeConcept}</span>
              <button 
                onClick={() => onSelectConcept(null)} 
                className="bg-black/25 hover:bg-black/40 text-white rounded-full p-0.5 ml-1 transition-colors"
                title="Reset concept filter"
              >
                <X className="w-3 h-3 stroke-[3]" />
              </button>
            </div>
          )}

          {/* Graph Display Area */}
          <div ref={containerRef} className="w-full relative bg-slate-50/10 min-h-[380px] lg:min-h-[440px]">
            <svg 
              ref={svgRef} 
              width={dimensions.width} 
              height={dimensions.height}
              className="w-full h-full block select-none"
            />

            {/* Navigation and Utility buttons */}
            <div className="absolute bottom-4 right-4 bg-white/95 border border-slate-200 p-1.5 rounded-2xl flex items-center gap-1 shadow-sm backdrop-blur-xs z-10">
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
            <div className="absolute top-4 right-4 bg-brand-ink text-brand-paper border border-slate-700 px-3 py-1.5 rounded-xl flex items-center gap-2 text-[9px] font-black uppercase tracking-wider backdrop-blur-xs z-10">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-red opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-red"></span>
              </span>
              <span>Grid: {graphData.nodes.length} Nodes</span>
            </div>

            {/* Hovered Node info overlay */}
            <div className="absolute bottom-4 left-4 max-w-[280px] sm:max-w-sm bg-white/95 border-2 border-brand-ink p-4 rounded-2xl shadow-md backdrop-blur-xs min-h-[90px] flex flex-col justify-between z-10 select-text">
              {hoveredNode ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${
                      hoveredNode.type === 'concept' ? 'bg-brand-red' : 'bg-emerald-500'
                    }`} />
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                      {hoveredNode.type}
                    </span>
                  </div>
                  <h4 className="text-xs font-black text-brand-ink line-clamp-2 leading-snug">
                    {hoveredNode.label}
                  </h4>
                  <p className="text-[10px] text-slate-500 font-semibold leading-relaxed mt-1">
                    {hoveredNode.details}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center h-full text-slate-400 py-2">
                  <div className="text-base">🧭</div>
                  <p className="text-[9px] font-bold text-slate-500 mt-1">Hover over nodes to inspect sequential concepts</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Clean dummy SVG close helper
interface XProps {
  className?: string;
}
function X({ className }: XProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  );
}
