import { AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { haptics } from "@/lib/haptics";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export function ErrorState({ 
  title = "Algo deu errado",
  message = "Não conseguimos carregar seus dados", 
  onRetry,
  retryLabel = "Tentar Novamente",
  className
}: ErrorStateProps) {
  const handleRetry = () => {
    haptics.heavy();
    onRetry?.();
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
      <motion.div 
        className="w-24 h-24 rounded-full bg-destructive/10 flex items-center justify-center mb-6"
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ 
          duration: 2, 
          repeat: Infinity, 
          ease: "easeInOut" 
        }}
      >
        <AlertCircle className="w-12 h-12 text-destructive" />
      </motion.div>
      
      <h3 className="font-display text-xl font-semibold text-foreground mb-2">
        {title}
      </h3>
      <p className="text-muted-foreground mb-6 max-w-sm leading-relaxed">
        {message}
      </p>
      
      {onRetry && (
        <button
          onClick={handleRetry}
          className="px-6 py-3 rounded-xl border-2 border-destructive text-destructive font-medium
                     hover:bg-destructive/10 active:scale-95 transition-all duration-200"
        >
          {retryLabel}
        </button>
      )}
    </motion.div>
  );
}
