import { memo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHaptics } from '@/hooks/useHaptics';

interface ActionSheetOption {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

interface ActionSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  options: ActionSheetOption[];
  cancelLabel?: string;
}

const ActionSheet = memo(({
  open,
  onClose,
  title,
  description,
  options,
  cancelLabel = 'Cancelar',
}: ActionSheetProps) => {
  const haptics = useHaptics();
  const sheetRef = useRef<HTMLDivElement>(null);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const handleDragEnd = useCallback((_: any, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 500) {
      onClose();
    }
  }, [onClose]);

  const handleOptionClick = useCallback((option: ActionSheetOption) => {
    if (option.disabled) return;
    
    option.destructive ? haptics.warning() : haptics.light();
    option.onClick();
    onClose();
  }, [haptics, onClose]);

  const handleCancel = useCallback(() => {
    haptics.light();
    onClose();
  }, [haptics, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0, scaleY: 0.95 }}
            animate={{ opacity: 1, scaleY: 1 }}
            exit={{ opacity: 0, scaleY: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-modal-backdrop bg-black/60 backdrop-blur-sm origin-bottom"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            ref={sheetRef}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            className={cn(
              "fixed bottom-0 left-0 right-0 z-modal",
              "bg-card/95 backdrop-blur-xl rounded-t-3xl",
              "pb-safe-bottom",
              "max-h-[85vh] overflow-hidden"
            )}
          >
            {/* Handle */}
            <div className="flex justify-center py-3">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Header */}
            {(title || description) && (
              <div className="px-6 pb-4 text-center border-b border-white/10">
                {title && (
                  <h3 className="text-lg font-semibold text-foreground">
                    {title}
                  </h3>
                )}
                {description && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {description}
                  </p>
                )}
              </div>
            )}

            {/* Options */}
            <div className="px-4 space-y-1">
              {options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleOptionClick(option)}
                  disabled={option.disabled}
                  className={cn(
                    "w-full flex items-center gap-3",
                    "px-4 py-3.5 rounded-xl",
                    "transition-colors duration-150",
                    "active:scale-[0.98]",
                    option.disabled
                      ? "opacity-50 cursor-not-allowed"
                      : option.destructive
                        ? "text-destructive hover:bg-destructive/10"
                        : "text-primary hover:bg-white/5 active:bg-white/10"
                  )}
                >
                  {option.icon && (
                    <span className="flex-shrink-0">
                      {option.icon}
                    </span>
                  )}
                  <span className="font-medium">
                    {option.label}
                  </span>
                </button>
              ))}
            </div>

            {/* Cancel Button */}
            <div className="p-4 mt-2">
              <button
                onClick={handleCancel}
                className={cn(
                  "w-full py-3.5 rounded-xl",
                  "bg-muted text-foreground font-semibold",
                  "transition-colors duration-150",
                  "hover:bg-muted/80",
                  "active:scale-[0.98]"
                )}
              >
                {cancelLabel}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
});

ActionSheet.displayName = 'ActionSheet';

export { ActionSheet };
export type { ActionSheetOption, ActionSheetProps };
