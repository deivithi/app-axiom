import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
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
      
      // Show checkmark for 500ms
      setTimeout(() => {
        setIsSending(false);
        inputRef.current?.focus();
      }, 500);
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


      {/* Main input container */}
      <div className={cn(
        "chat-input-container",
        isFocused && "chat-input-focused",
        isRecording && "chat-input-recording"
      )}>
        {/* Microphone button with pulse rings */}
        {/* Microphone button with pulse rings */}
        <button
          type="button"
          onClick={onToggleRecording}
          disabled={isLoading || isTranscribing || disabled}
          aria-label={isTranscribing ? "Transcrevendo áudio..." : isRecording ? "Parar gravação" : "Gravar áudio"}
          className={cn(
            "chat-mic-button",
            isRecording && "text-destructive"
          )}
        >
          {isRecording && (
            <>
              <span className="chat-mic-pulse-ring" aria-hidden="true" />
              <span className="chat-mic-pulse-ring delay-1" aria-hidden="true" />
              <span className="chat-mic-pulse-ring delay-2" aria-hidden="true" />
            </>
          )}
          
          {isTranscribing ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
          ) : isRecording ? (
            <Square className="h-5 w-5 fill-current" aria-hidden="true" />
          ) : (
            <Mic className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          )}
        </button>

        {/* Waveform OR Input (conditional) */}
        {isRecording ? (
          <div className="chat-waveform-container">
            <div className="chat-waveform">
              {[...Array(5)].map((_, i) => (
                <span 
                  key={i} 
                  className="chat-wave"
                  style={{ animationDelay: `${i * 0.1}s` }}
                />
              ))}
            </div>
            <span className="chat-recording-timer">{formatTime(recordingTime)}</span>
          </div>
        ) : (
          <Textarea
            ref={inputRef}
            value={value}
            onChange={e => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Converse com Axiom..."
            className="chat-input-field"
            rows={1}
            maxLength={4000}
            disabled={isLoading || isTranscribing || disabled}
          />
        )}

        {/* Send button with gradient and checkmark feedback */}
        <button
          type="button"
          onClick={handleSend}
          disabled={isLoading || !value.trim() || isRecording || disabled}
          aria-label={isSending ? "Mensagem enviada" : isLoading ? "Enviando..." : "Enviar mensagem"}
          aria-disabled={!value.trim() || isLoading}
          className={cn(
            "chat-send-button",
            isSending && "sending"
          )}
        >
          {isSending ? (
            <Check className="h-4 w-4 text-white" aria-hidden="true" />
          ) : isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-white" aria-hidden="true" />
          ) : (
            <Send className="h-4 w-4 text-white" aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}
