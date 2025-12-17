import { useCallback } from 'react';

type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

const hapticPatterns: Record<HapticType, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 30,
  success: [10, 50, 10],
  warning: [20, 50, 20],
  error: [30, 50, 30, 50, 30],
};

export function useHaptics() {
  const haptic = useCallback((type: HapticType = 'light') => {
    if (typeof navigator === 'undefined') return;
    
    // Check if Vibration API is supported
    if ('vibrate' in navigator) {
      const pattern = hapticPatterns[type];
      try {
        navigator.vibrate(pattern);
      } catch (e) {
        // Silently fail if vibration is not available
      }
    }
  }, []);

  const selectionChanged = useCallback(() => {
    haptic('light');
  }, [haptic]);

  const impactOccurred = useCallback((style: 'light' | 'medium' | 'heavy' = 'medium') => {
    haptic(style);
  }, [haptic]);

  const notificationOccurred = useCallback((type: 'success' | 'warning' | 'error') => {
    haptic(type);
  }, [haptic]);

  return {
    haptic,
    selectionChanged,
    impactOccurred,
    notificationOccurred,
  };
}
