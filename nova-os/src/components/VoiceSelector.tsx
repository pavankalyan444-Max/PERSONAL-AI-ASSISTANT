import { useState, useEffect } from 'react';
import { audioReactor } from '../utils/audioReactor';
import type { VoicePreferences } from '../utils/audioReactor';

export function VoiceSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const [prefs, setPrefs] = useState<VoicePreferences>(() => audioReactor.loadVoicePreferences());
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  useEffect(() => {
    const updateVoiceList = () => {
      const v = audioReactor.getAvailableVoices();
      setVoices(v);
      const updated = audioReactor.loadVoicePreferences();
      setPrefs(updated);
    };

    updateVoiceList();

    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = updateVoiceList;
    }

    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  const handleVoiceChange = (voiceName: string) => {
    const updated = audioReactor.saveVoicePreferences({ voiceName });
    setPrefs(updated);
  };

  const handleSpeedChange = (speed: number) => {
    const updated = audioReactor.saveVoicePreferences({ speed });
    setPrefs(updated);
  };

  const handlePitchChange = (pitch: number) => {
    const updated = audioReactor.saveVoicePreferences({ pitch });
    setPrefs(updated);
  };

  const handleResetDefaults = () => {
    const updated = audioReactor.saveVoicePreferences({
      voiceName: 'Nova',
      speed: 1.0,
      pitch: 1.0,
      language: 'en-US',
    });
    setPrefs(updated);
  };

  const handlePreview = () => {
    setIsPlayingPreview(true);
    audioReactor.previewVoice(
      prefs.actualVoiceName,
      `ORBIT voice calibration online. Speaking speed set to ${prefs.speed.toFixed(1)}.`
    );
    setTimeout(() => setIsPlayingPreview(false), 3000);
  };

  // Determine label for display
  const isNovaActive = prefs.isNovaAvailable && prefs.voiceName.toLowerCase().includes('nova');
  const displayLabel = isNovaActive 
    ? 'Nova (1.0×)' 
    : prefs.voiceName.toLowerCase() === 'nova' 
      ? `Fallback: ${prefs.actualVoiceName.split(' ')[0]} (${prefs.speed.toFixed(1)}×)` 
      : `${prefs.voiceName.split(' ')[0]} (${prefs.speed.toFixed(1)}×)`;

  return (
    <div className="relative">
      {/* Pill Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1 glass-panel rounded-lg border border-nova-border/30 hover:border-nova-cyan/50 text-[10px] font-mono tracking-wider transition-all duration-200"
        title="Voice Selector & Audio Calibration"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-nova-cyan animate-pulse" />
        <span className="text-nova-textDim uppercase">VOICE:</span>
        <span className={`font-bold ${isNovaActive ? 'text-nova-cyan' : 'text-amber-400'}`}>
          {displayLabel}
        </span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`text-nova-textDim transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Popover Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 glass-panel rounded-2xl border border-nova-border/50 shadow-[0_12px_40px_rgba(0,0,0,0.8)] p-4 z-50 space-y-4 font-mono text-xs animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between border-b border-nova-border/30 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-nova-cyan shadow-[0_0_8px_#00F0FF]" />
              <h4 className="font-bold text-nova-text uppercase tracking-widest text-[11px]">VOICE CALIBRATION</h4>
            </div>
            <span className={`px-2 py-0.5 rounded text-[9px] uppercase border font-bold ${
              isNovaActive ? 'bg-nova-cyan/15 border-nova-cyan text-nova-cyan' : 'bg-amber-500/15 border-amber-500 text-amber-300'
            }`}>
              {isNovaActive ? 'NOVA ACTIVE' : 'FALLBACK ACTIVE'}
            </span>
          </div>

          {/* Voice Selector Dropdown */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] text-nova-textDim">
              <span>ACTIVE VOICE</span>
              {!isNovaActive && prefs.voiceName.toLowerCase() === 'nova' && (
                <span className="text-amber-400">Nova not found locally</span>
              )}
            </div>
            <select
              value={prefs.voiceName}
              onChange={(e) => handleVoiceChange(e.target.value)}
              className="w-full bg-nova-bg/90 border border-nova-border/50 rounded-lg px-2.5 py-1.5 text-xs text-nova-text focus:outline-none focus:border-nova-cyan"
            >
              <option value="Nova">Nova (Default Target)</option>
              {voices.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
            <div className="text-[10px] text-nova-textDim/70 truncate">
              Physical Engine: <span className="text-nova-text">{prefs.actualVoiceName}</span>
            </div>
          </div>

          {/* Speed Slider (0.7x to 1.3x) */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px]">
              <span className="text-nova-textDim">SPEAKING SPEED</span>
              <span className="text-nova-cyan font-bold">{prefs.speed.toFixed(2)}×</span>
            </div>
            <input
              type="range"
              min="0.7"
              max="1.3"
              step="0.05"
              value={prefs.speed}
              onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
              className="w-full accent-nova-cyan h-1.5 bg-nova-bg rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[8px] text-nova-textDim/50">
              <span>0.7× (Slow)</span>
              <span>1.0× (Normal)</span>
              <span>1.3× (Fast)</span>
            </div>
          </div>

          {/* Pitch Slider (0.8 to 1.2) */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px]">
              <span className="text-nova-textDim">PITCH MODULATION</span>
              <span className="text-nova-cyan font-bold">{prefs.pitch.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.8"
              max="1.2"
              step="0.02"
              value={prefs.pitch}
              onChange={(e) => handlePitchChange(parseFloat(e.target.value))}
              className="w-full accent-nova-cyan h-1.5 bg-nova-bg rounded-lg cursor-pointer"
            />
          </div>

          {/* Controls: Preview & Reset */}
          <div className="flex items-center gap-2 pt-2 border-t border-nova-border/30">
            <button
              onClick={handlePreview}
              disabled={isPlayingPreview}
              className="flex-1 py-1.5 px-3 rounded-lg bg-nova-cyan/15 border border-nova-cyan/40 hover:bg-nova-cyan/25 text-nova-cyan text-[10px] font-bold tracking-wider flex items-center justify-center gap-1.5 transition-all"
            >
              {isPlayingPreview ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-nova-cyan animate-ping" />
                  PREVIEWING...
                </>
              ) : (
                <>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  TEST VOICE
                </>
              )}
            </button>
            <button
              onClick={handleResetDefaults}
              className="py-1.5 px-3 rounded-lg border border-nova-border/40 hover:bg-nova-border/20 text-nova-textDim text-[10px] tracking-wider transition-all"
              title="Reset to default Nova at 1.0x"
            >
              RESET
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
