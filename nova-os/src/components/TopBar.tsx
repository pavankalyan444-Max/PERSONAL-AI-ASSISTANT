import { useNovaStore } from '../store/novaStore';
import { VoiceSelector } from './VoiceSelector';

interface TopBarProps {
  onAgentToggle?: () => void;
}

export function TopBar({ onAgentToggle }: TopBarProps) {
  const { 
    assistant, 
    activeView, 
    setActiveView, 
    notifications,
    clearNotifications 
  } = useNovaStore();
  
  const views = [
    { id: 'command', label: 'COMMAND' },
    { id: 'brain', label: 'GRAPH' },
    { id: 'models', label: 'MODELS' },
    { id: 'computer_use', label: 'COMPUTER USE' },
    { id: 'agents', label: 'AGENTS' },
    { id: 'memory', label: 'MEMORY' },
    { id: 'settings', label: 'SETTINGS' },
  ];

  const stateBadges = {
    idle: { bg: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400', dot: 'bg-cyan-400', label: 'IDLE' },
    listening: { bg: 'bg-amber-500/20 border-amber-500 text-amber-400 shadow-[0_0_12px_rgba(255,184,0,0.4)]', dot: 'bg-amber-400 animate-ping', label: 'LISTENING (MIC)' },
    thinking: { bg: 'bg-violet-500/20 border-violet-500 text-violet-300 shadow-[0_0_12px_rgba(154,140,255,0.4)]', dot: 'bg-violet-400 animate-pulse', label: 'PROCESSING' },
    speaking: { bg: 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-[0_0_12px_rgba(0,255,163,0.4)]', dot: 'bg-emerald-400 animate-pulse', label: 'SPEAKING (TTS)' },
    error: { bg: 'bg-red-500/20 border-red-500 text-red-400', dot: 'bg-red-400', label: 'ERROR' },
  };

  const badge = stateBadges[assistant.state] || stateBadges.idle;

  return (
    <header className="h-11 glass-panel border-b border-nova-border/30 flex items-center justify-between px-4 z-20">
      {/* Left: Product Mark & Neural AI Core status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shadow-[0_0_12px_rgba(0,240,255,0.3)]" style={{ background: 'linear-gradient(135deg, #00F0FF 0%, #7928CA 100%)' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              <path d="M2 12h20" />
            </svg>
          </div>
          <span className="font-mono text-sm font-bold text-nova-text tracking-widest">ORBIT</span>
        </div>

        {/* Live Audio Sensory State Badge */}
        <div className={`hidden md:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border font-mono text-[9px] font-bold tracking-widest transition-all duration-300 ${badge.bg}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
          {badge.label}
        </div>
      </div>
      
      {/* Center: View Tabs */}
      <nav className="flex items-center gap-1" role="tablist">
        {views.map(view => (
          <button
            key={view.id}
            role="tab"
            aria-selected={activeView === view.id}
            onClick={() => setActiveView(view.id as any)}
            className={`px-3 py-1 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-all duration-200 ${
              activeView === view.id
                ? 'text-nova-cyan bg-nova-cyan/15 border border-nova-cyan/40 shadow-[0_0_15px_rgba(0,240,255,0.2)] font-bold'
                : 'text-nova-textDim/70 hover:text-nova-text hover:bg-nova-border/20'
            }`}
          >
            {view.label}
          </button>
        ))}
      </nav>
      
      {/* Right: Model, Voice & Session Controls */}
      <div className="flex items-center gap-2.5">
        <VoiceSelector />

        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 glass-panel rounded-lg border border-nova-border/30">
          <span className="font-mono text-[9px] text-nova-textDim uppercase tracking-wider">ROUTER</span>
          <select 
            value={assistant.model}
            onChange={(e) => {
              const val = e.target.value;
              useNovaStore.getState().updateAssistantMetrics({ model: val });
              // Also sync with backend router mode
              const mode = val.includes('Local') ? 'local_only' : val.includes('NVIDIA') ? 'cloud_only' : 'auto';
              fetch('/api/router/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ routing_mode: mode }),
              }).catch(() => {});
            }}
            className="bg-transparent border-none text-[10px] font-mono text-nova-cyan focus:outline-none cursor-pointer"
          >
            <option value="Hybrid Auto Router" className="bg-nova-bg text-nova-text">⚡ Hybrid Auto Router</option>
            <option value="Local Only (Ollama)" className="bg-nova-bg text-nova-text">🔒 Local Only (Ollama)</option>
            <option value="nvidia/nemotron-3-ultra-550b-a55b" className="bg-nova-bg text-nova-text">🚀 NVIDIA Nemotron 3 Ultra 550B</option>
          </select>
        </div>

        {/* Notifications */}
        <button
          onClick={clearNotifications}
          className="relative p-1.5 rounded-lg hover:bg-nova-border/30 transition-colors text-nova-textDim hover:text-nova-cyan"
          aria-label={`Notifications ${notifications > 0 ? `(${notifications})` : ''}`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {notifications > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-nova-red text-[8px] font-mono flex items-center justify-center text-white font-bold">
              {notifications}
            </span>
          )}
        </button>

        {/* Agent Drawer Toggle (mobile) */}
        {onAgentToggle && (
          <button
            onClick={onAgentToggle}
            className="agents-toggle p-1.5 rounded-lg hover:bg-nova-border/30 transition-colors text-nova-textDim hover:text-nova-cyan"
            aria-label="Toggle agents panel"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </button>
        )}

        {/* Operator Profile */}
        <div className="flex items-center gap-2 pl-1 border-l border-nova-border/30">
          <div className="w-6 h-6 rounded-full flex items-center justify-center font-mono text-[10px] font-bold text-white bg-gradient-to-tr from-nova-cyan to-nova-violet shadow-[0_0_8px_rgba(0,240,255,0.3)]">
            OP
          </div>
        </div>
      </div>
    </header>
  );
}
