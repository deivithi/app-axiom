import { memo, useState, ReactNode } from 'react';
import { motion, PanInfo } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh: () => Promise<void>;
  threshold?: number;
  className?: string;
  disabled?: boolean;
}

export const PullToRefresh = memo(({
  children,
  onRefresh,
  threshold = 80,
  className,
  disabled = false,
}: PullToRefreshProps) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);

  const handleDrag = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    // Only allow pull when pulling down
    if (info.offset.y > 0 && !disabled && !isRefreshing) {
      setPullDistance(Math.min(info.offset.y, threshold * 1.5));
    }
  };

  const handleDragEnd = async (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > threshold && !disabled && !isRefreshing) {
      haptics.success();
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
    setPullDistance(0);
  };

  const progress = Math.min(pullDistance / threshold, 1);

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {/* Refresh indicator */}
      <motion.div
        className="absolute left-1/2 -translate-x-1/2 z-10 flex items-center justify-center"
        style={{
          top: -40,
        }}
        animate={{
          y: isRefreshing ? 60 : pullDistance * 0.6,
          opacity: isRefreshing ? 1 : progress,
          scale: isRefreshing ? 1 : 0.5 + progress * 0.5,
        }}
        transition={{ type: "spring", bounce: 0.3, duration: 0.3 }}
      >
        <div className="w-10 h-10 rounded-full bg-card border border-border shadow-lg flex items-center justify-center">
          <RefreshCw
            className={cn(
              "w-5 h-5 text-primary",
              isRefreshing && "animate-spin"
            )}
            style={{
              transform: !isRefreshing ? `rotate(${progress * 360}deg)` : undefined,
            }}
          />
        </div>
      </motion.div>

      {/* Draggable content */}
      <motion.div
        drag={disabled || isRefreshing ? false : "y"}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.4 }}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        animate={{ y: isRefreshing ? 50 : 0 }}
        transition={{ type: "spring", bounce: 0.3 }}
        className="h-full"
        style={{ touchAction: 'pan-x' }}
      >
        {children}
      </motion.div>
    </div>
  );
});

PullToRefresh.displayName = 'PullToRefresh';
