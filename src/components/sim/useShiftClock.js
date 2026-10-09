import { useEffect, useRef, useState } from 'react';

// Whole-second shift clock. The server-issued deadline is the real authority
// in the shipped design; this drives the on-screen timer and arrivals.
export function useShiftClock({ durationSec, running, onTick, onEnd }) {
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef(0);
  const cb = useRef({ onTick, onEnd });
  useEffect(() => { cb.current = { onTick, onEnd }; });
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => {
      const next = elapsedRef.current + 1;
      elapsedRef.current = next;
      setElapsed(next);
      cb.current.onTick?.(next);
      if (next >= durationSec) {
        clearInterval(id);
        cb.current.onEnd?.();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [running, durationSec]);
  return elapsed;
}

export function fmtClock(sec) {
  const s = Math.max(0, Math.ceil(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
