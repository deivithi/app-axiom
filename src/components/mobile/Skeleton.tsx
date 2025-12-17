import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'avatar' | 'card' | 'image';
  lines?: number;
  size?: 'sm' | 'md' | 'lg';
  aspectRatio?: string;
}

export function Skeleton({ 
  className, 
  variant = 'text',
  lines = 1,
  size = 'md',
  aspectRatio = '16/9'
}: SkeletonProps) {
  const baseClasses = "animate-shimmer rounded-md";
  
  const sizeClasses = {
    sm: 'h-3',
    md: 'h-4',
    lg: 'h-5'
  };

  const avatarSizes = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  };

  if (variant === 'avatar') {
    return (
      <div
        role="status"
        aria-label="Carregando..."
        className={cn(baseClasses, "rounded-full", avatarSizes[size], className)}
      />
    );
  }

  if (variant === 'card') {
    return (
      <div
        role="status"
        aria-label="Carregando..."
        className={cn(baseClasses, "w-full h-24 rounded-xl", className)}
      />
    );
  }

  if (variant === 'image') {
    return (
      <div
        role="status"
        aria-label="Carregando..."
        className={cn(baseClasses, "w-full rounded-xl", className)}
        style={{ aspectRatio }}
      />
    );
  }

  // Text variant with multiple lines support
  if (lines > 1) {
    return (
      <div role="status" aria-label="Carregando..." className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(
              baseClasses,
              sizeClasses[size],
              i === lines - 1 ? "w-2/3" : "w-full",
              className
            )}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-label="Carregando..."
      className={cn(baseClasses, sizeClasses[size], "w-full", className)}
    />
  );
}

// SkeletonAvatar - para perfil
export function SkeletonAvatar({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  return <Skeleton variant="avatar" size={size} />;
}

// SkeletonCard - para cards de score, transações, etc
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("p-4 space-y-3 bg-card/50 rounded-xl border border-border/50", className)}>
      <Skeleton variant="text" className="w-1/3" />
      <Skeleton variant="text" className="w-full" />
      <Skeleton variant="text" className="w-2/3" />
    </div>
  );
}

// SkeletonList - para listas
export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

// SkeletonScoreCard - específico para Intelligence
export function SkeletonScoreCard() {
  return (
    <div className="p-6 space-y-4 bg-card/50 rounded-2xl border border-border/50">
      <div className="flex items-center justify-between">
        <Skeleton variant="text" className="w-24" />
        <Skeleton variant="avatar" size="sm" />
      </div>
      <Skeleton variant="text" size="lg" className="w-16" />
      <div className="space-y-2">
        <Skeleton variant="text" size="sm" className="w-full" />
        <Skeleton variant="text" size="sm" className="w-3/4" />
      </div>
    </div>
  );
}

// SkeletonTransaction - para lista de transações
export function SkeletonTransaction() {
  return (
    <div className="flex items-center gap-3 p-3">
      <Skeleton variant="avatar" size="sm" />
      <div className="flex-1 space-y-2">
        <Skeleton variant="text" className="w-2/3" />
        <Skeleton variant="text" size="sm" className="w-1/3" />
      </div>
      <Skeleton variant="text" className="w-16" />
    </div>
  );
}
