'use client';

import { useEffect, useRef } from 'react';
import { useReactFlow, useViewport } from 'reactflow';
import { useDiagramStore } from '@/store/diagramStore';

interface Point {
  x: number;
  y: number;
  time: number;
}

interface Stroke {
  id: string;
  points: Point[];
}

export function CometTrailCanvas() {
  const isPenModeActive = useDiagramStore((s) => s.isPenModeActive);
  const reactFlowInstance = useReactFlow();
  const { x, y, zoom } = useViewport();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const isDrawingRef = useRef(false);
  const currentStrokeIdRef = useRef<string | null>(null);

  // Resize canvas handler to handle window sizing and Retina displays
  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.resetTransform();
      ctx.scale(dpr, dpr);
    }
  };

  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  // Frame loop for 60fps trail decay and render
  useEffect(() => {
    let animationFrameId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);

      const now = Date.now();

      // Clean up points older than 3 seconds
      strokesRef.current = strokesRef.current
        .map(stroke => ({
          ...stroke,
          points: stroke.points.filter(p => now - p.time <= 3000)
        }))
        .filter(stroke => stroke.points.length > 0);

      // Render trails
      strokesRef.current.forEach(stroke => {
        const points = stroke.points;
        if (points.length < 2) return;

        for (let i = 0; i < points.length - 1; i++) {
          const p1 = points[i];
          const p2 = points[i + 1];

          // Project viewport coordinate mapping
          const s1x = p1.x * zoom + x;
          const s1y = p1.y * zoom + y;
          const s2x = p2.x * zoom + x;
          const s2y = p2.y * zoom + y;

          const age = now - p1.time;
          const lifeRatio = Math.max(0, 1 - age / 3000); // 1.0 down to 0.0

          ctx.beginPath();
          ctx.moveTo(s1x, s1y);
          ctx.lineTo(s2x, s2y);

          // Render glowing comet trails that fade and taper
          ctx.strokeStyle = `rgba(37, 99, 235, ${lifeRatio})`; 
          ctx.lineWidth = Math.max(1.5, 6 * lifeRatio);
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.stroke();
        }
      });

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [x, y, zoom]);

  // Pointer Down
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPenModeActive) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);

    const flowPos = reactFlowInstance.screenToFlowPosition({
      x: e.clientX,
      y: e.clientY
    });

    isDrawingRef.current = true;
    const newStrokeId = Math.random().toString(36);
    currentStrokeIdRef.current = newStrokeId;

    strokesRef.current.push({
      id: newStrokeId,
      points: [{ x: flowPos.x, y: flowPos.y, time: Date.now() }]
    });
  };

  // Pointer Move
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPenModeActive || !isDrawingRef.current || !currentStrokeIdRef.current) return;

    const flowPos = reactFlowInstance.screenToFlowPosition({
      x: e.clientX,
      y: e.clientY
    });

    const activeStroke = strokesRef.current.find(s => s.id === currentStrokeIdRef.current);
    if (activeStroke) {
      activeStroke.points.push({
        x: flowPos.x,
        y: flowPos.y,
        time: Date.now()
      });
    }
  };

  // Pointer Up / Cancel
  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDrawingRef.current) {
      const canvas = canvasRef.current;
      if (canvas) {
        try {
          canvas.releasePointerCapture(e.pointerId);
        } catch {
          // ignore capture issues
        }
      }
      isDrawingRef.current = false;
      currentStrokeIdRef.current = null;
    }
  };

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`absolute inset-0 w-full h-full select-none ${
        isPenModeActive 
          ? 'z-30 pointer-events-auto cursor-crosshair' 
          : 'z-0 pointer-events-none'
      }`}
    />
  );
}
