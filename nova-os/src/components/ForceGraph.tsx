import { useMemo } from 'react';
import { useGraph } from '../store/novaStore';

interface ForceGraphProps { className?: string; }
interface GraphPoint { id: string; x: number; y: number; color: string; size: number; title: string; }

/** GPU-independent graph view for browsers where WebGL canvases are unavailable. */
export function ForceGraph({ className = '' }: ForceGraphProps) {
  const { graph, setSelectedNode } = useGraph();
  const points = useMemo<GraphPoint[]>(() => {
    const nodes = Array.from(graph.nodes.values());
    return nodes.map((node, index) => {
      const angle = (index / Math.max(nodes.length, 1)) * Math.PI * 2 - Math.PI / 2;
      const ring = 18 + (index % 4) * 10;
      return {
        id: node.id,
        x: 50 + Math.cos(angle) * ring,
        y: 50 + Math.sin(angle) * ring * 0.72,
        color: node.color,
        size: Math.max(4, Math.min(10, node.size)),
        title: node.title,
      };
    });
  }, [graph.nodes]);

  const pointById = useMemo(
    () => new Map(points.map(p => [p.id, p])),
    [points],
  );

  return (
    /*
     * This element fills .brain-panel (position: relative, overflow: hidden).
     * It must NOT use 100vw or viewport-based sizes.
     */
    <div
      className={`relative w-full h-full overflow-hidden bg-nova-bg ${className}`}
      style={{ isolation: 'isolate' }}
    >
      <div className="absolute inset-0 grid-pattern opacity-70" aria-hidden="true" />

      {/* Header label */}
      <div className="absolute left-5 top-5 z-10 font-mono text-[10px] tracking-[0.24em] text-nova-cyan/70 pointer-events-none">
        KNOWLEDGE GRAPH · {points.length} NODES
      </div>

      {/*
       * SVG fills the panel via absolute inset-0.
       * viewBox="0 0 100 100" keeps node coordinates in a stable
       * percentage-based coordinate space regardless of panel pixel size.
       */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Knowledge graph"
      >
        <defs>
          <filter id="node-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="0.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Edges */}
        {Array.from(graph.links.values()).map(link => {
          const source = pointById.get(link.source);
          const target = pointById.get(link.target);
          return source && target ? (
            <line
              key={link.id}
              x1={source.x} y1={source.y}
              x2={target.x} y2={target.y}
              stroke={link.color}
              strokeOpacity="0.32"
              strokeWidth="0.18"
            />
          ) : null;
        })}

        {/* Nodes */}
        {points.map((point, index) => (
          <g
            key={point.id}
            className="cursor-pointer"
            onClick={() => setSelectedNode(point.id)}
            role="button"
            aria-label={point.title}
          >
            <circle
              cx={point.x} cy={point.y}
              r={point.size * 1.8}
              fill={point.color}
              opacity="0.10"
              className="graph-node-halo"
              style={{ animationDelay: `${index * -0.18}s` }}
            />
            <circle
              cx={point.x} cy={point.y}
              r={point.id === graph.selectedNodeId ? point.size * 0.72 : point.size * 0.48}
              fill={point.color}
              filter="url(#node-glow)"
            />
            <text
              x={point.x}
              y={point.y + point.size + 2.7}
              textAnchor="middle"
              fill="#b8dce6"
              fontSize="2.2"
              fontFamily="monospace"
            >
              {point.title.slice(0, 18)}
            </text>
          </g>
        ))}
      </svg>

      {/* Footer label */}
      <div className="absolute bottom-5 left-5 font-mono text-[10px] tracking-widest text-nova-textDim pointer-events-none z-10">
        LIVE · SEMANTIC MAP
      </div>
    </div>
  );
}
