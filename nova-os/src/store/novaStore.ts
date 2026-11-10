import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type {
  AppState,
  AssistantState,
  AssistantStateData,
  NodeData,
  LinkData,
  AgentData,
  ActivityLog,
  FilterType,
  GraphMode,
  NodeType,
} from '../types';
import { demoNodes, demoLinks, demoAgents, demoActivities, initialAssistantState, initialGraphState } from '../data/demoData';

interface NovaStore extends AppState {
  // Assistant actions
  setAssistantState: (state: AssistantState) => void;
  setAudioLevel: (level: number) => void;
  updateAssistantMetrics: (metrics: Partial<AssistantStateData>) => void;
  
  // Graph actions
  setGraphMode: (mode: GraphMode) => void;
  setFilter: (filter: FilterType) => void;
  setSearchQuery: (query: string) => void;
  setSelectedNode: (nodeId: string | null) => void;
  setHoveredNode: (nodeId: string | null) => void;
  setFocusNode: (nodeId: string | null) => void;
  updateCamera: (position: { x: number; y: number; z: number }, target?: { x: number; y: number; z: number }) => void;
  addNode: (node: NodeData) => void;
  updateNode: (id: string, updates: Partial<NodeData>) => void;
  removeNode: (id: string) => void;
  addLink: (link: LinkData) => void;
  removeLink: (id: string) => void;
  
  // Agent actions
  setAgentStatus: (agentId: string, status: AgentData['status']) => void;
  updateAgentProgress: (agentId: string, progress: number) => void;
  addAgentActivity: (activity: ActivityLog) => void;
  
  // UI actions
  setActiveView: (view: AppState['activeView']) => void;
  setAudioInput: (input: AppState['audioInput']) => void;
  incrementNotifications: () => void;
  clearNotifications: () => void;
  
  // Reset
  resetToDefaults: () => void;
}

const initialState: AppState = {
  assistant: initialAssistantState,
  graph: {
    nodes: new Map(demoNodes.map(n => [n.id, n])),
    links: new Map(demoLinks.map(l => [l.id, l])),
    selectedNodeId: null,
    hoveredNodeId: null,
    ...initialGraphState,
  },
  agents: new Map(demoAgents.map(a => [a.id, a])),
  activities: demoActivities,
  activeView: 'command',
  audioInput: 'none',
  notifications: 0,
};

export const useNovaStore = create<NovaStore>()(
  subscribeWithSelector((set) => ({
    ...initialState,
    
    // Assistant actions
    setAssistantState: (state) => set((s) => ({
      assistant: { ...s.assistant, state },
    })),
    
    setAudioLevel: (level) => set((s) => ({
      assistant: { ...s.assistant, audioLevel: Math.max(0, Math.min(1, level)) },
    })),
    
    updateAssistantMetrics: (metrics) => set((s) => ({
      assistant: { ...s.assistant, ...metrics },
    })),
    
    // Graph actions
    setGraphMode: (mode) => set((s) => ({
      graph: { ...s.graph, mode },
    })),
    
    setFilter: (filter) => set((s) => ({
      graph: { ...s.graph, filter },
    })),
    
    setSearchQuery: (query) => set((s) => ({
      graph: { ...s.graph, searchQuery: query },
    })),
    
    setSelectedNode: (nodeId) => set((s) => ({
      graph: { ...s.graph, selectedNodeId: nodeId },
    })),
    
    setHoveredNode: (nodeId) => set((s) => ({
      graph: { ...s.graph, hoveredNodeId: nodeId },
    })),
    
    setFocusNode: (nodeId) => set((s) => ({
      graph: { ...s.graph, focusNodeId: nodeId },
    })),
    
    updateCamera: (position, target) => set((s) => ({
      graph: {
        ...s.graph,
        cameraPosition: position,
        cameraTarget: target ?? s.graph.cameraTarget,
      },
    })),
    
    addNode: (node) => set((s) => {
      const newNodes = new Map(s.graph.nodes);
      newNodes.set(node.id, node);
      return { graph: { ...s.graph, nodes: newNodes } };
    }),
    
    updateNode: (id, updates) => set((s) => {
      const node = s.graph.nodes.get(id);
      if (!node) return s;
      const newNodes = new Map(s.graph.nodes);
      newNodes.set(id, { ...node, ...updates });
      return { graph: { ...s.graph, nodes: newNodes } };
    }),
    
    removeNode: (id) => set((s) => {
      const newNodes = new Map(s.graph.nodes);
      newNodes.delete(id);
      const newLinks = new Map(s.graph.links);
      // Remove links connected to this node
      for (const [linkId, link] of newLinks) {
        if (link.source === id || link.target === id) {
          newLinks.delete(linkId);
        }
      }
      return { graph: { ...s.graph, nodes: newNodes, links: newLinks } };
    }),
    
    addLink: (link) => set((s) => {
      const newLinks = new Map(s.graph.links);
      newLinks.set(link.id, link);
      return { graph: { ...s.graph, links: newLinks } };
    }),
    
    removeLink: (id) => set((s) => {
      const newLinks = new Map(s.graph.links);
      newLinks.delete(id);
      return { graph: { ...s.graph, links: newLinks } };
    }),
    
    // Agent actions
    setAgentStatus: (agentId, status) => set((s) => {
      const agent = s.agents.get(agentId);
      if (!agent) return s;
      const newAgents = new Map(s.agents);
      newAgents.set(agentId, { ...agent, status, lastActivity: new Date().toISOString() });
      return { agents: newAgents };
    }),
    
    updateAgentProgress: (agentId, progress) => set((s) => {
      const agent = s.agents.get(agentId);
      if (!agent) return s;
      const newAgents = new Map(s.agents);
      newAgents.set(agentId, { ...agent, progress: Math.max(0, Math.min(1, progress)) });
      return { agents: newAgents };
    }),
    
    addAgentActivity: (activity) => set((s) => ({
      activities: [activity, ...s.activities].slice(0, 100),
      notifications: s.activeView !== 'agents' ? s.notifications + 1 : s.notifications,
    })),
    
    // UI actions
    setActiveView: (view) => set((s) => ({
      activeView: view,
      notifications: view === 'agents' ? 0 : s.notifications,
    })),
    
    setAudioInput: (input) => set(() => ({ audioInput: input })),
    
    incrementNotifications: () => set((s) => ({
      notifications: s.notifications + 1,
    })),
    
    clearNotifications: () => set(() => ({ notifications: 0 })),
    
    resetToDefaults: () => set(initialState),
  }))
);

// Selectors for common derived state
export const useFilteredNodes = () => {
  const { graph } = useNovaStore();
  const { nodes, filter, searchQuery, focusNodeId } = graph;
  
  let filtered = Array.from(nodes.values());
  
  // Apply filter
  if (filter !== 'all') {
    const typeFilters: Partial<Record<FilterType, NodeType>> = {
      notes: 'note',
      projects: 'project',
      tasks: 'task',
      people: 'person',
      documents: 'document',
      conversations: 'conversation',
      agents: 'agent',
    };
    const nodeType = typeFilters[filter];
    if (nodeType) filtered = filtered.filter((node) => node.type === nodeType);
    if (filter === 'recent') filtered = filtered.filter((node) => Date.now() - new Date(node.updatedAt).getTime() < 7 * 86400000);
    if (filter === 'important') filtered = filtered.filter((node) => node.importance >= 7);
  }
  
  // Apply search
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(n => 
      n.title.toLowerCase().includes(q) ||
      n.summary.toLowerCase().includes(q) ||
      n.tags.some(t => t.toLowerCase().includes(q))
    );
  }
  
  // Focus mode
  if (focusNodeId) {
    const focusNode = nodes.get(focusNodeId);
    if (focusNode) {
      const relatedIds = new Set([focusNodeId, ...focusNode.relationships, ...focusNode.backlinks]);
      filtered = filtered.filter(n => relatedIds.has(n.id));
    }
  }
  
  return filtered;
};

export const useVisibleLinks = () => {
  const { graph } = useNovaStore();
  const filteredNodeIds = new Set(useFilteredNodes().map(n => n.id));
  
  return Array.from(graph.links.values()).filter(
    l => filteredNodeIds.has(l.source) && filteredNodeIds.has(l.target)
  );
};

export const useSelectedNode = () => {
  const { graph } = useNovaStore();
  return graph.selectedNodeId ? graph.nodes.get(graph.selectedNodeId) || null : null;
};

export const useHoveredNode = () => {
  const { graph } = useNovaStore();
  return graph.hoveredNodeId ? graph.nodes.get(graph.hoveredNodeId) || null : null;
};

export const useActiveAgents = () => {
  const { agents } = useNovaStore();
  return Array.from(agents.values()).sort((a, b) => a.number - b.number);
};

export const useRecentActivities = (limit = 20) => {
  const { activities } = useNovaStore();
  return activities.slice(0, limit);
};

export const useAssistant = () => {
  const { assistant, setAssistantState, setAudioLevel, updateAssistantMetrics } = useNovaStore();
  return { assistant, setAssistantState, setAudioLevel, updateAssistantMetrics };
};

export const useGraph = () => {
  const { graph, setGraphMode, setFilter, setSearchQuery, setSelectedNode, setHoveredNode, setFocusNode, updateCamera, addNode, updateNode, removeNode, addLink, removeLink } = useNovaStore();
  return { graph, setGraphMode, setFilter, setSearchQuery, setSelectedNode, setHoveredNode, setFocusNode, updateCamera, addNode, updateNode, removeNode, addLink, removeLink };
};

export const useAgents = () => {
  const { agents, setAgentStatus, updateAgentProgress, addAgentActivity } = useNovaStore();
  return { agents, setAgentStatus, updateAgentProgress, addAgentActivity };
};

export const useUI = () => {
  const { activeView, audioInput, notifications, setActiveView, setAudioInput, incrementNotifications, clearNotifications } = useNovaStore();
  return { activeView, audioInput, notifications, setActiveView, setAudioInput, incrementNotifications, clearNotifications };
};
