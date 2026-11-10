import { useNovaStore } from '../../store/novaStore';

export function ProjectsView() {
  const { graph, setSelectedNode } = useNovaStore();
  const projects = Array.from(graph.nodes.values()).filter(n => n.type === 'project');

  return (
    <div className="h-full w-full overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-nova-border/30 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_10px_#FFB800]" />
            <h1 className="font-mono text-lg font-bold text-nova-text tracking-wider">PROJECT PORTFOLIO</h1>
          </div>
          <p className="font-mono text-xs text-nova-textDim mt-1">Active strategic initiatives & neural graph clusters</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-lg glass-panel border border-nova-border/40 font-mono text-xs text-nova-cyan">
            {projects.length} ACTIVE PROJECTS
          </span>
        </div>
      </div>

      {/* Project Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {projects.map(proj => (
          <div
            key={proj.id}
            className="glass-panel p-5 rounded-2xl border border-nova-border/40 hover:border-nova-cyan/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(0,240,255,0.15)] flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-3">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono tracking-wider uppercase bg-amber-500/15 border border-amber-500/30 text-amber-400">
                  PROJECT
                </span>
                <span className="font-mono text-xs text-nova-textDim">
                  PRIORITY {proj.importance}/10
                </span>
              </div>

              <h2 className="font-mono text-base font-bold text-nova-text group-hover:text-nova-cyan transition-colors">
                {proj.title}
              </h2>

              <p className="text-xs text-nova-textDim mt-2 leading-relaxed">
                {proj.summary}
              </p>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5 mt-4">
                {proj.tags.map(tag => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded-md bg-nova-bg/60 border border-nova-border/40 font-mono text-[9px] text-nova-textDim/80"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-nova-border/30 flex items-center justify-between">
              <span className="font-mono text-[10px] text-nova-textDim">
                {proj.relationships.length} LINKED NODES
              </span>
              <button
                onClick={() => setSelectedNode(proj.id)}
                className="px-3 py-1 rounded-lg bg-nova-cyan/15 border border-nova-cyan/40 text-nova-cyan hover:bg-nova-cyan/25 font-mono text-[10px] tracking-wider transition-all"
              >
                VIEW CLUSTER ↗
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
