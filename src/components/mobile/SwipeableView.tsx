import { memo, useRef, useState } from 'react';
import { motion, PanInfo } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { haptics } from '@/lib/haptics';

interface SwipeableViewProps {
  children: React.ReactNode;
  onSwipeBack?: () => void;
  threshold?: number;
  enabled?: boolean;
  edgeOnly?: boolean;
}

export const SwipeableView = memo(({ 
  children, 
  onSwipeBack,
  threshold = 100,
  enabled = true,
  edgeOnly = true
}: SwipeableViewProps) => {
  const navigate = useNavigate();
  const constraintsRef = useRef<HTMLDivElement>(null);
  const [isEdgeSwipe, setIsEdgeSwipe] = useState(false);

  const handleDragStart = (event: MouseEvent | TouchEvent | PointerEvent) => {
    const clientX = 'touches' in event 
      ? event.touches[0]?.clientX 
      : (event as MouseEvent).clientX;
    
    // Edge detection: only allow swipe if starting from left 20px
    const isFromEdge = clientX !== undefined && clientX < 20;
    setIsEdgeSwipe(edgeOnly ? isFromEdge : true);
  };

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (!isEdgeSwipe) return;
    
    // Only trigger on right swipe past threshold with positive velocity
    if (info.offset.x > threshold && info.velocity.x > 0) {
      haptics.light();
      if (onSwipeBack) {
        onSwipeBack();
      } else {
        navigate(-1);
      }
    }
    setIsEdgeSwipe(false);
  };

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <motion.div
      ref={constraintsRef}
      drag={isEdgeSwipe || !edgeOnly ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={{ left: 0, right: 0.2 }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className="h-full w-full"
      style={{ 
        touchAction: 'pan-y',
        willChange: 'transform'
      }}
    >
      {children}
    </motion.div>
  );
});

SwipeableView.displayName = 'SwipeableView';
