import { cn } from '@/lib/utils';

interface PageSkeletonProps {
    /** Número de cards skeleton a exibir */
    cards?: number;
    /** Mostrar header skeleton */
    header?: boolean;
    className?: string;
}

/**
 * Skeleton loading padrão Material Design 3.
 * Usado em todas as páginas para manter loading state consistente.
 */
export function PageSkeleton({ cards = 3, header = true, className }: PageSkeletonProps) {
    return (
        <div className={cn('space-y-6 animate-pulse', className)}>
            {/* Header skeleton */}
            {header && (
                <div className="space-y-2">
                    <div className="h-7 w-48 bg-muted rounded-lg" />
                    <div className="h-4 w-72 bg-muted/60 rounded-md" />
                </div>
            )}

            {/* Stats row skeleton */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-20 bg-muted/40 rounded-xl border border-border/30" />
                ))}
            </div>

            {/* Cards skeleton */}
            <div className="space-y-4">
                {Array.from({ length: cards }).map((_, i) => (
                    <div
                        key={i}
                        className="h-32 bg-muted/30 rounded-xl border border-border/20"
                        style={{ opacity: 1 - (i * 0.2) }}
                    />
                ))}
            </div>
        </div>
    );
}
