type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

class HapticsManager {
  private isSupported: boolean;

  constructor() {
    this.isSupported = typeof window !== 'undefined' && 'vibrate' in navigator;
  }

  private vibrate(pattern: number | number[]) {
    if (!this.isSupported) return;
    try {
      navigator.vibrate(pattern);
    } catch {
      // Silently fail if vibration is not available
    }
  }

  light() { this.vibrate(10); }
  medium() { this.vibrate(20); }
  heavy() { this.vibrate(50); }
  success() { this.vibrate([10, 50, 10]); }
  warning() { this.vibrate([20, 50, 20]); }
  error() { this.vibrate([50, 100, 50, 100, 50]); }

  trigger(type: HapticPattern) {
    this[type]();
  }
}

export const haptics = new HapticsManager();
export type { HapticPattern };
