import { useRef, useState, useCallback, useEffect, useMemo } from 'react';

interface UseChatScrollOptions {
  threshold?: number;
  onLoadMore?: () => Promise<void>;
}

export function useChatScroll({ threshold = 50, onLoadMore }: UseChatScrollOptions = {}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const isLoadingMore = useRef(false);
  const prevScrollHeight = useRef(0);

  // Check if user is at bottom of scroll
  const checkIsAtBottom = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return true;
    
    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    return distanceFromBottom <= threshold;
  }, [threshold]);

  // Scroll to bottom smoothly
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
    setIsAtBottom(true);
    setUnreadCount(0);
  }, []);

  // Handle scroll events with debounce
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const atBottom = checkIsAtBottom();
    setIsAtBottom(atBottom);
    
    if (atBottom) {
      setUnreadCount(0);
    }

    // Check if at top to load more
    if (container.scrollTop <= 100 && onLoadMore && !isLoadingMore.current) {
      isLoadingMore.current = true;
      prevScrollHeight.current = container.scrollHeight;
      
      onLoadMore().finally(() => {
        isLoadingMore.current = false;
        // Maintain scroll position after loading older messages
        requestAnimationFrame(() => {
          if (container && prevScrollHeight.current) {
            const newScrollHeight = container.scrollHeight;
            const scrollDiff = newScrollHeight - prevScrollHeight.current;
            container.scrollTop = scrollDiff;
          }
        });
      });
    }
  }, [checkIsAtBottom, onLoadMore]);

  // Debounced scroll handler
  const debouncedHandleScroll = useMemo(() => {
    let timeoutId: NodeJS.Timeout;
    return () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleScroll, 100);
    };
  }, [handleScroll]);

  // Increment unread count when new message arrives and not at bottom
  const incrementUnread = useCallback(() => {
    if (!isAtBottom) {
      setUnreadCount(prev => prev + 1);
    }
  }, [isAtBottom]);

  // Auto-scroll on new messages if at bottom
  const handleNewMessage = useCallback(() => {
    if (isAtBottom) {
      requestAnimationFrame(() => {
        scrollToBottom('smooth');
      });
    } else {
      incrementUnread();
    }
  }, [isAtBottom, scrollToBottom, incrementUnread]);

  // Initial scroll to bottom
  useEffect(() => {
    scrollToBottom('instant');
  }, []);

  return {
    scrollContainerRef,
    messagesEndRef,
    isAtBottom,
    unreadCount,
    scrollToBottom,
    handleScroll: debouncedHandleScroll,
    handleNewMessage,
    incrementUnread
  };
}
