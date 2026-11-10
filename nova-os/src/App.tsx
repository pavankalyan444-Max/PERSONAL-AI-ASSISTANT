import { useEffect, useState, useRef } from 'react';
import { useNovaStore } from './store/novaStore';
import { TopBar } from './components/TopBar';
import { ReactorCore } from './components/ReactorCore';
import { FileGraph3D } from './components/FileGraph3D';
import { AgentPanel } from './components/AgentPanel';
import { DetailSheet } from './components/DetailSheet';
import { CommandComposer } from './components/CommandComposer';
import { ProjectsView } from './components/views/ProjectsView';
import { AgentsView } from './components/views/AgentsView';
import { MemoryView } from './components/views/MemoryView';
import { SettingsView } from './components/views/SettingsView';
import { ModelManager } from './components/ModelManager';
import { ComputerUseView } from './components/views/ComputerUseView';
import './app-layout.css';

// Default scan root — Windows Desktop
const DEFAULT_DIR = 'C:\\Users\\gchat\\OneDrive\\Desktop';

function App() {
  const activeView = useNovaStore(s => s.activeView);
  const [isLoaded, setIsLoaded] = useState(false);
  const [agentDrawerOpen, setAgentDrawerOpen] = useState(false);
  const [scanDir, setScanDir] = useState(DEFAULT_DIR);
  const [inputDir, setInputDir] = useState(DEFAULT_DIR);
  const [dirBarOpen, setDirBarOpen] = useState(false);
  const detailsOpen = useNovaStore(s => s.graph.selectedNodeId !== null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* Boot */
  useEffect(() => {
    const t = setTimeout(() => setIsLoaded(true), 800);
    return () => clearTimeout(t);
  }, []);

  /* Keyboard shortcuts */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        (document.querySelector('textarea') as HTMLTextAreaElement)?.focus();
      }
      if (e.key === 'Escape') {
        useNovaStore.getState().setSelectedNode(null);
        useNovaStore.getState().setFocusNode(null);
        setAgentDrawerOpen(false);
        setDirBarOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function handleScanSubmit(e: React.FormEvent) {
    e.preventDefault();
    setScanDir(inputDir);
    setDirBarOpen(false);
  }

  return (
    <div className="app-root">
      {/* Loading */}
      {!isLoaded && (
        <div className="app-loading">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-6 relative">
              <div className="absolute inset-0 border-2 border-nova-cyan/20 rounded-full" />
              <div className="absolute inset-0 border-2 border-nova-cyan rounded-full animate-spin"
                style={{ borderTopColor: 'transparent', borderRightColor: 'transparent' }} />
              <div className="absolute inset-4 border-2 border-nova-violet/20 rounded-full" />
              <div className="absolute inset-4 border-2 border-nova-violet rounded-full animate-spin"
                style={{ borderBottomColor: 'transparent', borderLeftColor: 'transparent', animationDirection: 'reverse' }} />
            </div>
            <h1 className="font-mono text-lg text-nova-text tracking-wider">ORBIT</h1>
            <p className="font-mono text-xs text-nova-textDim/60 mt-2 uppercase tracking-wider">
              Initializing neural interface...
            </p>
            <div className="mt-6 w-48 mx-auto h-1 bg-nova-border/30 rounded-full overflow-hidden">
              <div className="h-full bg-nova-cyan animate-pulse" style={{ width: '100%' }} />
            </div>
          </div>
        </div>
      )}

      {isLoaded && (
        <div className="app-shell">
          {/* Top bar */}
          <TopBar onAgentToggle={() => setAgentDrawerOpen(o => !o)} />

          {/* Directory picker bar (slides down from top bar when open) */}
          {dirBarOpen && (
            <div className="relative z-30 glass-panel border-b border-nova-border/40 px-4 py-2">
              <form onSubmit={handleScanSubmit} className="flex items-center gap-3">
                <span className="font-mono text-[10px] text-nova-textDim uppercase tracking-wider whitespace-nowrap">
                  SCAN DIR
                </span>
                <input
                  ref={inputRef}
                  type="text"
                  value={inputDir}
                  onChange={e => setInputDir(e.target.value)}
                  autoFocus
                  spellCheck={false}
                  className="flex-1 min-w-0 bg-nova-bg/60 border border-nova-border/50 rounded px-3 py-1
                             font-mono text-xs text-nova-text focus:outline-none focus:border-nova-cyan/60"
                  placeholder="C:\Users\..."
                />
                <button
                  type="submit"
                  className="px-3 py-1 font-mono text-[10px] rounded border border-nova-cyan/40
                             text-nova-cyan hover:bg-nova-cyan/10 transition-colors uppercase tracking-wider"
                >
                  SCAN
                </button>
                <button
                  type="button"
                  onClick={() => setDirBarOpen(false)}
                  className="px-2 py-1 font-mono text-[10px] text-nova-textDim hover:text-nova-text"
                >
                  ✕
                </button>
              </form>
            </div>
          )}

          {/* View Routing */}
          {activeView === 'projects' ? (
            <main className="flex-1 overflow-hidden">
              <ProjectsView />
            </main>
          ) : activeView === 'models' ? (
            <main className="flex-1 overflow-hidden">
              <ModelManager />
            </main>
          ) : activeView === 'computer_use' ? (
            <main className="flex-1 overflow-hidden">
              <ComputerUseView />
            </main>
          ) : activeView === 'agents' ? (
            <main className="flex-1 overflow-hidden">
              <AgentsView />
            </main>
          ) : activeView === 'memory' ? (
            <main className="flex-1 overflow-hidden">
              <MemoryView />
            </main>
          ) : activeView === 'settings' ? (
            <main className="flex-1 overflow-hidden">
              <SettingsView />
            </main>
          ) : activeView === 'brain' ? (
            <main className="flex-1 overflow-hidden relative">
              <FileGraph3D
                rootDir={scanDir}
                onDirectoryChange={(newDir) => {
                  setScanDir(newDir);
                  setInputDir(newDir);
                }}
              />
            </main>
          ) : (
            /* Master Command Center (activeView === 'command') */
            <div className="main-grid">
              {/* LEFT: Reactor */}
              <section className="reactor-panel" aria-label="Reactor">
                <ReactorCore />
              </section>

              {/* CENTER: 3D File Graph */}
              <main className="brain-panel" aria-label="File System Graph">
                {/* Directory picker button — floating top-right inside the panel */}
                <button
                  onClick={() => setDirBarOpen(o => !o)}
                  className="absolute top-3 right-3 z-20 flex items-center gap-1.5 px-2.5 py-1
                             glass-panel rounded border border-nova-border/40 text-nova-textDim
                             hover:text-nova-cyan hover:border-nova-cyan/40 transition-colors"
                  title="Choose directory to scan"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                  <span className="font-mono text-[9px] uppercase tracking-wider">CHANGE DIR</span>
                </button>

                <FileGraph3D
                  rootDir={scanDir}
                  onDirectoryChange={(newDir) => {
                    setScanDir(newDir);
                    setInputDir(newDir);
                  }}
                />
              </main>

              {/* RIGHT: Agents */}
              <aside className="agents-panel" aria-label="Active Agents">
                <AgentPanel />
              </aside>
            </div>
          )}

          {/* Agent drawer overlay (narrow viewports) */}
          {agentDrawerOpen && (
            <div
              className="agent-drawer-overlay"
              onClick={() => setAgentDrawerOpen(false)}
              aria-hidden="true"
            />
          )}
          <aside
            className={`agent-drawer ${agentDrawerOpen ? 'agent-drawer--open' : ''}`}
            aria-label="Active Agents Drawer"
          >
            <AgentPanel />
          </aside>

          {/* Detail Sheet */}
          {detailsOpen && (
            <div className="detail-sheet-overlay">
              <DetailSheet />
            </div>
          )}

          {/* Mobile composer */}
          <div className="mobile-composer">
            <CommandComposer />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
