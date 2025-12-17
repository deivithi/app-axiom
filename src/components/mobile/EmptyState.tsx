import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { haptics } from "@/lib/haptics";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  action,
  secondaryAction,
  className 
}: EmptyStateProps) {
  const handleAction = (callback: () => void) => {
    haptics.light();
    callback();
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        "flex flex-col items-center justify-center py-16 px-8 text-center",
        className
      )}
    >
      <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-6">
        <Icon className="w-12 h-12 text-primary" />
      </div>
      
      <h3 className="font-display text-xl font-semibold text-foreground mb-2">
        {title}
      </h3>
      <p className="text-muted-foreground mb-6 max-w-sm leading-relaxed">
        {description}
      </p>
      
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          {action && (
            <button
              onClick={() => handleAction(action.onClick)}
              className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium 
                         hover:bg-primary/90 active:scale-95 transition-all duration-200"
            >
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={() => handleAction(secondaryAction.onClick)}
              className="px-6 py-3 rounded-xl border border-border text-foreground font-medium
                         hover:bg-muted active:scale-95 transition-all duration-200"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}
