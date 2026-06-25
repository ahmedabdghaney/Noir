/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useRef, useState, ReactNode, TouchEvent } from 'react';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  disabled?: boolean;
}

const THRESHOLD = 80;   // px pull distance to trigger refresh
const MAX_PULL = 120;   // visual cap

export default function PullToRefresh({ onRefresh, children, disabled = false }: PullToRefreshProps) {
  const startY = useRef(0);
  const pulling = useRef(false);
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const onTouchStart = (e: TouchEvent) => {
    if (disabled || refreshing) return;
    // Only start when scrolled to the very top
    if (window.scrollY > 0) return;
    startY.current = e.touches[0].clientY;
    pulling.current = true;
  };

  const onTouchMove = (e: TouchEvent) => {
    if (!pulling.current || disabled || refreshing) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy <= 0) { setDistance(0); return; }
    // Rubber-band resistance
    const d = Math.min(MAX_PULL, dy * 0.5);
    setDistance(d);
  };

  const onTouchEnd = async () => {
    if (!pulling.current || disabled || refreshing) return;
    pulling.current = false;
    if (distance >= THRESHOLD) {
      setRefreshing(true);
      setDistance(THRESHOLD);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setDistance(0);
      }
    } else {
      setDistance(0);
    }
  };

  const progress = Math.min(1, distance / THRESHOLD);

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className="relative"
    >
      {/* Pull indicator */}
      <div
        className="absolute left-0 right-0 flex items-center justify-center pointer-events-none z-50"
        style={{
          top: 0,
          height: `${distance}px`,
          opacity: distance > 4 ? 1 : 0,
          transition: pulling.current ? 'none' : 'height 0.25s ease, opacity 0.25s ease',
        }}
      >
        <div className="glass-strong w-10 h-10 rounded-full flex items-center justify-center shadow-lg">
          <RefreshCw
            className={`w-5 h-5 text-white ${refreshing ? 'animate-spin' : ''}`}
            style={{ transform: refreshing ? undefined : `rotate(${progress * 270}deg)` }}
          />
        </div>
      </div>

      {/* Content shifts down while pulling */}
      <div
        style={{
          transform: `translateY(${distance}px)`,
          transition: pulling.current ? 'none' : 'transform 0.25s ease',
        }}
      >
        {children}
      </div>
    </div>
  );
}
