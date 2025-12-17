import { memo, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh: () => Promise<void>;
  className?: string;
  disabled?: boolean;
}

const PullToRefresh = memo(({
  children,
  onRefresh,
  className,
  disabled = false,
}: PullToRefreshProps) => {
  const {
    isRefreshing,
    pullProgress,
    handlers,
    containerRef,
  } = usePullToRefresh({
    onRefresh,
    disabled,
  });

  const spinnerY = Math.min(pullProgress * 60, 60);
  const spinnerScale = Math.min(0.5 + pullProgress * 0.5, 1);
  const spinnerOpacity = Math.min(pullProgress, 1);

  return (
    <div 
      ref={containerRef}
      className={cn("relative overflow-auto", className)}
      {...handlers}
    >
      {/* Pull to refresh indicator */}
      <motion.div
        className={cn(
          "absolute left-1/2 -translate-x-1/2 z-10",
          "flex items-center justify-center",
          "w-10 h-10 rounded-full",
          "bg-card border border-border shadow-lg"
        )}
        style={{
          top: -50,
          y: spinnerY,
          scale: spinnerScale,
          opacity: spinnerOpacity,
        }}
      >
        <Loader2 
          className={cn(
            "w-5 h-5 text-primary",
            isRefreshing && "animate-spin"
          )}
          style={{
            transform: !isRefreshing 
              ? `rotate(${pullProgress * 360}deg)` 
              : undefined,
          }}
        />
      </motion.div>

      {/* Content with pull transform */}
      <motion.div
        style={{
          y: isRefreshing ? 50 : pullProgress * 50,
        }}
        transition={isRefreshing ? { duration: 0.2 } : { duration: 0 }}
      >
        {children}
      </motion.div>
    </div>
  );
});

PullToRefresh.displayName = 'PullToRefresh';

export { PullToRefresh };
