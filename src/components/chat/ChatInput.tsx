import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Mic, MicOff, Loader2, Check, Square } from 'lucide-react';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onToggleRecording: () => void;
  isLoading?: boolean;
  isRecording?: boolean;
  isTranscribing?: boolean;
  disabled?: boolean;
}

export function ChatInput({
  value,
  onChange,
  onSend,
  onKeyDown,
  onToggleRecording,
  isLoading = false,
  isRecording = false,
  isTranscribing = false,
  disabled = false
}: ChatInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Recording timer
  useEffect(() => {
    if (isRecording) {
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setRecordingTime(0);
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording]);

  // Send with visual feedback
  const handleSend = useCallback(() => {
    if (value.trim() && !isLoading && !isRecording) {
      setIsSending(true);
      onSend();
      
      // Show checkmark for 600ms
      setTimeout(() => {
        setIsSending(false);
        inputRef.current?.focus();
      }, 600);
    }
  }, [value, isLoading, isRecording, onSend]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="chat-input-area">
      {/* Typing indicator - shown when Axiom is responding */}
      {isLoading && !isRecording && (
        <div className="chat-typing-indicator">
          <span className="text-muted-foreground text-sm">Axiom está digitando</span>
          <div className="chat-typing-dots">
            <span />
            <span />
            <span />
          </div>
        </div>
      )}

      {/* Recording indicator with timer */}
      {isRecording && (
        <div className="chat-recording-indicator">
          <div className="chat-sound-waves">
            {[...Array(5)].map((_, i) => (
              <span 
                key={i} 
                className="chat-wave"
                style={{ animationDelay: `${i * 0.1}s` }}
              />
            ))}
          </div>
          <span className="chat-recording-timer">{formatTime(recordingTime)}</span>
          <span className="text-destructive text-sm ml-2">Gravando...</span>
        </div>
      )}

      {/* Main input container */}
      <div className={cn(
        "chat-input-container",
        isFocused && "chat-input-focused",
        isRecording && "chat-input-recording"
      )}>
        {/* Microphone button */}
        <Button
          type="button"
          size="icon"
          variant={isRecording ? 'destructive' : 'ghost'}
          onClick={onToggleRecording}
          disabled={isLoading || isTranscribing || disabled}
          className={cn(
            "h-9 w-9 shrink-0 transition-all",
            isRecording && "animate-pulse"
          )}
        >
          {isTranscribing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isRecording ? (
            <Square className="h-4 w-4" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
        </Button>

        {/* Input field */}
        <Textarea
          ref={inputRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={isRecording ? "Gravando áudio..." : "Converse com Axiom..."}
          className="chat-input-field"
          rows={1}
          disabled={isLoading || isRecording || isTranscribing || disabled}
        />

        {/* Send button with checkmark feedback */}
        <Button
          type="button"
          size="icon"
          onClick={handleSend}
          disabled={isLoading || !value.trim() || isRecording || disabled}
          className={cn(
            "h-9 w-9 shrink-0 transition-all",
            isSending && "bg-emerald-500 hover:bg-emerald-500"
          )}
        >
          {isSending ? (
            <Check className="h-4 w-4 text-white animate-scale-in" />
          ) : isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
