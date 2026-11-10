import { useNovaStore } from '../store/novaStore';
import { formatUptime } from '../utils/format';

export function StatusHUD() {
  const { assistant, graph } = useNovaStore();
  
  return (
    <div className="flex flex-col gap-2 pointer-events-none">
      {/* System Status */}
      <div className="flex items-center gap-3 px-3 py-2 glass-panel rounded-lg border-nova-border/30 min-w-[280px]">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${
            assistant.connected ? 'bg-nova-cyan' : 'bg-nova-red'
          } animate-pulse`} aria-hidden="true" />
          <span className="font-mono text-xs text-nova-textDim uppercase tracking-wider">SYSTEM</span>
          <span className="font-mono text-sm text-nova-text">{assistant.connected ? 'ONLINE' : 'OFFLINE'}</span>
        </div>
        <div className="flex-1 text-right">
          <span className="font-mono text-xs text-nova-textDim">MODEL</span>
          <span className="font-mono text-sm text-nova-cyan ml-1">{assistant.model}</span>
        </div>
      </div>
      
      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-2">
        <div className="glass-panel rounded-lg border-nova-border/30 p-2 text-center">
          <span className="font-mono text-[10px] text-nova-textDim uppercase tracking-wider block">MEMORY</span>
          <span className="font-mono text-lg text-nova-text">{assistant.memoryUsage} MB</span>
        </div>
        <div className="glass-panel rounded-lg border-nova-border/30 p-2 text-center">
          <span className="font-mono text-[10px] text-nova-textDim uppercase tracking-wider block">LATENCY</span>
          <span className="font-mono text-lg text-nova-teal">{assistant.latency} ms</span>
        </div>
        <div className="glass-panel rounded-lg border-nova-border/30 p-2 text-center">
          <span className="font-mono text-[10px] text-nova-textDim uppercase tracking-wider block">UPTIME</span>
          <span className="font-mono text-lg text-nova-text">{formatUptime(assistant.uptime)}</span>
        </div>
        <div className="glass-panel rounded-lg border-nova-border/30 p-2 text-center">
          <span className="font-mono text-[10px] text-nova-textDim uppercase tracking-wider block">GRAPH</span>
          <span className="font-mono text-lg text-nova-violet">{graph.nodes.size} nodes</span>
        </div>
      </div>
      
      {/* State Indicator */}
      <div className="flex items-center gap-3 px-3 py-2 glass-panel rounded-lg border-nova-border/30">
        <span className="font-mono text-xs text-nova-textDim uppercase tracking-wider">STATE</span>
        <span 
          className={`font-mono text-sm px-2 py-0.5 rounded border transition-all duration-300 ${
            stateStyles[assistant.state]
          }`}
        >
          {assistant.state.toUpperCase()}
        </span>
        <div className="flex-1 h-1.5 bg-nova-border/20 rounded-full overflow-hidden">
          <div 
            className="h-full bg-nova-cyan transition-all duration-300"
            style={{ width: `${Math.round(assistant.audioLevel * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

const stateStyles: Record<string, string> = {
  idle: 'text-nova-cyan/70 border-nova-cyan/30 bg-nova-cyan/10',
  listening: 'text-nova-cyan border-nova-cyan/50 bg-nova-cyan/20 animate-pulse',
  thinking: 'text-nova-violet border-nova-violet/50 bg-nova-violet/20',
  speaking: 'text-nova-teal border-nova-teal/50 bg-nova-teal/20',
  error: 'text-nova-red border-nova-red/50 bg-nova-red/20 animate-pulse',
};