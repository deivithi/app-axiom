import { useCallback, useRef } from 'react';
import { useHaptics } from './useHaptics';

type SwipeDirection = 'left' | 'right' | 'up' | 'down';

interface UseSwipeGestureOptions {
  onSwipe?: (direction: SwipeDirection) => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number;
  hapticFeedback?: boolean;
}

interface UseSwipeGestureReturn {
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
  };
}

export function useSwipeGesture({
  onSwipe,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  threshold = 50,
  hapticFeedback = true,
}: UseSwipeGestureOptions): UseSwipeGestureReturn {
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const currentXRef = useRef(0);
  const currentYRef = useRef(0);
  const isSwipingRef = useRef(false);
  const { haptic } = useHaptics();

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    startYRef.current = e.touches[0].clientY;
    isSwipingRef.current = true;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isSwipingRef.current) return;
    
    currentXRef.current = e.touches[0].clientX;
    currentYRef.current = e.touches[0].clientY;
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!isSwipingRef.current) return;
    
    isSwipingRef.current = false;
    
    const diffX = currentXRef.current - startXRef.current;
    const diffY = currentYRef.current - startYRef.current;
    const absDiffX = Math.abs(diffX);
    const absDiffY = Math.abs(diffY);
    
    // Determine if it's a horizontal or vertical swipe
    if (absDiffX > absDiffY && absDiffX > threshold) {
      // Horizontal swipe
      const direction: SwipeDirection = diffX > 0 ? 'right' : 'left';
      
      if (hapticFeedback) {
        haptic('light');
      }
      
      onSwipe?.(direction);
      
      if (direction === 'left') {
        onSwipeLeft?.();
      } else {
        onSwipeRight?.();
      }
    } else if (absDiffY > absDiffX && absDiffY > threshold) {
      // Vertical swipe
      const direction: SwipeDirection = diffY > 0 ? 'down' : 'up';
      
      if (hapticFeedback) {
        haptic('light');
      }
      
      onSwipe?.(direction);
      
      if (direction === 'up') {
        onSwipeUp?.();
      } else {
        onSwipeDown?.();
      }
    }
    
    // Reset
    startXRef.current = 0;
    startYRef.current = 0;
    currentXRef.current = 0;
    currentYRef.current = 0;
  }, [threshold, hapticFeedback, haptic, onSwipe, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]);

  return {
    handlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
  };
}
