import { useState, useEffect } from 'react';
import { useNovaStore } from '../../store/novaStore';

interface LiveAgent {
  id: string;
  number: number;
  name: string;
  role: string;
  status: 'idle' | 'working' | 'waiting' | 'completed' | 'error';
  assignment: string;
  model: string;
  tools: string[];
  progress: number;
  lastActivity: string;
  goal: string;
}

interface ActivityItem {
  id: number;
  agent_name: string;
  activity_type: string;
  message: string;
  timestamp: number;
}

export function AgentsView() {
  const { agents: storeAgents } = useNovaStore();
  const [agents, setAgents] = useState<LiveAgent[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  const fetchFleet = async () => {
    try {
      const res = await fetch('/api/agents');
      if (res.ok) {
        const data = await res.json();
        if (data.agents && data.agents.length > 0) {
          setAgents(data.agents);
        }
        if (data.activities) {
          setActivities(data.activities);
        }
      }
    } catch {
      // fallback to store
    }
  };

  useEffect(() => {
    fetchFleet();
    const interval = setInterval(fetchFleet, 3000);
    return () => clearInterval(interval);
  }, []);

  const displayList = agents.length > 0 ? agents : Array.from(storeAgents.values());

  return (
    <div className="h-full w-full overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-nova-border/30 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-nova-cyan animate-pulse shadow-[0_0_10px_#00F0FF]" />
            <h1 className="font-mono text-lg font-bold text-nova-text tracking-wider">AUTONOMOUS MULTI-AGENT FLEET</h1>
          </div>
          <p className="font-mono text-xs text-nova-textDim mt-1">
            Supervisor cognitive pipeline • Directed Acyclic Graph (DAG) orchestration • Ground-truth verification
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 rounded-lg glass-panel border border-nova-cyan/40 font-mono text-xs text-nova-cyan">
            {displayList.length} AGENTS ONLINE
          </span>
          <button
            onClick={fetchFleet}
            className="px-2.5 py-1 rounded-lg border border-nova-border/40 hover:bg-nova-border/20 text-nova-textDim text-xs font-mono transition-colors"
          >
            ↻ REFRESH
          </button>
        </div>
      </div>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {displayList.map((agent: any) => (
          <div
            key={agent.id}
            className="glass-panel p-5 rounded-2xl border border-nova-border/40 hover:border-nova-cyan/40 transition-all duration-300 space-y-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-nova-cyan/15 border border-nova-cyan/40 flex items-center justify-center font-mono font-bold text-nova-cyan text-base">
                  0{agent.number || 1}
                </div>
                <div>
                  <h3 className="font-mono text-sm font-bold text-nova-text">{agent.name}</h3>
                  <span className="text-[10px] font-mono text-nova-textDim uppercase tracking-wider">{agent.role}</span>
                </div>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-mono tracking-wider uppercase border ${
                agent.status === 'working' ? 'bg-nova-cyan/15 border-nova-cyan text-nova-cyan animate-pulse' :
                agent.status === 'completed' ? 'bg-nova-teal/15 border-nova-teal text-nova-teal' :
                agent.status === 'error' ? 'bg-red-500/15 border-red-500 text-red-400' :
                'bg-nova-textDim/15 border-nova-textDim text-nova-textDim'
              }`}>
                {agent.status}
              </span>
            </div>

            <div>
              <div className="text-[10px] font-mono text-nova-textDim/70 uppercase tracking-wider">ACTIVE DIRECTIVE</div>
              <p className="text-xs text-nova-text mt-1 leading-relaxed">{agent.assignment}</p>
            </div>

            {agent.goal && (
              <div>
                <div className="text-[10px] font-mono text-nova-textDim/70 uppercase tracking-wider">PRIMARY GOAL</div>
                <p className="text-xs text-nova-textDim mt-0.5 leading-relaxed">{agent.goal}</p>
              </div>
            )}

            {/* Tools badge list */}
            {agent.tools && agent.tools.length > 0 && (
              <div>
                <div className="text-[10px] font-mono text-nova-textDim/70 uppercase tracking-wider mb-1.5">CAPABILITIES & TOOLS</div>
                <div className="flex flex-wrap gap-1.5">
                  {agent.tools.map((t: string) => (
                    <span key={t} className="px-2 py-0.5 rounded text-[9px] font-mono bg-nova-bg border border-nova-border/30 text-nova-cyan/80">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Progress bar */}
            <div>
              <div className="flex justify-between font-mono text-[10px] text-nova-textDim mb-1">
                <span>TASK COMPLETION</span>
                <span>{Math.round((agent.progress || 1.0) * 100)}%</span>
              </div>
              <div className="h-1.5 bg-nova-bg rounded-full overflow-hidden border border-nova-border/40">
                <div
                  className="h-full bg-gradient-to-r from-nova-cyan to-nova-teal transition-all duration-500"
                  style={{ width: `${(agent.progress || 1.0) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Live Activity Timeline */}
      {activities.length > 0 && (
        <div className="glass-panel p-5 rounded-2xl border border-nova-border/40 space-y-3">
          <div className="flex items-center gap-2 border-b border-nova-border/30 pb-3">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="font-mono text-xs font-bold text-nova-text uppercase tracking-wider">LIVE COGNITIVE TIMELINE & EVENT BUS</h3>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto font-mono text-xs">
            {activities.slice(0, 15).map((act) => (
              <div key={act.id} className="flex items-start gap-2.5 text-nova-textDim">
                <span className="text-[10px] text-nova-cyan/70 whitespace-nowrap">
                  {new Date(act.timestamp * 1000).toLocaleTimeString()}
                </span>
                <span className="font-bold text-nova-text whitespace-nowrap">[{act.agent_name}]:</span>
                <span className="text-nova-text/90 break-words">{act.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
