import { useState, useCallback, useRef, useEffect } from 'react';
import { useHaptics } from './useHaptics';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
  maxPull?: number;
  disabled?: boolean;
}

interface UsePullToRefreshReturn {
  isRefreshing: boolean;
  pullProgress: number;
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
  };
  containerRef: React.RefObject<HTMLDivElement>;
}

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  maxPull = 120,
  disabled = false,
}: UsePullToRefreshOptions): UsePullToRefreshReturn {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);
  const startYRef = useRef(0);
  const currentYRef = useRef(0);
  const isPullingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { haptic } = useHaptics();

  const canPull = useCallback(() => {
    if (disabled || isRefreshing) return false;
    
    // Check if we're at the top of the scroll container
    const container = containerRef.current;
    if (!container) return true;
    
    return container.scrollTop <= 0;
  }, [disabled, isRefreshing]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (!canPull()) return;
    
    startYRef.current = e.touches[0].clientY;
    isPullingRef.current = true;
  }, [canPull]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPullingRef.current || !canPull()) return;
    
    currentYRef.current = e.touches[0].clientY;
    const diff = currentYRef.current - startYRef.current;
    
    if (diff > 0) {
      // Apply resistance
      const resistance = 0.4;
      const pull = Math.min(diff * resistance, maxPull);
      const progress = Math.min(pull / threshold, 1);
      
      setPullProgress(progress);
      
      // Haptic feedback at threshold
      if (progress >= 1 && pullProgress < 1) {
        haptic('medium');
      }
    }
  }, [canPull, maxPull, threshold, haptic, pullProgress]);

  const onTouchEnd = useCallback(async () => {
    if (!isPullingRef.current) return;
    
    isPullingRef.current = false;
    
    if (pullProgress >= 1 && !isRefreshing) {
      setIsRefreshing(true);
      haptic('success');
      
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
    
    setPullProgress(0);
  }, [pullProgress, isRefreshing, onRefresh, haptic]);

  // Reset on unmount
  useEffect(() => {
    return () => {
      isPullingRef.current = false;
      setPullProgress(0);
    };
  }, []);

  return {
    isRefreshing,
    pullProgress,
    handlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
    containerRef,
  };
}
