import { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: ReactNode;
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
  /** Dica contextual da IA (ex: "Posso te ajudar a configurar!") */
  aiTip?: {
    text: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  aiTip,
  className,
}: EmptyStateProps) {
  return (
    <Card className={cn('p-8 text-center empty-state-enhanced', className)}>
      <div className="flex flex-col items-center gap-4 relative z-10">
        <div className="p-4 rounded-full bg-primary/10 text-primary animate-check-success">
          {icon}
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            {description}
          </p>
        </div>
        {(action || secondaryAction) && (
          <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
            {action && (
              <Button onClick={action.onClick}>
                {action.label}
              </Button>
            )}
            {secondaryAction && (
              <Button variant="outline" onClick={secondaryAction.onClick}>
                {secondaryAction.label}
              </Button>
            )}
          </div>
        )}
        {aiTip && (
          <button
            onClick={aiTip.onClick}
            className="empty-state-ai-tip"
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            {aiTip.text}
          </button>
        )}
      </div>
    </Card>
  );
}

