import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import axiomLogo from '@/assets/axiom-logo.png';
import { formatMessageContent } from '@/lib/formatMessage';

interface AxiomMessageProps {
  content: string;
  timestamp: string;
}

const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  if (isToday(date)) {
    return format(date, 'HH:mm', { locale: ptBR });
  }
  if (isYesterday(date)) {
    return `Ontem ${format(date, 'HH:mm', { locale: ptBR })}`;
  }
  return format(date, "dd/MM 'às' HH:mm", { locale: ptBR });
};

export function AxiomMessage({ content, timestamp }: AxiomMessageProps) {
  return (
    <div className="chat-message assistant">
      <div className="message-row">
        <img 
          src={axiomLogo} 
          alt="Axiom" 
          className="message-avatar bg-background" 
        />
        <div className="message-column">
          <div className="message-bubble">
            <div className="message-content">
              {formatMessageContent(content)}
            </div>
          </div>
          <span className="message-timestamp">
            {formatTimestamp(timestamp)}
          </span>
        </div>
      </div>
    </div>
  );
}
