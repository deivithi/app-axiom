import { memo, useEffect, useState, createContext, useContext, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Info, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';

type ToastType = 'success' | 'error' | 'info' | 'loading';

interface ToastData {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
}

interface ToastProps extends ToastData {
  onClose: () => void;
}

const icons: Record<ToastType, typeof CheckCircle | typeof Loader2 | null> = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
  loading: Loader2,
};

const styles: Record<ToastType, string> = {
  success: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400',
  error: 'bg-destructive/20 border-destructive/30 text-destructive',
  info: 'bg-primary/20 border-primary/30 text-primary',
  loading: 'bg-card border-border text-foreground',
};

const Toast = memo(({ type, message, duration, onClose }: ToastProps) => {
  const [progress, setProgress] = useState(100);
  const Icon = icons[type];

  useEffect(() => {
    if (duration > 0 && type !== 'loading') {
      const interval = setInterval(() => {
        setProgress((prev) => {
          const next = prev - (100 / (duration / 50));
          if (next <= 0) {
            clearInterval(interval);
            onClose();
            return 0;
          }
          return next;
        });
      }, 50);

      return () => clearInterval(interval);
    }
  }, [duration, onClose, type]);

  const handleClose = useCallback(() => {
    haptics.light();
    onClose();
  }, [onClose]);

  return (
    <motion.div
      initial={{ y: -100, opacity: 0, scale: 0.9 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: -100, opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', bounce: 0.3, duration: 0.4 }}
      className={cn(
        'relative flex items-center gap-3 p-4 rounded-2xl border',
        'backdrop-blur-xl shadow-xl',
        styles[type]
      )}
      style={{ 
        paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))',
      }}
    >
      {Icon && (
        <Icon 
          className={cn(
            'w-5 h-5 flex-shrink-0',
            type === 'loading' && 'animate-spin'
          )} 
        />
      )}
      
      <p className="flex-1 text-sm font-medium text-foreground">{message}</p>
      
      {type !== 'loading' && (
        <button 
          onClick={handleClose} 
          className="p-1 rounded-full hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      )}

      {/* Progress bar */}
      {duration > 0 && type !== 'loading' && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 rounded-b-2xl overflow-hidden">
          <motion.div
            className="h-full bg-white/40"
            initial={{ width: '100%' }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.05, ease: 'linear' }}
          />
        </div>
      )}
    </motion.div>
  );
});

Toast.displayName = 'Toast';

// Toast Context
interface ToastContextValue {
  showToast: (type: ToastType, message: string, duration?: number) => string;
  hideToast: (id: string) => void;
  success: (message: string, duration?: number) => string;
  error: (message: string, duration?: number) => string;
  info: (message: string, duration?: number) => string;
  loading: (message: string) => string;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function MobileToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const showToast = useCallback((type: ToastType, message: string, duration = 3000): string => {
    const id = Math.random().toString(36).slice(2);
    
    // Haptic feedback based on type
    if (type === 'success') haptics.success();
    else if (type === 'error') haptics.error();
    else if (type === 'info') haptics.light();
    
    setToasts((prev) => [...prev, { id, type, message, duration }]);
    return id;
  }, []);

  const hideToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const success = useCallback((message: string, duration?: number) => 
    showToast('success', message, duration), [showToast]);
  
  const error = useCallback((message: string, duration?: number) => 
    showToast('error', message, duration), [showToast]);
  
  const info = useCallback((message: string, duration?: number) => 
    showToast('info', message, duration), [showToast]);
  
  const loading = useCallback((message: string) => 
    showToast('loading', message, 0), [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, hideToast, success, error, info, loading }}>
      {children}
      
      {/* Toast container */}
      <div 
        className="fixed top-0 left-0 right-0 z-[1500] px-4 pt-4 pointer-events-none"
        style={{ paddingTop: 'env(safe-area-inset-top, 1rem)' }}
      >
        <AnimatePresence mode="sync">
          {toasts.map((toast, index) => (
            <motion.div
              key={toast.id}
              className="pointer-events-auto mb-2"
              layout
              initial={{ opacity: 0, y: -20 }}
              animate={{ 
                opacity: 1, 
                y: 0,
                scale: 1 - (toasts.length - 1 - index) * 0.05,
              }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Toast
                {...toast}
                onClose={() => hideToast(toast.id)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useMobileToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useMobileToast must be used within MobileToastProvider');
  }
  return context;
}

export { Toast };
export type { ToastType, ToastData };
