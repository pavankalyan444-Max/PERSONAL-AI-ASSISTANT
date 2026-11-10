import { useState, useEffect } from 'react';

interface ActiveWindowInfo {
  title: string;
  app_name: string;
  pid: number | null;
  hwnd: number;
}

interface EventLog {
  timestamp: number;
  time_str: string;
  action: string;
  details: string;
}

export function ComputerUseView() {
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const [activeWindow, setActiveWindow] = useState<ActiveWindowInfo | null>(null);
  const [stopActive, setStopActive] = useState(false);
  const [events, setEvents] = useState<EventLog[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isRunningTest, setIsRunningTest] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [customNote, setCustomNote] = useState('');

  const fetchStatusAndScreenshot = async () => {
    try {
      const [resStatus, resShot] = await Promise.all([
        fetch('/api/computer-use/status'),
        fetch('/api/computer-use/screenshot')
      ]);

      if (resStatus.ok) {
        const data = await resStatus.json();
        setActiveWindow(data.active_window || null);
        setStopActive(data.stop_requested || false);
        setEvents(data.recent_events || []);
      }

      if (resShot.ok) {
        const shotData = await resShot.json();
        if (shotData.ok && shotData.image_data) {
          setScreenshotUri(shotData.image_data);
        }
      }
    } catch {
      // fallback
    }
  };

  useEffect(() => {
    fetchStatusAndScreenshot();
    let interval: any = null;
    if (autoRefresh) {
      interval = setInterval(fetchStatusAndScreenshot, 2500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const handleRunNotepadTest = async () => {
    setIsRunningTest(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/computer-use/test-notepad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: customNote.trim() || undefined }),
      });
      const data = await res.json();
      setTestResult(data);
      if (data.screenshot) {
        setScreenshotUri(data.screenshot);
      }
      fetchStatusAndScreenshot();
    } catch (e: any) {
      setTestResult({ ok: false, error: e.message });
    } finally {
      setIsRunningTest(false);
    }
  };

  const handleEmergencyStop = async () => {
    try {
      const res = await fetch('/api/computer-use/stop', { method: 'POST' });
      await res.json();
      setStopActive(true);
      fetchStatusAndScreenshot();
    } catch {
      // ignore
    }
  };

  const handleResetStop = async () => {
    try {
      await fetch('/api/computer-use/reset', { method: 'POST' });
      setStopActive(false);
      fetchStatusAndScreenshot();
    } catch {
      // ignore
    }
  };

  return (
    <div className="h-full w-full overflow-y-auto p-6 space-y-6">
      {/* Header with Emergency STOP */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-nova-border/30 pb-4 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-nova-cyan animate-pulse shadow-[0_0_10px_#00F0FF]" />
            <h1 className="font-mono text-lg font-bold text-nova-text tracking-wider">COMPUTER USE CONTROL CENTER</h1>
          </div>
          <p className="font-mono text-xs text-nova-textDim mt-1">
            Native Windows UI Automation • Live Desktop Surface Inspection • Visual & Deterministic Action Execution
          </p>
        </div>

        {/* Emergency Stop Controls */}
        <div className="flex items-center gap-3">
          {stopActive ? (
            <button
              onClick={handleResetStop}
              className="px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500 text-amber-300 font-mono text-xs font-bold hover:bg-amber-500/30 transition-all flex items-center gap-2"
            >
              <span>RESET EMERGENCY STOP</span>
            </button>
          ) : (
            <button
              onClick={handleEmergencyStop}
              className="px-5 py-2.5 rounded-xl bg-red-600/20 border-2 border-red-500 hover:bg-red-600/30 text-red-400 font-mono text-xs font-bold shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-all flex items-center gap-2"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
              <span>EMERGENCY STOP</span>
            </button>
          )}
        </div>
      </div>

      {/* Emergency Alert Banner */}
      {stopActive && (
        <div className="p-4 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 font-mono text-xs flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2.5">
            <span className="text-base">⚠️</span>
            <span><strong>EMERGENCY STOP IS ACTIVE:</strong> All PC UI automation and desktop subtasks are frozen. Click Reset to release.</span>
          </div>
          <button
            onClick={handleResetStop}
            className="px-3 py-1 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 transition-colors"
          >
            RELEASE
          </button>
        </div>
      )}

      {/* Two Column Control Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Live Desktop Surface & Active Window */}
        <div className="lg:col-span-2 space-y-4">
          {/* Active Window HUD */}
          <div className="glass-panel p-4 rounded-xl border border-nova-border/40 flex items-center justify-between font-mono text-xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-nova-cyan/15 border border-nova-cyan/40 flex items-center justify-center font-bold text-nova-cyan">
                🪟
              </div>
              <div>
                <div className="text-[10px] text-nova-textDim uppercase tracking-wider">FOREGROUND WINDOW</div>
                <div className="font-bold text-nova-text truncate max-w-md">
                  {activeWindow?.title || 'Windows Desktop'}
                </div>
              </div>
            </div>
            <div className="text-right text-[10px] text-nova-textDim">
              <div>PROCESS: <span className="text-nova-cyan font-bold">{activeWindow?.app_name || 'explorer.exe'}</span></div>
              {activeWindow?.pid && <div>PID: {activeWindow.pid}</div>}
            </div>
          </div>

          {/* Screenshot Preview Canvas */}
          <div className="glass-panel p-3 rounded-2xl border border-nova-border/40 space-y-2">
            <div className="flex items-center justify-between font-mono text-[10px] text-nova-textDim px-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>LIVE DESKTOP SURFACE PREVIEW</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="accent-nova-cyan"
                  />
                  <span>Auto-Refresh</span>
                </label>
                <button
                  onClick={fetchStatusAndScreenshot}
                  className="px-2 py-0.5 rounded border border-nova-border/40 hover:bg-nova-border/20 text-nova-text"
                >
                  ↻ CAPTURE
                </button>
              </div>
            </div>

            <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black/60 border border-nova-border/30 flex items-center justify-center">
              {screenshotUri ? (
                <img
                  src={screenshotUri}
                  alt="Desktop Screenshot"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="font-mono text-xs text-nova-textDim flex flex-col items-center gap-2">
                  <span className="w-4 h-4 border-2 border-nova-cyan border-t-transparent rounded-full animate-spin" />
                  <span>Capturing desktop surface...</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Automation Execution & Notepad Test */}
        <div className="space-y-4">
          {/* Notepad Test Suite */}
          <div className="glass-panel p-5 rounded-2xl border border-nova-border/40 space-y-4 font-mono text-xs">
            <div className="flex items-center gap-2 border-b border-nova-border/30 pb-2">
              <span className="w-2 h-2 rounded-full bg-nova-cyan" />
              <h3 className="font-bold text-nova-text uppercase tracking-wider">UI AUTOMATION SUITE</h3>
            </div>

            <p className="text-nova-textDim text-[11px] leading-relaxed">
              Verifies Windows UI Automation by launching Notepad and typing ground-truth verified text via native OS input events.
            </p>

            <div className="space-y-1.5">
              <label className="text-[10px] text-nova-textDim uppercase">CUSTOM NOTE TEXT (OPTIONAL)</label>
              <input
                type="text"
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                placeholder="Leave blank for timestamped test..."
                className="w-full bg-nova-bg border border-nova-border/50 rounded-lg p-2 text-xs text-nova-text focus:outline-none focus:border-nova-cyan"
              />
            </div>

            <button
              onClick={handleRunNotepadTest}
              disabled={isRunningTest || stopActive}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-nova-cyan/20 to-nova-teal/20 border border-nova-cyan/50 hover:bg-nova-cyan/30 text-nova-cyan font-bold tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isRunningTest ? (
                <>
                  <span className="w-3 h-3 border-2 border-nova-cyan border-t-transparent rounded-full animate-spin" />
                  <span>EXECUTING NOTEPAD TEST...</span>
                </>
              ) : (
                <>
                  <span>▶</span>
                  <span>RUN VERIFIED NOTEPAD TEST</span>
                </>
              )}
            </button>

            {testResult && (
              <div className={`p-3 rounded-xl border text-[11px] space-y-1 ${
                testResult.ok ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border-red-500/30 text-red-300'
              }`}>
                <div className="font-bold">
                  {testResult.ok ? '✓ TEST COMPLETED SUCCESSFULLY' : '✗ TEST FAILED'}
                </div>
                <div>{testResult.message || testResult.error}</div>
                {testResult.duration_ms && (
                  <div className="text-[9px] text-nova-textDim">Latency: {testResult.duration_ms}ms</div>
                )}
              </div>
            )}
          </div>

          {/* Mouse & Keyboard Event Log */}
          <div className="glass-panel p-5 rounded-2xl border border-nova-border/40 space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-nova-border/30 pb-2">
              <span className="font-bold text-nova-text uppercase text-[11px]">AUTOMATION EVENT LOG</span>
              <span className="text-[9px] text-nova-textDim">{events.length} EVENTS</span>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto">
              {events.length === 0 ? (
                <div className="text-center text-nova-textDim/50 py-4 text-[10px]">
                  No automation events logged yet.
                </div>
              ) : (
                events.map((ev, idx) => (
                  <div key={idx} className="p-2 rounded-lg bg-nova-bg/60 border border-nova-border/20 text-[10px] space-y-0.5">
                    <div className="flex justify-between text-nova-textDim">
                      <span className="text-nova-cyan font-bold">{ev.action}</span>
                      <span>{ev.time_str}</span>
                    </div>
                    <div className="text-nova-text/80 break-words">{ev.details}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
