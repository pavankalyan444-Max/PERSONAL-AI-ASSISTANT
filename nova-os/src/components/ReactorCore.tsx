import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useNovaStore } from '../store/novaStore';
import { ReactorOrb } from './ReactorOrb';
import { FloorGrid } from './FloorGrid';

interface ReactorCoreProps {
  className?: string;
}

export function ReactorCore({ className = '' }: ReactorCoreProps) {
  const assistantState = useNovaStore(s => s.assistant.state);
  const audioLevel = useNovaStore(s => s.assistant.audioLevel);
  const isConnected = useNovaStore(s => s.assistant.connected);
  const assistantModel = useNovaStore(s => s.assistant.model);
  const [isReady, setIsReady] = useState(false);
  const [webglOk, setWebglOk] = useState(false);  // hides CSS fallback when WebGL initialises
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 120);
    return () => clearTimeout(timer);
  }, []);

  const handleCreated = useCallback(({ gl }: { gl: THREE.WebGLRenderer }) => {
    gl.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.1;
    setWebglOk(true);  // ← hide CSS fallback
  }, []);

  // Camera position: pull back so reactor fits neatly in the panel
  const cameraPos = useMemo<[number, number, number]>(() => [0, 12, 72], []);

  const stateColor =
    assistantState === 'listening' ? '#FFB800' :
    assistantState === 'thinking'  ? '#9A8CFF' :
    assistantState === 'speaking'  ? '#00F0FF' :
    assistantState === 'error'     ? '#FF4D6A' : '#00F0FF66';

  return (
    <div
      ref={panelRef}
      className={`relative w-full h-full overflow-hidden ${className}`}
      style={{ background: '#05080d' }}
    >
      {/* Subtle background grid */}
      <div className="absolute inset-0 grid-pattern opacity-30 pointer-events-none" aria-hidden="true" />

      {/* Ambient glow — clipped to panel */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full blur-[90px] opacity-15 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${stateColor} 0%, transparent 70%)` }}
        aria-hidden="true"
      />

      {/* Three.js Canvas — absolute fill, no viewport bleed */}
      <div className="absolute inset-0" style={{ width: '100%', height: '100%' }}>
        <Canvas
          camera={{ position: cameraPos, fov: 42, near: 0.1, far: 400 }}
          gl={{ antialias: true, alpha: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' }}
          style={{ width: '100%', height: '100%', display: 'block' }}
          resize={{ scroll: false, debounce: { scroll: 50, resize: 0 } }}
          onCreated={handleCreated}
        >
          <color attach="background" args={['#05080d']} />
          <fog attach="fog" args={['#05080d', 60, 300]} />

          <ambientLight intensity={0.4} color="#55E8FF" />
          <directionalLight position={[20, 40, 30]} intensity={1.0} color="#55E8FF" />
          <pointLight position={[0, 6, 0]}  intensity={0.6} color="#55E8FF" distance={80} decay={2} />
          <pointLight position={[0, -6, 0]} intensity={0.4} color="#55FFD1" distance={80} decay={2} />

          <FloorGrid />
          <ReactorOrb
            state={assistantState}
            audioLevel={audioLevel}
            isReady={isReady}
          />

          <OrbitControls
            enablePan={false}
            enableZoom={true}
            enableRotate={true}
            minDistance={28}
            maxDistance={110}
            minPolarAngle={0.2}
            maxPolarAngle={Math.PI - 0.2}
            enableDamping
            dampingFactor={0.06}
            rotateSpeed={0.3}
            zoomSpeed={0.7}
          />
        </Canvas>
      </div>

      {/*
       * CSS fallback — only shown when WebGL hasn't initialised yet
       * (e.g. first frame before onCreated fires, or when WebGL fails).
       * Hidden immediately once the canvas is ready.
       */}
      {!webglOk && (
        <div
          className="reactor-fallback pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
          aria-hidden="true"
        >
          <div className="reactor-orbit reactor-orbit-one" />
          <div className="reactor-orbit reactor-orbit-two" />
          <div className="reactor-core-fallback"><div className="reactor-core-inner" /></div>
          <span className="absolute top-6 font-mono text-[10px] tracking-[0.3em] text-nova-cyan/75">
            LOADING...
          </span>
        </div>
      )}

      {/* Assistant state badge */}
      <div className="absolute bottom-4 left-4 pointer-events-none z-20">
        <div className="flex items-center gap-2 px-3 py-1.5 glass-panel rounded-lg border-nova-border/30">
          <div
            className="w-1.5 h-1.5 rounded-full transition-all duration-300"
            style={{ background: stateColor, boxShadow: `0 0 6px ${stateColor}` }}
            aria-hidden="true"
          />
          <span className="font-mono text-[10px] text-nova-textDim uppercase tracking-wider">ORBIT</span>
          <span className="font-mono text-xs text-nova-text capitalize">{assistantState}</span>
        </div>
      </div>

      {/* Top-right mini status */}
      <div className="absolute top-3 right-3 pointer-events-none z-20 flex flex-col gap-1 items-end">
        <div className="flex items-center gap-1.5 px-2 py-0.5 glass-panel rounded border-nova-border/20">
          <div className={`w-1 h-1 rounded-full ${isConnected ? 'bg-nova-cyan animate-pulse' : 'bg-nova-red'}`} />
          <span className="font-mono text-[9px] text-nova-textDim">
            {isConnected ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
        <div className="px-2 py-0.5 glass-panel rounded border-nova-border/20">
          <span className="font-mono text-[9px] text-nova-violet">{assistantModel?.split(' ')[0]}</span>
        </div>
      </div>
    </div>
  );
}
