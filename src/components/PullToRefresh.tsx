import React, { useState, useRef, useEffect } from 'react';
import { motion, useMotionValue, useTransform, useSpring } from 'motion/react';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

const PULL_THRESHOLD = 80;

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pullY = useMotionValue(0);
  const springPullY = useSpring(pullY, { damping: 20, stiffness: 200 });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const dragging = useRef(false);

  // Map the drag distance to a more subtle movement for the indicator
  const indicatorY = useTransform(springPullY, [0, PULL_THRESHOLD], [-40, 20]);
  const opacity = useTransform(springPullY, [0, PULL_THRESHOLD / 2, PULL_THRESHOLD], [0, 0.5, 1]);
  const rotate = useTransform(springPullY, [0, PULL_THRESHOLD], [0, 360]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      // Check if we are at the top of the window scroll
      if (window.scrollY === 0) {
        startY.current = e.touches[0].pageY;
        dragging.current = true;
      } else {
        dragging.current = false;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!dragging.current || isRefreshing) return;

      const currentY = e.touches[0].pageY;
      const diff = currentY - startY.current;

      // Only handle pull-to-refresh if we are at the very top
      if (diff > 0 && window.scrollY <= 0) {
        // We are pulling down
        // Apply resistance (clamping)
        const val = Math.min(diff * 0.4, PULL_THRESHOLD + 20);
        pullY.set(val);

        // If we've started pulling, prevent browser pull-to-refresh
        if (val > 5 && e.cancelable) {
          e.preventDefault();
        }
      } else {
        // We are scrolling or pulling up
        if (pullY.get() !== 0) {
          pullY.set(0);
        }
        if (diff < 0) {
          dragging.current = false;
        }
      }
    };

    const onTouchEnd = async () => {
      if (!dragging.current) return;
      dragging.current = false;

      if (pullY.get() >= PULL_THRESHOLD) {
        setIsRefreshing(true);
        pullY.set(PULL_THRESHOLD / 2); // Hold position while refreshing
        
        try {
          await onRefresh();
        } finally {
          setIsRefreshing(false);
          pullY.set(0);
        }
      } else {
        pullY.set(0);
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [isRefreshing, onRefresh, pullY]);

  return (
    <div ref={containerRef} className="relative min-h-full">
      {/* Refresh Indicator */}
      <motion.div
        style={{ 
          y: isRefreshing ? 20 : indicatorY,
          opacity: isRefreshing ? 1 : opacity,
          left: '50%',
          translateX: '-50%'
        }}
        className="absolute z-[100] pointer-events-none"
      >
        <div className="bg-gradient-to-br from-[var(--card)] to-[var(--card2)] border border-[var(--border)] p-2.5 rounded-full shadow-2xl flex items-center justify-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-[var(--teal)]/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <motion.div
            style={{ rotate: isRefreshing ? 0 : rotate }}
            animate={isRefreshing ? { rotate: 360 } : {}}
            transition={isRefreshing ? { repeat: Infinity, duration: 1, ease: "linear" } : { type: "spring", damping: 15 }}
          >
            <RefreshCw size={22} className="text-[var(--teal)] drop-shadow-[0_0_8px_rgba(0,212,177,0.4)]" />
          </motion.div>
        </div>
      </motion.div>

      {/* Content Area - Moves slightly when pulled */}
      <motion.div
        style={{ y: springPullY }}
        className="will-change-transform"
      >
        {children}
      </motion.div>
    </div>
  );
}
