import { useState, useEffect } from 'react';

interface ModelRoleItem {
  tag: string;
  resolved_tag?: string;
  name: string;
  role: string;
  installed: boolean;
  status: string;
  loaded_in_vram: boolean;
  provider: string;
  vram_gb: number;
  storage_path: string;
}

interface HardwareTelemetry {
  gpu_name: string;
  gpu_available: boolean;
  vram_total_mb: number;
  vram_used_mb: number;
  vram_free_mb: number;
  vram_percent: number;
  gpu_util_percent: number;
  gpu_temp_c: number;
  cpu_percent: number;
  ram_total_gb: number;
  ram_used_gb: number;
  ram_percent: number;
  d_drive?: {
    configured_path: string;
    exists: boolean;
    total_gb: number;
    free_gb: number;
    used_gb: number;
    used_percent: number;
  };
}

export function ModelManager() {
  const [catalog, setCatalog] = useState<Record<string, ModelRoleItem>>({});
  const [telemetry, setTelemetry] = useState<HardwareTelemetry | null>(null);
  const [ollamaOnline, setOllamaOnline] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const [resStatus, resTelem] = await Promise.all([
        fetch('/api/models/status'),
        fetch('/api/models/telemetry')
      ]);

      if (resStatus.ok) {
        const data = await resStatus.json();
        setCatalog(data.catalog || {});
        setOllamaOnline(data.ollama_online || false);
      }

      if (resTelem.ok) {
        const telem = await resTelem.json();
        setTelemetry(telem);
      }
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3500);
    return () => clearInterval(interval);
  }, []);

  const dDrive = telemetry?.d_drive;

  return (
    <div className="h-full w-full overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-nova-border/30 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-nova-cyan animate-pulse shadow-[0_0_10px_#00F0FF]" />
            <h1 className="font-mono text-lg font-bold text-nova-text tracking-wider">AI MODEL MANAGER & HARDWARE GOVERNOR</h1>
          </div>
          <p className="font-mono text-xs text-nova-textDim mt-1">
            Dynamic Ollama role orchestration • NVIDIA RTX 5070 VRAM Governor • Storage: D:\ORBIT\Models
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border ${
            ollamaOnline ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400' : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
          }`}>
            {ollamaOnline ? 'OLLAMA DAEMON ACTIVE' : 'OLLAMA STANDBY / DOWNLOADING'}
          </span>
          <button
            onClick={fetchStatus}
            disabled={loading}
            className="px-3 py-1 rounded-lg border border-nova-border/40 hover:bg-nova-border/20 text-nova-textDim text-xs font-mono transition-colors"
          >
            {loading ? 'CHECKING...' : '↻ REFRESH'}
          </button>
        </div>
      </div>

      {/* Hardware Telemetry Strip (RTX 5070 - 8GB VRAM) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* GPU & VRAM */}
        <div className="glass-panel p-4 rounded-xl border border-nova-border/40 space-y-2">
          <div className="flex items-center justify-between text-[10px] font-mono text-nova-textDim uppercase">
            <span>GPU ENGINE</span>
            <span className="text-nova-cyan font-bold">{telemetry?.gpu_temp_c || 50}°C</span>
          </div>
          <div className="font-mono text-xs font-bold text-nova-text truncate">
            {telemetry?.gpu_name || 'NVIDIA GeForce RTX 5070'}
          </div>
          <div>
            <div className="flex justify-between text-[9px] font-mono text-nova-textDim mb-1">
              <span>VRAM ALLOCATION</span>
              <span>{Math.round(telemetry?.vram_used_mb || 0)} MB / {Math.round(telemetry?.vram_total_mb || 8151)} MB</span>
            </div>
            <div className="h-1.5 bg-nova-bg rounded-full overflow-hidden border border-nova-border/30">
              <div
                className="h-full bg-gradient-to-r from-nova-cyan to-nova-teal transition-all duration-300"
                style={{ width: `${Math.min(100, telemetry?.vram_percent || 5)}%` }}
              />
            </div>
          </div>
        </div>

        {/* CPU */}
        <div className="glass-panel p-4 rounded-xl border border-nova-border/40 space-y-2">
          <div className="flex items-center justify-between text-[10px] font-mono text-nova-textDim uppercase">
            <span>CPU THREADS</span>
            <span className="text-nova-cyan font-bold">{telemetry?.cpu_percent?.toFixed(1) || 0}%</span>
          </div>
          <div className="font-mono text-xs font-bold text-nova-text">Intel Core i7-14750HX</div>
          <div className="text-[10px] font-mono text-nova-textDim/70">24 Logical Threads Active</div>
        </div>

        {/* System RAM */}
        <div className="glass-panel p-4 rounded-xl border border-nova-border/40 space-y-2">
          <div className="flex items-center justify-between text-[10px] font-mono text-nova-textDim uppercase">
            <span>SYSTEM MEMORY</span>
            <span className="text-nova-cyan font-bold">{telemetry?.ram_percent?.toFixed(1) || 0}%</span>
          </div>
          <div className="font-mono text-xs font-bold text-nova-text">
            {telemetry?.ram_used_gb || 0} GB / {telemetry?.ram_total_gb || 32} GB
          </div>
          <div className="text-[10px] font-mono text-nova-textDim/70">High-speed DDR5 System RAM</div>
        </div>

        {/* D: Drive Storage */}
        <div className="glass-panel p-4 rounded-xl border border-nova-border/40 space-y-2">
          <div className="flex items-center justify-between text-[10px] font-mono text-nova-textDim uppercase">
            <span>D: DRIVE STORAGE</span>
            <span className="text-emerald-400 font-bold">{dDrive?.free_gb || 279} GB FREE</span>
          </div>
          <div className="font-mono text-xs font-bold text-nova-text truncate">
            {dDrive?.configured_path || 'D:\\ORBIT\\Models'}
          </div>
          <div>
            <div className="flex justify-between text-[9px] font-mono text-nova-textDim mb-1">
              <span>DRIVE USAGE</span>
              <span>{dDrive?.used_gb || 404} GB / {dDrive?.total_gb || 684} GB</span>
            </div>
            <div className="h-1.5 bg-nova-bg rounded-full overflow-hidden border border-nova-border/30">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                style={{ width: `${dDrive?.used_percent || 60}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* VRAM Protection Governor Banner */}
      <div className="p-3.5 rounded-xl bg-nova-cyan/10 border border-nova-cyan/30 flex items-center justify-between font-mono text-xs text-nova-cyan">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-nova-cyan animate-ping" />
          <span><strong>8 GB VRAM GOVERNOR:</strong> Single-active-model memory management actively unloads previous local models to prevent GPU memory overflow or RAM thrashing.</span>
        </div>
        <span className="text-[10px] bg-nova-cyan/20 px-2 py-0.5 rounded font-bold">AUTOMATIC</span>
      </div>

      {/* Target Model Matrix */}
      <div className="space-y-3">
        <h3 className="font-mono text-xs font-bold text-nova-text uppercase tracking-wider">
          TARGET MODEL SUITE & COGNITIVE ROLES
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(catalog).map(([roleKey, item]) => {
            const isInstalled = item.installed;
            const isCloud = item.provider === 'nvidia';

            return (
              <div
                key={roleKey}
                className="glass-panel p-5 rounded-2xl border border-nova-border/40 hover:border-nova-cyan/40 transition-all duration-300 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs uppercase px-2 py-0.5 rounded bg-nova-bg border border-nova-border/30 text-nova-cyan font-bold">
                        {roleKey.toUpperCase()}
                      </span>
                      <h4 className="font-mono text-sm font-bold text-nova-text">{item.name}</h4>
                    </div>
                    <p className="text-xs text-nova-textDim mt-1">{item.role}</p>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-mono tracking-wider uppercase border font-bold ${
                    isInstalled
                      ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300'
                      : isCloud
                        ? 'bg-amber-500/15 border-amber-500 text-amber-300'
                        : 'bg-cyan-500/15 border-cyan-500 text-cyan-300 animate-pulse'
                  }`}>
                    {isInstalled ? (isCloud ? 'NVIDIA CLOUD READY' : 'INSTALLED & READY') : (isCloud ? 'NVIDIA KEY REQUIRED' : 'DOWNLOADING / STANDBY')}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono pt-2 border-t border-nova-border/20">
                  <div>
                    <span className="text-nova-textDim/70">{isCloud ? 'MODEL ID: ' : 'OLLAMA TAG: '}</span>
                    <span className="text-nova-text font-bold truncate block">{item.resolved_tag || item.tag}</span>
                  </div>
                  <div>
                    <span className="text-nova-textDim/70">VRAM PROFILE: </span>
                    <span className="text-nova-text">{item.vram_gb > 0 ? `~${item.vram_gb} GB` : 'Cloud API (0 GB)'}</span>
                  </div>
                  <div>
                    <span className="text-nova-textDim/70">PROVIDER: </span>
                    <span className="text-nova-text uppercase">{item.provider}</span>
                  </div>
                  <div>
                    <span className="text-nova-textDim/70">{isCloud ? 'SERVICE: ' : 'TARGET DIRECTORY: '}</span>
                    <span className="text-nova-text truncate block">{isCloud ? 'integrate.api.nvidia.com' : item.storage_path}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
