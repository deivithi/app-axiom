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
    <div className="chat-message user flex items-end gap-3 justify-end animate-fade-in">
      <div className="flex flex-col items-end max-w-[80%]">
        <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-3">
          <div className="message-content whitespace-pre-wrap">{content}</div>
        </div>
        <span className="text-[10px] text-muted-foreground mt-1 mr-1">
          {formatTimestamp(timestamp)}
        </span>
      </div>
      {avatarUrl ? (
        <img 
          src={avatarUrl} 
          alt="Você"
          className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-primary/50"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
