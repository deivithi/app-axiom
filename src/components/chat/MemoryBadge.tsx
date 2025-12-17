import { Brain, Lightbulb } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface MemoryBadgeProps {
  content: string;
  type?: 'reference' | 'context';
}

export function MemoryBadge({ content, type = 'reference' }: MemoryBadgeProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge 
          variant="outline" 
          className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-purple-500/10 text-purple-300 border-purple-500/30 cursor-help"
        >
          {type === 'reference' ? (
            <Brain className="w-3 h-3" />
          ) : (
            <Lightbulb className="w-3 h-3" />
          )}
          <span className="max-w-[200px] truncate">{content}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[300px]">
        <p className="text-sm">{content}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {type === 'reference' ? 'Memória utilizada nesta resposta' : 'Contexto ativo'}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

interface ContextBadgeProps {
  topics: string[];
}

export function ContextBadge({ topics }: ContextBadgeProps) {
  if (topics.length === 0) return null;
  
  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs text-primary">
      <Brain className="w-3.5 h-3.5" />
      <span>Contexto:</span>
      <span className="font-medium">{topics.slice(0, 3).join(' + ')}</span>
      {topics.length > 3 && <span className="text-muted-foreground">+{topics.length - 3}</span>}
    </div>
  );
}

interface MemoryUsageIndicatorProps {
  count: number;
}

export function MemoryUsageIndicator({ count }: MemoryUsageIndicatorProps) {
  if (count === 0) return null;
  
  return (
    <div className="text-center text-xs text-muted-foreground py-2">
      <span className="inline-flex items-center gap-1">
        <Brain className="w-3 h-3" />
        {count} memória{count !== 1 ? 's' : ''} utilizada{count !== 1 ? 's' : ''}
      </span>
    </div>
  );
}
