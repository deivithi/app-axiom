import { useState } from 'react';
import { AlertTriangle, HelpCircle, Lightbulb, Clock, X, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import axiomLogo from '@/assets/axiom-logo.png';

interface ProactiveQuestionProps {
  id: string;
  question: string;
  priority: 'critical' | 'important' | 'normal' | 'reflective';
  triggerType: string;
  timestamp: string;
  onRespond: (id: string) => void;
  onDismiss: (id: string) => void;
}

export function ProactiveQuestion({ 
  id, 
  question, 
  priority, 
  triggerType, 
  timestamp,
  onRespond,
  onDismiss
}: ProactiveQuestionProps) {
  const [isHovered, setIsHovered] = useState(false);

  const priorityConfig = {
    critical: {
      icon: AlertTriangle,
      bg: 'bg-destructive/10 border-destructive/30',
      iconColor: 'text-destructive',
      label: 'Urgente',
      labelBg: 'bg-destructive/20 text-destructive'
    },
    important: {
      icon: HelpCircle,
      bg: 'bg-amber-500/10 border-amber-500/30',
      iconColor: 'text-amber-500',
      label: 'Importante',
      labelBg: 'bg-amber-500/20 text-amber-500'
    },
    normal: {
      icon: Lightbulb,
      bg: 'bg-primary/10 border-primary/30',
      iconColor: 'text-primary',
      label: 'Insight',
      labelBg: 'bg-primary/20 text-primary'
    },
    reflective: {
      icon: Clock,
      bg: 'bg-muted border-border',
      iconColor: 'text-muted-foreground',
      label: 'Reflexão',
      labelBg: 'bg-muted text-muted-foreground'
    }
  };

  const config = priorityConfig[priority];
  const Icon = config.icon;

  const triggerLabels: Record<string, string> = {
    score_drop: 'Desempenho',
    project_inactive: 'Projeto',
    habit_broken: 'Hábito',
    spending_anomaly: 'Finanças',
    daily: 'Diária',
    custom: 'Análise'
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `${diffMins}min atrás`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h atrás`;
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  return (
    <div 
      className={cn(
        "relative flex gap-3 p-4 rounded-lg border-2 transition-all duration-200",
        config.bg,
        isHovered && "shadow-lg"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Dismiss button */}
      <button
        onClick={() => onDismiss(id)}
        className="absolute top-2 right-2 p-1 rounded-full hover:bg-background/50 transition-colors opacity-50 hover:opacity-100"
        title="Responder depois"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Axiom Avatar */}
      <div className="flex-shrink-0">
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center",
          priority === 'critical' ? 'bg-destructive/20 animate-pulse' : 'bg-card'
        )}>
          <img src={axiomLogo} alt="Axiom" className="w-6 h-6" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pr-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium text-muted-foreground">Pergunta Axiom</span>
          <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", config.labelBg)}>
            {config.label}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            {triggerLabels[triggerType] || triggerType}
          </span>
        </div>

        <div className="flex items-start gap-2">
          <Icon className={cn("h-5 w-5 flex-shrink-0 mt-0.5", config.iconColor)} />
          <p className="text-sm text-foreground leading-relaxed">{question}</p>
        </div>

        <div className="flex items-center justify-between mt-3">
          <span className="text-[10px] text-muted-foreground">{formatTime(timestamp)}</span>
          <Button 
            size="sm" 
            variant="secondary"
            onClick={() => onRespond(id)}
            className="h-7 text-xs gap-1"
          >
            <MessageSquare className="h-3 w-3" />
            Responder
          </Button>
        </div>
      </div>
    </div>
  );
}
