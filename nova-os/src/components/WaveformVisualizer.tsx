import { useEffect, useRef } from 'react';
import { audioReactor } from '../utils/audioReactor';

interface WaveformVisualizerProps {
  isRecording: boolean;
}

export function WaveformVisualizer({ isRecording }: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;

    const render = () => {
      animId = requestAnimationFrame(render);
      const wave = audioReactor.getWaveform();
      const W = canvas.width;
      const H = canvas.height;

      ctx.clearRect(0, 0, W, H);

      const numBars = wave.length;
      const spacing = 1.5;
      const barWidth = Math.max(1.5, (W - (numBars - 1) * spacing) / numBars);

      for (let i = 0; i < numBars; i++) {
        const val = Math.max(0.12, Math.min(1.0, wave[i]));
        const barHeight = Math.max(4, val * (H - 4));
        const x = i * (barWidth + spacing);
        const y = (H - barHeight) / 2;

        if (isRecording) {
          ctx.fillStyle = '#FFB800';
          ctx.shadowColor = '#FFB800';
          ctx.shadowBlur = 4;
        } else {
          ctx.fillStyle = '#00F0FF';
          ctx.shadowColor = '#00F0FF';
          ctx.shadowBlur = 2;
        }

        ctx.beginPath();
        const r = Math.min(barWidth / 2, 1.5);
        ctx.roundRect(x, y, barWidth, barHeight, r);
        ctx.fill();
      }
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isRecording]);

  return (
    <div className="h-9 flex items-center px-2 glass-panel rounded-xl border border-nova-border/30 w-36 flex-shrink-0 overflow-hidden">
      <canvas
        ref={canvasRef}
        width={132}
        height={32}
        className="w-full h-full block"
      />
    </div>
  );
}
