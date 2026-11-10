import { useState } from 'react';
import { useActiveAgents, useRecentActivities, useNovaStore } from '../store/novaStore';
import { formatTimestamp } from '../utils/format';
import { CommandComposer } from './CommandComposer';
import type { ActivityLog, AgentData } from '../types';

const statusBadges: Record<AgentData['status'], { badge: string; dot: string; label: string }> = {
  idle:      { badge: 'bg-nova-bg/60 border-nova-border/40 text-nova-textDim', dot: 'bg-nova-textDim', label: 'IDLE' },
  working:   { badge: 'bg-nova-cyan/15 border-nova-cyan/50 text-nova-cyan shadow-[0_0_8px_rgba(0,240,255,0.2)]', dot: 'bg-nova-cyan animate-pulse', label: 'WORKING' },
  waiting:   { badge: 'bg-nova-violet/15 border-nova-violet/50 text-nova-violet', dot: 'bg-nova-violet', label: 'WAITING' },
  completed: { badge: 'bg-nova-teal/15 border-nova-teal/50 text-nova-teal', dot: 'bg-nova-teal', label: 'DONE' },
  error:     { badge: 'bg-nova-red/15 border-nova-red/50 text-nova-red animate-pulse', dot: 'bg-nova-red', label: 'ERROR' },
};

const activityIcons: Record<ActivityLog['type'], { color: string; bg: string }> = {
  info:    { color: 'text-nova-cyan', bg: 'bg-nova-cyan/15 border-nova-cyan/30' },
  success: { color: 'text-nova-teal', bg: 'bg-nova-teal/15 border-nova-teal/30' },
  warning: { color: 'text-nova-amber', bg: 'bg-nova-amber/15 border-nova-amber/30' },
  error:   { color: 'text-nova-red', bg: 'bg-nova-red/15 border-nova-red/30' },
  waiting: { color: 'text-nova-violet', bg: 'bg-nova-violet/15 border-nova-violet/30' },
};

export function AgentPanel() {
  const agents = useActiveAgents();
  const activities = useRecentActivities(12);
  const [filter, setFilter] = useState<string>('all');
  const { setAgentStatus, addAgentActivity } = useNovaStore();

  const filteredAgents = filter === 'all' ? agents : agents.filter(a => a.status === filter);

  const handleToggleAgent = (agent: AgentData) => {
    const nextStatus = agent.status === 'working' ? 'idle' : 'working';
    setAgentStatus(agent.id, nextStatus);
    addAgentActivity({
      id: `act-${Date.now()}`,
      agentId: agent.id,
      agentName: agent.name,
      message: `Agent ${agent.name} status switched to ${nextStatus.toUpperCase()}`,
      timestamp: new Date().toISOString(),
      type: nextStatus === 'working' ? 'info' : 'warning',
    });
  };

  return (
    <div className="flex flex-col h-full glass-panel border-l border-nova-border/30 bg-nova-bg/40">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-nova-border/30">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-nova-cyan animate-pulse shadow-[0_0_6px_#00F0FF]" />
          <span className="font-mono text-xs font-semibold text-nova-text tracking-wider">ACTIVE AGENTS</span>
          <span className="px-2 py-0.5 text-[9px] font-mono rounded bg-nova-cyan/15 text-nova-cyan border border-nova-cyan/30 font-bold">
            {agents.length}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="glass-panel rounded-lg border border-nova-border/40 px-2 py-1 text-[10px] font-mono text-nova-text bg-nova-bgElevated/90 focus:outline-none"
          >
            <option value="all">All States</option>
            <option value="working">Working</option>
            <option value="waiting">Waiting</option>
            <option value="idle">Idle</option>
          </select>
        </div>
      </div>
      
      {/* Agent List */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
        {filteredAgents.map(agent => (
          <div
            key={agent.id}
            className="glass-panel rounded-xl border border-nova-border/40 p-3 hover:border-nova-cyan/40 transition-all duration-200 group"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-nova-cyan/10 border border-nova-cyan/30 flex items-center justify-center font-mono font-bold text-xs text-nova-cyan flex-shrink-0">
                  0{agent.number}
                </div>
                <div className="min-w-0">
                  <div className="font-mono text-xs font-bold text-nova-text truncate">{agent.name}</div>
                  <div className="text-[10px] text-nova-textDim/80 truncate leading-tight mt-0.5">{agent.assignment}</div>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className={`px-2 py-0.5 rounded-full text-[8px] font-mono font-bold tracking-wider border ${statusBadges[agent.status].badge}`}>
                  <span className={`inline-block w-1 h-1 rounded-full mr-1 ${statusBadges[agent.status].dot}`} />
                  {statusBadges[agent.status].label}
                </span>
              </div>
            </div>

            {/* Execution Progress Bar */}
            <div className="mt-2.5">
              <div className="flex justify-between text-[9px] font-mono text-nova-textDim/80 mb-1">
                <span>EXECUTION</span>
                <span>{Math.round(agent.progress * 100)}%</span>
              </div>
              <div className="h-1 bg-nova-bg rounded-full overflow-hidden border border-nova-border/30">
                <div
                  className="h-full bg-gradient-to-r from-nova-cyan to-nova-teal transition-all duration-500 ease-out"
                  style={{ width: `${agent.progress * 100}%` }}
                />
              </div>
            </div>

            {/* Controls */}
            <div className="mt-2.5 pt-2 border-t border-nova-border/20 flex items-center justify-between text-[9px] font-mono">
              <span className="text-nova-textDim/60">{agent.model}</span>
              <button
                onClick={() => handleToggleAgent(agent)}
                className={`px-2 py-0.5 rounded border transition-colors ${
                  agent.status === 'working'
                    ? 'border-nova-red/40 text-nova-red hover:bg-nova-red/10'
                    : 'border-nova-cyan/40 text-nova-cyan hover:bg-nova-cyan/10'
                }`}
              >
                {agent.status === 'working' ? 'PAUSE' : 'ACTIVATE'}
              </button>
            </div>
          </div>
        ))}
      </div>
      
      {/* Activity Feed Section */}
      <div className="border-t border-nova-border/30 px-3 py-2.5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 font-mono text-[10px] text-nova-textDim uppercase tracking-wider font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-nova-teal" />
            TELEMETRY FEED
          </div>
          <span className="px-1.5 py-0.2 rounded text-[8px] font-mono bg-nova-teal/15 text-nova-teal border border-nova-teal/30">
            LIVE
          </span>
        </div>
        <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
          {activities.map(act => (
            <div key={act.id} className="p-2 rounded-lg bg-nova-bg/50 border border-nova-border/25 text-[10px] font-mono flex items-start gap-2">
              <span className={`px-1 rounded text-[8px] uppercase tracking-wider mt-0.5 font-bold ${activityIcons[act.type].bg} ${activityIcons[act.type].color}`}>
                {act.type}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-nova-text leading-snug line-clamp-2">{act.message}</p>
                <span className="text-nova-textDim/50 text-[9px] mt-0.5 block">{formatTimestamp(act.timestamp)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Voice-Reactive AI Command Composer */}
      <CommandComposer />
    </div>
  );
}
