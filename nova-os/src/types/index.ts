export type AssistantState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

export type NodeType = 
  | 'note' 
  | 'document' 
  | 'idea' 
  | 'project' 
  | 'task' 
  | 'person' 
  | 'conversation' 
  | 'memory' 
  | 'agent';

export type GraphMode = 'force' | 'timeline' | 'semantic' | 'focus';

export type FilterType = 'all' | 'notes' | 'projects' | 'tasks' | 'people' | 'documents' | 'conversations' | 'agents' | 'recent' | 'important';

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface NodeData {
  id: string;
  type: NodeType;
  title: string;
  summary: string;
  content?: string;
  tags: string[];
  position: Vector3;
  velocity: Vector3;
  color: string;
  size: number;
  opacity: number;
  createdAt: string;
  updatedAt: string;
  sourceUrl?: string;
  relationships: string[];
  backlinks: string[];
  importance: number;
  projectId?: string;
  assignee?: string;
  dueDate?: string;
  // Runtime-only values used by the force simulation.
  x?: number;
  y?: number;
  z?: number;
  vx?: number;
  vy?: number;
  vz?: number;
  fx?: number;
  fy?: number;
  fz?: number;
}

export interface LinkData {
  id: string;
  source: string;
  target: string;
  type: string;
  strength: number;
  color: string;
}

export interface AgentData {
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
  steps: AgentStep[];
  artifacts: Artifact[];
  linkedNodes: string[];
}

export interface AgentStep {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: string | null;
}

export interface Artifact {
  id: string;
  type: 'file' | 'link' | 'code' | 'document';
  title: string;
  url?: string;
  preview?: string;
}

export interface ActivityLog {
  id: string;
  agentId: string;
  agentName: string;
  message: string;
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'waiting';
  relatedNodes?: string[];
}

export interface GraphState {
  nodes: Map<string, NodeData>;
  links: Map<string, LinkData>;
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  mode: GraphMode;
  filter: FilterType;
  searchQuery: string;
  focusNodeId: string | null;
  cameraPosition: Vector3;
  cameraTarget: Vector3;
}

export interface AssistantStateData {
  state: AssistantState;
  name: string;
  model: string;
  memoryUsage: number;
  latency: number;
  uptime: number;
  connected: boolean;
  audioLevel: number;
}

export interface AppState {
  assistant: AssistantStateData;
  graph: GraphState;
  agents: Map<string, AgentData>;
  activities: ActivityLog[];
  activeView: 'command' | 'brain' | 'projects' | 'agents' | 'memory' | 'computer_use' | 'models' | 'settings';
  audioInput: 'none' | 'listening' | 'processing';
  notifications: number;
}

export type RoutingMode = 'auto' | 'local_only' | 'cloud_only' | 'manual';
export type InferenceProvider = 'local' | 'nvidia';

export interface RoutingInfo {
  mode: RoutingMode;
  complexity_score?: number;
  reasons?: string[];
  decision?: string;
  fallback_triggered?: boolean;
}

export interface RouterConfig {
  routing_mode: RoutingMode;
  complexity_threshold: number;
  preferred_local_provider: string;
  preferred_local_model: string;
  preferred_nvidia_model: string;
  ollama_host: string;
  fallback_enabled: boolean;
  local_timeout_sec: number;
  cloud_timeout_sec: number;
}

export interface ProviderHealth {
  ollama: {
    available: boolean;
    models: string[];
    count: number;
    host: string;
    error: string | null;
  };
  nvidia: {
    available: boolean;
    configured: boolean;
    preferred_model: string;
    error: string | null;
  };
  telemetry: {
    platform: string;
    cpu_count: number;
    gpu_available: boolean;
    gpu_name: string;
    vram_gb: number;
  };
}
