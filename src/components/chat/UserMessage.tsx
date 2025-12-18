import { User } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface UserMessageProps {
  content: string;
  timestamp: string;
  avatarUrl?: string | null;
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

export function UserMessage({ content, timestamp, avatarUrl }: UserMessageProps) {
  return (
    <div className="chat-message user">
      <div className="message-row">
        <div className="message-column">
          <div className="message-bubble">
            <div className="message-content whitespace-pre-wrap">
              {content}
            </div>
          </div>
          <span className="message-timestamp">
            {formatTimestamp(timestamp)}
          </span>
        </div>
        {avatarUrl ? (
          <img 
            src={avatarUrl} 
            alt="Você"
            className="message-avatar"
          />
        ) : (
          <div className="message-avatar-placeholder">
            <User className="w-4 h-4 text-muted-foreground/70" />
          </div>
        )}
      </div>
    </div>
  );
}
