'use client';

import { motion, AnimatePresence } from 'framer-motion';

interface CursorBeaconProps {
  x: number;
  y: number;
  animation: 'tap' | 'drag' | 'none';
  stopped?: boolean;
}

/** Premium animated cursor beacon — replaces the old SVG hand. */
export function VirtualHand({ x, y, animation, stopped }: CursorBeaconProps) {
  if (animation === 'none' || stopped) return null;

  return (
    <AnimatePresence>
      <div
        style={{
          position: 'fixed',
          top: y,
          left: x,
          zIndex: 10002,
          pointerEvents: 'none',
          transform: 'translate(-50%, -50%)',
        }}
      >
        {animation === 'tap' ? <TapBeacon /> : <DragBeacon />}
      </div>
    </AnimatePresence>
  );
}

/* ─── Tap beacon: glowing pulsing cursor with click ripple ─── */
function TapBeacon() {
  return (
    <div style={{ position: 'relative', width: 44, height: 44 }}>
      {/* Outer slow pulse ring */}
      <motion.div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          border: '1px solid rgba(30, 144, 255, 0.6)',
        }}
        animate={{ scale: [1, 1.7, 1], opacity: [0.7, 0, 0.7] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Middle ring */}
      <motion.div
        style={{
          position: 'absolute',
          inset: 6,
          borderRadius: '50%',
          border: '1px solid rgba(77, 171, 247, 0.7)',
        }}
        animate={{ scale: [1, 1.5, 1], opacity: [0.8, 0, 0.8] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
      />
      {/* Inner solid dot */}
      <motion.div
        style={{
          position: 'absolute',
          inset: 14,
          borderRadius: '50%',
          background: 'radial-gradient(circle, #4dabf7, #1E90FF)',
          boxShadow: '0 0 12px rgba(30, 144, 255, 0.9), 0 0 4px rgba(77, 171, 247, 0.6)',
        }}
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut', delay: 0.1 }}
      />
    </div>
  );
}

/* ─── Drag beacon: cursor that slides and leaves a trail ─── */
function DragBeacon() {
  return (
    <motion.div
      style={{
        position: 'relative',
        width: 44,
        height: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      animate={{ x: [0, 260, 260, 0], y: [0, 120, 120, 0], opacity: [1, 1, 0, 0] }}
      transition={{
        duration: 2.2,
        repeat: Infinity,
        ease: [0.4, 0, 0.2, 1],
        times: [0, 0.55, 0.8, 1],
        repeatDelay: 0.3,
      }}
    >
      {/* Outer ripple */}
      <motion.div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          border: '1px solid rgba(30, 144, 255, 0.5)',
        }}
        animate={{ scale: [1, 1.6], opacity: [0.6, 0] }}
        transition={{ duration: 0.9, repeat: Infinity, ease: 'easeOut' }}
      />
      {/* Solid dot */}
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: 'radial-gradient(circle, #4dabf7, #1E90FF)',
          boxShadow: '0 0 14px rgba(30, 144, 255, 0.95), 0 0 6px rgba(77, 171, 247, 0.7)',
        }}
      />
      {/* Drag trail arrow */}
      <motion.div
        style={{
          position: 'absolute',
          right: -28,
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: 16,
          color: 'rgba(30, 144, 255, 0.85)',
          fontWeight: 700,
        }}
        animate={{ x: [0, 6, 0], opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
      >
        →
      </motion.div>
    </motion.div>
  );
}
