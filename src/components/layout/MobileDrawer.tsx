import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileDrawerProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}

export const MobileDrawer = ({ open, setOpen, children, className }: MobileDrawerProps) => {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[90] md:hidden"
            style={{
              background: 'rgba(0, 0, 0, 0.4)',
              backdropFilter: 'blur(4px)'
            }}
          />
          
          {/* Drawer */}
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className={cn(
              "fixed left-0 top-0 h-full w-64 z-[100] md:hidden",
              "flex flex-col",
              className
            )}
            style={{
              background: 'var(--color-glass-bg)',
              backdropFilter: 'blur(var(--glass-blur))',
              borderRight: '1px solid var(--color-glass-border)',
              boxShadow: 'var(--shadow-xl)'
            }}
          >
            {/* Botão fechar */}
            <button
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 p-2 rounded-lg transition-colors z-10"
              style={{ 
                color: 'var(--color-text-secondary)',
                background: 'transparent'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'var(--color-bg-elevated-2)';
                e.currentTarget.style.color = 'var(--color-text-primary)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--color-text-secondary)';
              }}
              aria-label="Fechar menu"
            >
              <X className="h-5 w-5" />
            </button>
            
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
