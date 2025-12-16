import { CheckCircle, ListTodo, Target, Bell, DollarSign, FileText, FolderKanban, BookOpen, Lightbulb, Globe } from 'lucide-react';

interface ActionConfirmationProps {
  message: string;
  module: string;
  timestamp: Date;
}

const moduleIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  tasks: ListTodo,
  habits: Target,
  reminders: Bell,
  finances: DollarSign,
  notes: FileText,
  projects: FolderKanban,
  diary: BookOpen,
  prompts: Lightbulb,
  sites: Globe,
};

export function ActionConfirmation({ message, module, timestamp }: ActionConfirmationProps) {
  const Icon = moduleIcons[module] || CheckCircle;
  
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex items-start gap-3 py-2">
      <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 text-sm max-w-fit">
        <Icon className="h-4 w-4 text-emerald-500 shrink-0" />
        <span className="text-emerald-400">{message}</span>
      </div>
      <span className="text-xs text-muted-foreground mt-2">{formatTime(timestamp)}</span>
    </div>
  );
}
