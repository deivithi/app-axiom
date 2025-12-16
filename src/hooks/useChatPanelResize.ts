import { useState, useCallback, useEffect } from 'react';

export type ChatPanelSize = 'compact' | 'normal' | 'expanded';

const SIZE_WIDTHS: Record<ChatPanelSize, string> = {
  compact: 'w-20',
  normal: 'w-96',
  expanded: 'w-[480px]'
};

const SIZE_MARGINS: Record<ChatPanelSize, string> = {
  compact: 'lg:mr-20',
  normal: 'lg:mr-96',
  expanded: 'lg:mr-[480px]'
};

const STORAGE_KEY = 'axiom-chat-panel-size';

export function useChatPanelResize() {
  const [size, setSize] = useState<ChatPanelSize>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && ['compact', 'normal', 'expanded'].includes(saved)) {
        return saved as ChatPanelSize;
      }
    }
    return 'normal';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, size);
  }, [size]);

  const cycleSize = useCallback(() => {
    setSize(current => {
      if (current === 'compact') return 'normal';
      if (current === 'normal') return 'expanded';
      return 'compact';
    });
  }, []);

  const setCompact = useCallback(() => setSize('compact'), []);
  const setNormal = useCallback(() => setSize('normal'), []);
  const setExpanded = useCallback(() => setSize('expanded'), []);

  return {
    size,
    setSize,
    cycleSize,
    setCompact,
    setNormal,
    setExpanded,
    widthClass: SIZE_WIDTHS[size],
    marginClass: SIZE_MARGINS[size],
    isCompact: size === 'compact',
    isNormal: size === 'normal',
    isExpanded: size === 'expanded'
  };
}
