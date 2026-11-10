import { useState, useEffect } from 'react';
import type { RoutingMode, RouterConfig, ProviderHealth } from '../../types';

export function SettingsView() {
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [keySaved, setKeySaved] = useState(false);

  const [routerConfig, setRouterConfig] = useState<RouterConfig>({
    routing_mode: 'auto',
    complexity_threshold: 45,
    preferred_local_provider: 'ollama',
    preferred_local_model: 'qwen3.5:4b',
    preferred_nvidia_model: 'nvidia/nemotron-3-ultra-550b-a55b',
    ollama_host: 'http://localhost:11434',
    fallback_enabled: true,
    local_timeout_sec: 60,
    cloud_timeout_sec: 90,
  });

  const [providerHealth, setProviderHealth] = useState<ProviderHealth>({
    ollama: { available: false, models: [], count: 0, host: 'http://localhost:11434', error: null },
    nvidia: { available: false, configured: false, preferred_model: 'nvidia/nemotron-3-ultra-550b-a55b', error: null },
    telemetry: { platform: 'win32', cpu_count: 8, gpu_available: false, gpu_name: 'Scanning...', vram_gb: 0 },
  });

  // Fetch live backend router config & health
  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/router/config');
      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          setRouterConfig(prev => ({ ...prev, ...data.config }));
        }
        setProviderHealth({
          ollama: data.ollama || providerHealth.ollama,
          nvidia: data.nvidia || providerHealth.nvidia,
          telemetry: data.telemetry || providerHealth.telemetry,
        });
      }
    } catch {
      // Backend not currently responding
    }
  };

  const handleModeChange = async (mode: RoutingMode) => {
    const updated = { ...routerConfig, routing_mode: mode };
    setRouterConfig(updated);
    await saveConfig(updated);
  };

  const handleThresholdChange = async (val: number) => {
    const updated = { ...routerConfig, complexity_threshold: val };
    setRouterConfig(updated);
    await saveConfig(updated);
  };

  const handleSaveApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKeyInput.trim()) return;

    try {
      const res = await fetch('/api/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nvidia_api_key: apiKeyInput.trim() }),
      });
      if (res.ok) {
        setKeySaved(true);
        setApiKeyInput('');
        fetchConfig();
        setTimeout(() => setKeySaved(false), 3000);
      }
    } catch {
      // fallback
    }
  };

  const saveConfig = async (cfg: Partial<RouterConfig>) => {
    try {
      const res = await fetch('/api/router/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      });
      if (res.ok) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 2000);
      }
    } catch {
      // fallback
    }
  };

  return (
    <div className="h-full w-full overflow-y-auto p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="border-b border-nova-border/30 pb-4 flex items-center justify-between">
        <div>
          <h1 className="font-mono text-lg font-bold text-nova-text tracking-wider">
            HYBRID AI INTELLIGENCE ROUTER
          </h1>
          <p className="font-mono text-xs text-nova-textDim mt-1">
            Autonomous multi-tier task dispatch between Local Ollama and NVIDIA Cloud AI
          </p>
        </div>
        {savedSuccess && (
          <span className="font-mono text-[10px] px-2.5 py-1 rounded bg-nova-teal/15 border border-nova-teal/40 text-nova-teal animate-fade-in">
            ✓ CONFIG PERSISTED
          </span>
        )}
      </div>

      <div className="space-y-6">
        {/* 1. Routing Mode Matrix */}
        <div className="glass-panel p-5 rounded-2xl border border-nova-border/40 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-sm font-bold text-nova-cyan uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-nova-cyan animate-pulse" />
              TASK ROUTING GOVERNANCE
            </h2>
            <span className="font-mono text-[10px] text-nova-textDim uppercase">
              Current: <strong className="text-nova-cyan">{routerConfig.routing_mode.toUpperCase()}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                id: 'auto' as RoutingMode,
                title: '⚡ AUTO DISPATCH',
                badge: 'RECOMMENDED',
                desc: 'Intelligent multi-dimensional classifier. Small/everyday tasks stay local; complex architecture escalates to NVIDIA Cloud.',
              },
              {
                id: 'local_only' as RoutingMode,
                title: '🔒 LOCAL ONLY (AIR-GAPPED)',
                badge: '100% PRIVATE',
                desc: 'All queries execute strictly on your PC using Ollama or your custom local model. Never transmits data to the cloud.',
              },
              {
                id: 'cloud_only' as RoutingMode,
                title: '🚀 CLOUD ONLY (NVIDIA)',
                badge: 'MAX PERFORMANCE',
                desc: 'Directly routes all inquiries to NVIDIA Cloud NIM models for maximum reasoning depth and large context windows.',
              },
              {
                id: 'manual' as RoutingMode,
                title: '⚙️ MANUAL OVERRIDE',
                badge: 'EXPERT',
                desc: 'Enables explicit per-query or global provider selection without heuristic scoring.',
              },
            ].map(m => {
              const active = routerConfig.routing_mode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => handleModeChange(m.id)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    active
                      ? 'border-nova-cyan bg-nova-cyan/15 text-nova-cyan shadow-[0_0_20px_rgba(0,240,255,0.2)]'
                      : 'border-nova-border/30 bg-nova-bg/40 text-nova-textDim hover:border-nova-border/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-bold text-nova-text">{m.title}</span>
                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                      active ? 'border-nova-cyan bg-nova-cyan/20 text-nova-cyan' : 'border-nova-border/40 text-nova-textDim'
                    }`}>
                      {m.badge}
                    </span>
                  </div>
                  <p className="text-[10px] text-nova-textDim/80 leading-relaxed">{m.desc}</p>
                </button>
              );
            })}
          </div>

          {/* Complexity Threshold Slider (shown when in auto mode) */}
          {routerConfig.routing_mode === 'auto' && (
            <div className="p-4 rounded-xl bg-nova-bg/60 border border-nova-border/30 space-y-2 mt-2">
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="text-nova-text font-bold">Complexity Escalation Threshold</span>
                <span className="text-nova-cyan font-bold">{routerConfig.complexity_threshold} / 100</span>
              </div>
              <input
                type="range"
                min="10"
                max="90"
                value={routerConfig.complexity_threshold}
                onChange={e => handleThresholdChange(Number(e.target.value))}
                className="w-full accent-nova-cyan cursor-pointer"
              />
              <div className="flex justify-between font-mono text-[9px] text-nova-textDim">
                <span>0 (More Cloud)</span>
                <span>← Scores &le; {routerConfig.complexity_threshold} run Local | Scores &gt; {routerConfig.complexity_threshold} run NVIDIA →</span>
                <span>100 (More Local)</span>
              </div>
            </div>
          )}
        </div>

        {/* 2. Provider Health & Configuration Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* A. Local Ollama & Custom Model */}
          <div className="glass-panel p-5 rounded-2xl border border-nova-border/40 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-mono text-xs font-bold text-nova-amber uppercase tracking-wider flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${providerHealth.ollama.available ? 'bg-amber-400' : 'bg-red-400'}`} />
                LOCAL ENGINE (OLLAMA / CUSTOM)
              </h3>
              <span className={`px-2 py-0.5 rounded font-mono text-[9px] font-bold border ${
                providerHealth.ollama.available
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-red-500/20 text-red-400 border-red-500/40'
              }`}>
                {providerHealth.ollama.available ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div>
                <label className="text-[10px] text-nova-textDim uppercase block mb-1">Preferred Local Model</label>
                <select
                  value={routerConfig.preferred_local_model}
                  onChange={e => {
                    const updated = { ...routerConfig, preferred_local_model: e.target.value };
                    setRouterConfig(updated);
                    saveConfig(updated);
                  }}
                  className="w-full bg-nova-bg/70 border border-nova-border/40 rounded-xl px-3 py-2 text-xs font-mono text-nova-text focus:outline-none focus:border-nova-cyan/60"
                >
                  {providerHealth.ollama.models.length > 0 ? (
                    providerHealth.ollama.models.map(m => (
                      <option key={m} value={m} className="bg-nova-bg text-nova-text">{m}</option>
                    ))
                  ) : (
                    <>
                      <option value="llama3.1:8b" className="bg-nova-bg text-nova-text">llama3.1:8b</option>
                      <option value="mistral" className="bg-nova-bg text-nova-text">mistral</option>
                      <option value="custom_local" className="bg-nova-bg text-nova-text">custom_local_model.py</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-nova-textDim uppercase block mb-1">Ollama Host Endpoint</label>
                <input
                  type="text"
                  value={routerConfig.ollama_host}
                  onChange={e => setRouterConfig({ ...routerConfig, ollama_host: e.target.value })}
                  onBlur={() => saveConfig(routerConfig)}
                  className="w-full bg-nova-bg/70 border border-nova-border/40 rounded-xl px-3 py-2 text-xs font-mono text-nova-text focus:outline-none focus:border-nova-cyan/60"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-nova-bg/40 border border-nova-border/20 text-[10px] text-nova-textDim">
                💡 <strong className="text-nova-text">Custom Model Integration:</strong> Place your weights or inference script in <code className="text-nova-amber">custom_local_model.py</code> to run native PyTorch / GGUF directly.
              </div>
            </div>
          </div>

          {/* B. NVIDIA Cloud AI */}
          <div className="glass-panel p-5 rounded-2xl border border-nova-border/40 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-mono text-xs font-bold text-nova-violet uppercase tracking-wider flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${providerHealth.nvidia.configured ? 'bg-violet-400' : 'bg-red-400'}`} />
                NVIDIA CLOUD ACCELERATION
              </h3>
              <span className={`px-2 py-0.5 rounded font-mono text-[9px] font-bold border ${
                providerHealth.nvidia.configured
                  ? 'bg-violet-500/20 text-violet-300 border-violet-500/40'
                  : 'bg-red-500/20 text-red-400 border-red-500/40'
              }`}>
                {providerHealth.nvidia.configured ? 'CONFIGURED' : 'KEY MISSING'}
              </span>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div>
                <label className="text-[10px] text-nova-textDim uppercase block mb-1">NVIDIA NIM Model</label>
                <select
                  value={routerConfig.preferred_nvidia_model}
                  onChange={e => {
                    const updated = { ...routerConfig, preferred_nvidia_model: e.target.value };
                    setRouterConfig(updated);
                    saveConfig(updated);
                  }}
                  className="w-full bg-nova-bg/70 border border-nova-border/40 rounded-xl px-3 py-2 text-xs font-mono text-nova-text focus:outline-none focus:border-nova-cyan/60"
                >
                  <option value="nvidia/nemotron-3-ultra-550b-a55b" className="bg-nova-bg text-nova-text">nvidia/nemotron-3-ultra-550b-a55b (Nemotron 3 Ultra 550B)</option>
                  <option value="deepseek-ai/deepseek-r1" className="bg-nova-bg text-nova-text">deepseek-ai/deepseek-r1</option>
                  <option value="meta/llama-3.1-70b-instruct" className="bg-nova-bg text-nova-text">meta/llama-3.1-70b-instruct</option>
                  <option value="mistralai/mixtral-8x22b-instruct" className="bg-nova-bg text-nova-text">mistralai/mixtral-8x22b-instruct</option>
                </select>
              </div>

              {/* Secure API Key Storage */}
              <form onSubmit={handleSaveApiKey} className="space-y-2">
                <label className="text-[10px] text-nova-textDim uppercase block">Update NVIDIA API Key</label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder={providerHealth.nvidia.configured ? '••••••••••••••••••••' : 'nvapi-...'}
                    value={apiKeyInput}
                    onChange={e => setApiKeyInput(e.target.value)}
                    className="flex-1 bg-nova-bg/70 border border-nova-border/40 rounded-xl px-3 py-2 text-xs font-mono text-nova-text focus:outline-none focus:border-nova-cyan/60"
                  />
                  <button
                    type="submit"
                    disabled={!apiKeyInput.trim()}
                    className="px-3 py-2 rounded-xl border border-violet-500/40 bg-violet-500/20 text-violet-300 font-mono text-[10px] font-bold hover:bg-violet-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    SAVE KEY
                  </button>
                </div>
                {keySaved && (
                  <span className="text-nova-teal text-[10px] font-mono block">
                    ✓ Key encrypted into local vault (.orbit_config.json)
                  </span>
                )}
              </form>

              <div className="p-2.5 rounded-lg bg-nova-bg/40 border border-nova-border/20 text-[10px] text-nova-textDim">
                🔒 <strong className="text-nova-text">Zero Frontend Exposure:</strong> Your NVIDIA API key is stored exclusively in backend vault storage and never leaks to browser logs or client bundles.
              </div>
            </div>
          </div>
        </div>

        {/* 3. Hardware & Telemetry */}
        <div className="glass-panel p-5 rounded-2xl border border-nova-border/40 space-y-4">
          <h2 className="font-mono text-sm font-bold text-nova-cyan uppercase tracking-wider flex items-center justify-between">
            <span>LOCAL HARDWARE & ACCELERATION TELEMETRY</span>
            <span className="text-[10px] text-nova-textDim">AUTO-DETECTED</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
            <div className="p-3 rounded-xl bg-nova-bg/50 border border-nova-border/30">
              <span className="text-nova-textDim text-[10px] block mb-1">PLATFORM</span>
              <span className="text-nova-text font-bold uppercase">{providerHealth.telemetry.platform}</span>
            </div>
            <div className="p-3 rounded-xl bg-nova-bg/50 border border-nova-border/30">
              <span className="text-nova-textDim text-[10px] block mb-1">CPU CORES</span>
              <span className="text-nova-text font-bold">{providerHealth.telemetry.cpu_count} Threads</span>
            </div>
            <div className="p-3 rounded-xl bg-nova-bg/50 border border-nova-border/30">
              <span className="text-nova-textDim text-[10px] block mb-1">GPU ACCELERATION</span>
              <span className={providerHealth.telemetry.gpu_available ? 'text-nova-teal font-bold' : 'text-nova-text font-bold'}>
                {providerHealth.telemetry.gpu_available ? 'CUDA ACTIVE' : 'OPENGL / VULKAN'}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-nova-bg/50 border border-nova-border/30">
              <span className="text-nova-textDim text-[10px] block mb-1">DETECTED GPU</span>
              <span className="text-nova-cyan font-bold truncate block" title={providerHealth.telemetry.gpu_name}>
                {providerHealth.telemetry.gpu_name}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
