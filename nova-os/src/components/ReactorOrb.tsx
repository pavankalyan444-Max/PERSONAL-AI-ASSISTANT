/**
 * ReactorOrb — Holographic Voice-Reactive JARVIS AI Energy Core.
 *
 * Implements:
 * - IDLE: Electric cyan & holographic blue, gentle breathing, slow orbital gyroscopic rings.
 * - LISTENING: True Golden Yellow / Amber, pulsing dynamically to REAL microphone amplitude via AnalyserNode RMS.
 * - THINKING / PROCESSING: Smooth transition to Violet / Purple with rhythmic processing pulses.
 * - SPEAKING: Smooth transition to Electric Blue / Cyan, breathing and undulating to REAL AI speech output.
 * - ERROR: Muted crimson warning.
 * - Strict Separation: Microphone audio ONLY animates listening; AI speech audio ONLY animates speaking.
 * - 100% GPU particle vortex: 2,500 glowing circular energy motes (zero square cubes!).
 */
import { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { audioReactor, type ReactorState } from '../utils/audioReactor';

interface ReactorOrbProps {
  state: ReactorState;
  audioLevel?: number; // Optional fallback
  isReady: boolean;
}

const PARTICLE_COUNT = 2400;

/* Accurate state color palettes (Primary, Secondary, Accent) */
const PALETTES: Record<ReactorState, [THREE.Color, THREE.Color, THREE.Color]> = {
  idle: [
    new THREE.Color('#00F0FF'), // Electric cyan
    new THREE.Color('#0066FF'), // Holographic deep blue
    new THREE.Color('#50E3C2'), // Cyan accent
  ],
  listening: [
    new THREE.Color('#FFB800'), // Golden yellow
    new THREE.Color('#FF7700'), // Warm amber
    new THREE.Color('#FFE600'), // Bright gold core
  ],
  thinking: [
    new THREE.Color('#9A8CFF'), // Electric violet
    new THREE.Color('#7928CA'), // Deep purple
    new THREE.Color('#F81CE5'), // Cyber magenta
  ],
  speaking: [
    new THREE.Color('#00F0FF'), // Electric blue
    new THREE.Color('#00FFA3'), // Neon cyan-mint
    new THREE.Color('#0099FF'), // Radiant cobalt
  ],
  error: [
    new THREE.Color('#FF4D6A'), // Crimson
    new THREE.Color('#990022'), // Muted dark red
    new THREE.Color('#FFAA55'), // Warning amber
  ],
};

export function ReactorOrb({ state, isReady }: ReactorOrbProps) {
  const pointsRef    = useRef<THREE.Points | null>(null);
  const coreRef      = useRef<THREE.Mesh | null>(null);
  const coronaRef    = useRef<THREE.Mesh | null>(null);
  const gyroGroupRef = useRef<THREE.Group | null>(null);
  const ringMeshesRef = useRef<THREE.Mesh[]>([]);
  const materialRef  = useRef<THREE.ShaderMaterial | null>(null);

  // Smooth color morphing targets
  const currentP = useRef(new THREE.Color('#00F0FF'));
  const currentS = useRef(new THREE.Color('#0066FF'));
  const currentA = useRef(new THREE.Color('#50E3C2'));

  /* ─── GPU Particle Geometry & Vortex Shader ────────────────────────────── */
  const { geometry, shaderMaterial } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const params    = new Float32Array(PARTICLE_COUNT * 4); // [baseRadius, angleOffset, speed, streamId]
    const colorsArr = new Float32Array(PARTICLE_COUNT * 3);
    const sizes     = new Float32Array(PARTICLE_COUNT);

    const baseColor1 = PALETTES.idle[0];
    const baseColor2 = PALETTES.idle[1];
    const baseColor3 = PALETTES.idle[2];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const streamId = i % 2;
      const baseRadius = 6.5 + Math.pow(Math.random(), 0.75) * 18.0;
      const angleOffset = Math.random() * Math.PI * 2.0;
      const speed = (0.3 + Math.random() * 0.7) * (streamId === 0 ? 1.0 : -0.85);

      positions[i * 3]     = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;

      params[i * 4]     = baseRadius;
      params[i * 4 + 1] = angleOffset;
      params[i * 4 + 2] = speed;
      params[i * 4 + 3] = streamId;

      const pColor = new THREE.Color();
      const mixRatio = Math.random();
      if (mixRatio < 0.6) {
        pColor.copy(baseColor1).lerp(baseColor3, Math.random() * 0.5);
      } else if (mixRatio < 0.88) {
        pColor.copy(baseColor2).lerp(baseColor1, Math.random() * 0.4);
      } else {
        pColor.setRGB(1.0, 1.0, 1.0); // Hot spark
      }

      colorsArr[i * 3]     = pColor.r;
      colorsArr[i * 3 + 1] = pColor.g;
      colorsArr[i * 3 + 2] = pColor.b;

      sizes[i] = 9.0 + Math.random() * 18.0;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aParam',   new THREE.BufferAttribute(params, 4));
    geo.setAttribute('aColor',   new THREE.BufferAttribute(colorsArr, 3));
    geo.setAttribute('aSize',    new THREE.BufferAttribute(sizes, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 200);

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime:    { value: 0 },
        uAudio:   { value: 0 },
        uColor1:  { value: new THREE.Color().copy(baseColor1) },
        uColor2:  { value: new THREE.Color().copy(baseColor2) },
        uColor3:  { value: new THREE.Color().copy(baseColor3) },
      },
      vertexShader: `
        attribute vec4 aParam; // [baseRadius, angleOffset, speed, streamId]
        attribute vec3 aColor;
        attribute float aSize;

        uniform float uTime;
        uniform float uAudio;
        uniform vec3 uColor1;
        uniform vec3 uColor2;
        uniform vec3 uColor3;

        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          float baseR   = aParam.x;
          float offsetA = aParam.y;
          float spd     = aParam.z;
          float stream  = aParam.w;

          // GPU particle kinematics: continuous fluid vortex
          float speedBoost = 1.0 + uAudio * 2.2;
          float angle = offsetA + uTime * spd * speedBoost * 0.45;

          // Radial breathing and audio pulse expansion
          float breathe = sin(uTime * 1.8 + offsetA * 2.0) * 0.7;
          float radius  = baseR + breathe + uAudio * 4.8;

          // Toroidal / helical elevation wave
          float yWave = sin(angle * 2.0 + uTime * 1.4) * (3.5 + uAudio * 4.5);
          float yOffset = (stream == 0.0 ? 1.0 : -1.0) * cos(angle + uTime * 0.9) * 4.5;
          float y = yWave + yOffset;

          vec3 pos = vec3(
            radius * cos(angle),
            y,
            radius * sin(angle)
          );

          // Subtle pitch inclination
          float pitch = 0.32;
          float pY = pos.y * cos(pitch) - pos.z * sin(pitch);
          float pZ = pos.y * sin(pitch) + pos.z * cos(pitch);
          pos.y = pY;
          pos.z = pZ;

          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mvPosition;

          // Dynamic point attenuation with distance
          float pSize = aSize * (1.0 + uAudio * 0.85);
          gl_PointSize = clamp(pSize * (88.0 / -mvPosition.z), 3.0, 75.0);

          // Color blending
          vec3 c = mix(aColor, uColor1, 0.45);
          if (stream > 0.5) {
            c = mix(c, uColor2, 0.4);
          }
          if (uAudio > 0.25) {
            c = mix(c, uColor3, uAudio * 0.5);
          }
          vColor = c;
          vAlpha = clamp(0.4 + sin(angle * 3.0 + uTime) * 0.25 + uAudio * 0.4, 0.15, 0.95);
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          // Circular particle with smooth radial soft-glow (NO SQUARES)
          vec2 coord = gl_PointCoord - vec2(0.5);
          float dist = length(coord);
          if (dist > 0.5) discard;

          // Gaussian-like soft luminous bell falloff
          float softEdge = smoothstep(0.5, 0.04, dist);
          float hotCore  = smoothstep(0.16, 0.0, dist);

          vec3 finalColor = mix(vColor, vec3(1.0, 1.0, 1.0), hotCore * 0.8);
          gl_FragColor = vec4(finalColor, softEdge * vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    return { geometry: geo, shaderMaterial: mat };
  }, []);

  materialRef.current = shaderMaterial;

  /* ─── Gyroscopic 3D Orbital Rings ───────────────────────────────────────── */
  const rings = useMemo(() => {
    const ringConfigs = [
      { radius: 13.5, tube: 0.10, rot: [Math.PI / 4, 0, 0] as [number, number, number], speed: 0.28 },
      { radius: 17.5, tube: 0.08, rot: [0, Math.PI / 3, Math.PI / 6] as [number, number, number], speed: -0.22 },
      { radius: 21.5, tube: 0.06, rot: [-Math.PI / 5, Math.PI / 4, 0] as [number, number, number], speed: 0.18 },
    ];
    return ringConfigs.map(cfg => {
      const geo = new THREE.TorusGeometry(cfg.radius, cfg.tube, 8, 96);
      const mat = new THREE.MeshBasicMaterial({
        color: PALETTES.idle[0],
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      return { geo, mat, rot: cfg.rot, speed: cfg.speed };
    });
  }, []);

  /* ─── Core & Corona Materials ───────────────────────────────────────────── */
  const coreMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: PALETTES.idle[0],
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), []);

  const coronaMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: PALETTES.idle[1],
    transparent: true,
    opacity: 0.22,
    wireframe: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), []);

  /* ─── Animation Frame Loop (60-120 FPS Pure GPU Uniform Updates) ────────── */
  useFrame((_, delta) => {
    if (!isReady) return;

    const time = performance.now() * 0.001;

    // 1. Separate Audio Inputs:
    // Listening -> Real microphone amplitude (AnalyserNode RMS)
    // Speaking  -> Real AI output speech amplitude
    // Idle/Thinking -> Calm breathing (0)
    let rawAudio = 0;
    if (state === 'listening') {
      rawAudio = audioReactor.getMicLevel();
    } else if (state === 'speaking') {
      rawAudio = audioReactor.getSpeakerLevel();
    }

    // 2. Smooth Color Palette Transitions (Frame-Rate Independent)
    const dt = Math.min(delta, 0.1);
    const colLerp = 1.0 - Math.exp(-6.5 * dt);
    const targetColors = PALETTES[state] || PALETTES.idle;
    currentP.current.lerp(targetColors[0], colLerp);
    currentS.current.lerp(targetColors[1], colLerp);
    currentA.current.lerp(targetColors[2], colLerp);

    // 3. Update GPU Shader Uniforms
    if (materialRef.current) {
      const audioLerp = 1.0 - Math.exp(-15.0 * dt);
      materialRef.current.uniforms.uTime.value = time;
      materialRef.current.uniforms.uAudio.value = THREE.MathUtils.lerp(
        materialRef.current.uniforms.uAudio.value,
        rawAudio,
        audioLerp
      );
      materialRef.current.uniforms.uColor1.value.copy(currentP.current);
      materialRef.current.uniforms.uColor2.value.copy(currentS.current);
      materialRef.current.uniforms.uColor3.value.copy(currentA.current);
    }

    // 4. Central Energy Core (Voice-Reactive Expansion)
    if (coreRef.current) {
      const breathe = Math.sin(time * 3.0) * 0.06;
      // Expands significantly when listening to loud voice or when AI speaks
      const audioExpansion = rawAudio * 0.75;
      const scale = 1.0 + breathe + audioExpansion;
      coreRef.current.scale.setScalar(scale);

      coreMat.color.copy(currentP.current);
      coreMat.opacity = 0.75 + Math.sin(time * 2.4) * 0.12 + rawAudio * 0.25;
    }

    // 5. Outer Holographic Wireframe Corona
    if (coronaRef.current) {
      const coronaScale = 1.0 + Math.sin(time * 1.8) * 0.04 + rawAudio * 0.25;
      coronaRef.current.scale.setScalar(coronaScale);
      coronaRef.current.rotation.y += delta * 0.15;
      coronaRef.current.rotation.x = Math.sin(time * 0.3) * 0.1;
      coronaMat.color.copy(currentS.current);
      coronaMat.opacity = 0.18 + rawAudio * 0.2;
    }

    // 6. Gyroscopic Orbital Rings Rotation
    if (gyroGroupRef.current) {
      const speedMultiplier = 1.0 + rawAudio * 2.0;
      ringMeshesRef.current.forEach((mesh, idx) => {
        const ringCfg = rings[idx];
        if (ringCfg) {
          mesh.rotation.z += delta * ringCfg.speed * speedMultiplier;
          mesh.rotation.y += delta * (ringCfg.speed * 0.5) * speedMultiplier;
          (mesh.material as THREE.MeshBasicMaterial).color.copy(idx === 0 ? currentP.current : currentS.current);
          (mesh.material as THREE.MeshBasicMaterial).opacity = 0.25 + rawAudio * 0.35;
        }
      });
      gyroGroupRef.current.rotation.y += delta * 0.18 * speedMultiplier;
    }
  });

  /* Teardown */
  useEffect(() => {
    return () => {
      geometry.dispose();
      shaderMaterial.dispose();
      coreMat.dispose();
      coronaMat.dispose();
      rings.forEach(r => {
        r.geo.dispose();
        r.mat.dispose();
      });
    };
  }, [geometry, shaderMaterial, coreMat, coronaMat, rings]);

  return (
    <group>
      {/* 1. GPU 2,400-Particle Glowing Quantum Vortex */}
      <points ref={pointsRef} geometry={geometry} material={shaderMaterial} />

      {/* 2. Central Translucent Energy Singularity */}
      <mesh ref={coreRef} material={coreMat}>
        <sphereGeometry args={[3.3, 32, 32]} />
      </mesh>

      {/* 3. Outer Holographic Wireframe Corona */}
      <mesh ref={coronaRef} material={coronaMat}>
        <icosahedronGeometry args={[5.4, 2]} />
      </mesh>

      {/* 4. Gyroscopic Orbital Rings */}
      <group ref={gyroGroupRef}>
        {rings.map((r, i) => (
          <mesh
            key={i}
            ref={el => { if (el) ringMeshesRef.current[i] = el; }}
            geometry={r.geo}
            material={r.mat}
            rotation={r.rot}
          />
        ))}
      </group>
    </group>
  );
}
