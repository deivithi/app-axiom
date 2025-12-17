import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import axiomLogo from '@/assets/axiom-logo.png';
interface AxiomMessageProps {
  content: string;
  timestamp: string;
}
const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  if (isToday(date)) {
    return format(date, 'HH:mm', {
      locale: ptBR
    });
  }
  if (isYesterday(date)) {
    return `Ontem ${format(date, 'HH:mm', {
      locale: ptBR
    })}`;
  }
  return format(date, "dd/MM 'às' HH:mm", {
    locale: ptBR
  });
};
export function AxiomMessage({
  content,
  timestamp
}: AxiomMessageProps) {
  return (
    <div className="chat-message assistant flex items-start gap-3 animate-fade-in">
      <img src={axiomLogo} alt="Axiom" className="w-8 h-8 rounded-full flex-shrink-0 bg-background" />
      <div className="flex flex-col max-w-[80%]">
        <span className="text-xs font-medium mb-1 ml-1 text-secondary-foreground">Axiom</span>
        <div className="bg-card border border-border rounded-2xl rounded-tl-md px-4 py-3">
          <div className="message-content whitespace-pre-wrap">{content}</div>
        </div>
        <span className="text-[10px] text-muted-foreground mt-1 ml-1">
          {formatTimestamp(timestamp)}
        </span>
      </div>
    </div>
  );
}