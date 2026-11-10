import { useNovaStore } from '../store/novaStore';
import { useSelectedNode } from '../store/novaStore';
import { formatTimestamp } from '../utils/format';

export function DetailSheet() {
  const selectedNode = useSelectedNode();
  const { setSelectedNode, setFocusNode } = useNovaStore();
  
  if (!selectedNode) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-4 py-3 border-b border-nova-border/30">
          <span className="font-mono text-xs text-nova-textDim uppercase tracking-wider">DETAILS</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center px-8">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-nova-textDim/30 mx-auto mb-4">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            <p className="font-mono text-sm text-nova-textDim/60">Select a node to view details</p>
            <p className="font-mono text-xs text-nova-textDim/40 mt-1">Click any node in the graph</p>
          </div>
        </div>
      </div>
    );
  }
  
  const typeConfig = {
    note: { color: '#55E8FF', label: 'NOTE' },
    document: { color: '#55FFD1', label: 'DOC' },
    idea: { color: '#9A8CFF', label: 'IDEA' },
    project: { color: '#FFB84D', label: 'PROJECT' },
    task: { color: '#FF6B8A', label: 'TASK' },
    person: { color: '#88FF88', label: 'PERSON' },
    conversation: { color: '#FFAA55', label: 'CONV' },
    memory: { color: '#AA88FF', label: 'MEMORY' },
    agent: { color: '#FF55AA', label: 'AGENT' },
  } as const;
  
  const config = (selectedNode.type && selectedNode.type in typeConfig)
    ? typeConfig[selectedNode.type as keyof typeof typeConfig]
    : { color: selectedNode.color || '#00F0FF', label: 'FILE' };
  
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between px-4 py-3 border-b border-nova-border/30">
        <div className="flex items-center gap-2">
          <span 
            className="w-2.5 h-2.5 rounded" 
            style={{ backgroundColor: config.color }}
            aria-hidden="true"
          />
          <div>
            <span className="font-mono text-xs text-nova-textDim uppercase tracking-wider">{config.label}</span>
            <span className="font-mono text-sm text-nova-text block truncate max-w-[200px]">{selectedNode.title}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setFocusNode(selectedNode.id)}
            className="p-1.5 rounded hover:bg-nova-violet/20 hover:text-nova-violet text-nova-textDim transition-colors"
            aria-label="Focus on this node"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
          <button
            onClick={() => setSelectedNode(null)}
            className="p-1.5 rounded hover:bg-nova-red/20 hover:text-nova-red text-nova-textDim transition-colors"
            aria-label="Close details"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Summary */}
        <div className="glass-panel rounded-lg border-nova-border/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="font-mono text-xs text-nova-textDim uppercase tracking-wider">SUMMARY</span>
            <span className="px-2 py-0.5 text-[10px] font-mono rounded" 
              style={{ 
                backgroundColor: `${selectedNode.color}20`, 
                borderColor: `${selectedNode.color}60`,
                color: selectedNode.color,
                borderStyle: 'solid',
                borderWidth: '1px'
              }}>
              {selectedNode.type.toUpperCase()}
            </span>
          </div>
          <p className="text-sm text-nova-textDim/90 leading-relaxed">{selectedNode.summary}</p>
          {selectedNode.content && (
            <details className="mt-3 group">
              <summary className="font-mono text-xs text-nova-textDim/70 cursor-pointer flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="transition-transform group-open:rotate-90">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
                Show full content
              </summary>
              <div className="mt-2 p-3 bg-nova-bg/50 rounded font-mono text-xs text-nova-textDim/80 whitespace-pre-wrap max-h-64 overflow-auto">
                {selectedNode.content}
              </div>
            </details>
          )}
        </div>
        
        {/* Metadata */}
        <div className="grid grid-cols-2 gap-3">
          <MetadataItem label="CREATED" value={selectedNode.createdAt ? formatTimestamp(selectedNode.createdAt) : 'N/A'} />
          <MetadataItem label="UPDATED" value={selectedNode.updatedAt ? formatTimestamp(selectedNode.updatedAt) : 'N/A'} />
          <MetadataItem label="RELATIONSHIPS" value={`${selectedNode.relationships?.length || 0} links`} />
          <MetadataItem label="BACKLINKS" value={`${selectedNode.backlinks?.length || 0} refs`} />
          {selectedNode.importance && <MetadataItem label="IMPORTANCE" value={`${selectedNode.importance}/10`} />}
          {selectedNode.dueDate && <MetadataItem label="DUE" value={formatTimestamp(selectedNode.dueDate)} />}
          {selectedNode.assignee && <MetadataItem label="ASSIGNEE" value={selectedNode.assignee} />}
          {selectedNode.projectId && <MetadataItem label="PROJECT" value={selectedNode.projectId} />}
        </div>
        
        {/* Tags */}
        {selectedNode.tags && selectedNode.tags.length > 0 && (
          <div className="glass-panel rounded-lg border-nova-border/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-xs text-nova-textDim uppercase tracking-wider">TAGS</span>
              <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-nova-border/30 text-nova-textDim">{selectedNode.tags.length}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {selectedNode.tags.map(tag => (
                <span key={tag} className="px-2 py-1 text-[10px] font-mono rounded" 
                  style={{ 
                    backgroundColor: `${selectedNode.color}20`, 
                    borderColor: `${selectedNode.color}60`,
                    color: selectedNode.color,
                    borderStyle: 'solid',
                    borderWidth: '1px'
                  }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
        
        {/* Relationships */}
        {selectedNode.relationships && selectedNode.relationships.length > 0 && (
          <div className="glass-panel rounded-lg border-nova-border/30 p-4">
            <span className="font-mono text-xs text-nova-textDim uppercase tracking-wider mb-3 block">RELATIONSHIPS</span>
            <div className="flex flex-wrap gap-1">
              {selectedNode.relationships.slice(0, 8).map(relId => (
                <button
                  key={relId}
                  onClick={() => useNovaStore.getState().setSelectedNode(relId)}
                  className="px-2 py-1 text-[10px] font-mono rounded bg-nova-border/30 text-nova-textDim hover:bg-nova-cyan/20 hover:text-nova-cyan hover:border-nova-cyan/50 border border-transparent transition-colors"
                >
                  {relId}
                </button>
              ))}
              {selectedNode.relationships.length > 8 && (
                <span className="px-2 py-1 text-[10px] font-mono rounded bg-nova-border/30 text-nova-textDim/50">
                  +{selectedNode.relationships.length - 8} more
                </span>
              )}
            </div>
          </div>
        )}
        
        {/* Backlinks */}
        {selectedNode.backlinks.length > 0 && (
          <div className="glass-panel rounded-lg border-nova-border/30 p-4">
            <span className="font-mono text-xs text-nova-textDim uppercase tracking-wider mb-3 block">BACKLINKS</span>
            <div className="flex flex-wrap gap-1">
              {selectedNode.backlinks.slice(0, 6).map(backId => (
                <button
                  key={backId}
                  onClick={() => useNovaStore.getState().setSelectedNode(backId)}
                  className="px-2 py-1 text-[10px] font-mono rounded bg-nova-border/30 text-nova-textDim hover:bg-nova-violet/20 hover:text-nova-violet hover:border-nova-violet/50 border border-transparent transition-colors"
                >
                  {backId}
                </button>
              ))}
              {selectedNode.backlinks.length > 6 && (
                <span className="px-2 py-1 text-[10px] font-mono rounded bg-nova-border/30 text-nova-textDim/50">
                  +{selectedNode.backlinks.length - 6} more
                </span>
              )}
            </div>
          </div>
        )}
        
        {/* Source Link */}
        {selectedNode.sourceUrl && (
          <a 
            href={selectedNode.sourceUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-3 glass-panel rounded-lg border-nova-border/30 hover:border-nova-cyan/50 transition-colors group"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-nova-cyan">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            <span className="font-mono text-sm text-nova-cyan group-hover:underline">Open Source</span>
          </a>
        )}
        
        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-nova-border/30">
          <button className="px-3 py-2 text-sm font-mono rounded-lg border border-nova-border/30 text-nova-textDim hover:text-nova-cyan hover:border-nova-cyan/50 transition-colors flex-1 sm:flex-none">
            OPEN
          </button>
          <button className="px-3 py-2 text-sm font-mono rounded-lg border border-nova-border/30 text-nova-textDim hover:text-nova-violet hover:border-nova-violet/50 transition-colors flex-1 sm:flex-none">
            EDIT
          </button>
          <button className="px-3 py-2 text-sm font-mono rounded-lg border border-nova-violet/30 text-nova-violet hover:bg-nova-violet/10 transition-colors flex-1 sm:flex-none">
            PIN
          </button>
          <button className="px-3 py-2 text-sm font-mono rounded-lg border border-nova-textDim/30 text-nova-textDim hover:text-nova-red hover:border-nova-red/50 transition-colors flex-1 sm:flex-none">
            ARCHIVE
          </button>
          <button className="px-3 py-2 text-sm font-mono rounded-lg border border-nova-cyan/30 text-nova-cyan hover:bg-nova-cyan/10 transition-colors flex-1 sm:flex-none">
            ASK AI
          </button>
        </div>
      </div>
    </div>
  );
}

function MetadataItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-panel rounded-lg border-nova-border/30 p-3">
      <span className="font-mono text-[10px] text-nova-textDim uppercase tracking-wider block mb-1">{label}</span>
      <span className="font-mono text-sm text-nova-text">{value}</span>
    </div>
  );
}