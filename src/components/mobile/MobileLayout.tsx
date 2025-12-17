import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { BottomNavigation } from './BottomNavigation';
import { pageTransition } from '@/lib/animations';

interface MobileLayoutProps {
  children: ReactNode;
  className?: string;
  hideNav?: boolean;
}

export function MobileLayout({ 
  children, 
  className,
  hideNav = false 
}: MobileLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <motion.main
        variants={pageTransition}
        initial="initial"
        animate="animate"
        exit="exit"
        className={cn(
          "flex-1 overflow-auto",
          "pt-safe-top",
          !hideNav && "pb-bottom-nav",
          className
        )}
      >
        {children}
      </motion.main>
      
      {!hideNav && <BottomNavigation />}
    </div>
  );
}
