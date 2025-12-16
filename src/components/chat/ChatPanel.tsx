import { useEffect, useRef, memo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Send, Loader2, Mic, MicOff, X, Minimize2, Maximize2, Square, ChevronDown } from 'lucide-react';
import { UserMessage } from '@/components/chat/UserMessage';
import { AxiomMessage } from '@/components/chat/AxiomMessage';
import { AxiomTyping } from '@/components/chat/AxiomTyping';
import { ActionConfirmation } from '@/components/chat/ActionConfirmation';
import { ProactiveQuestion } from '@/components/chat/ProactiveQuestion';
import { OnboardingOptions } from '@/components/chat/OnboardingOptions';
import { WeeklyReportCard } from '@/components/chat/WeeklyReportCard';
import { useChatContext } from '@/contexts/ChatContext';
import { useChatPanelResize } from '@/hooks/useChatPanelResize';
import { useChatScroll } from '@/hooks/useChatScroll';
import axiomLogo from '@/assets/axiom-logo.png';

const ONBOARDING_OPTIONS = [
  { id: 'empreendedor', emoji: '👔', label: 'Empreendedor Solo', description: 'Projetos de produto, marketing, vendas e finanças' },
  { id: 'executivo', emoji: '💼', label: 'Executivo Corporativo', description: 'OKRs, gestão de time e stakeholders' },
  { id: 'freelancer', emoji: '🎨', label: 'Freelancer Criativo', description: 'Clientes, portfólio e prospecção' },
  { id: 'vendas', emoji: '📊', label: 'Profissional de Vendas', description: 'Pipeline, comissões e eventos' },
  { id: 'personalizado', emoji: '⚙️', label: 'Personalizado', description: 'Eu te guio passo a passo' }
];

interface ChatPanelProps {
  isExpanded: boolean;
  onToggle: () => void;
}

// Memoized message item component
const MessageItem = memo(({ 
  msg, 
  userAvatar 
}: { 
  msg: { id: string; content: string; is_ai: boolean; created_at: string }; 
  userAvatar: string | null;
}) => {
  const isWeeklyReport = msg.is_ai && (
    msg.content.includes('📊 **Axiom Insights**') || 
    msg.content.includes('📊 **Relatório Completo da Semana**')
  );
  
  if (isWeeklyReport) {
    return (
      <WeeklyReportCard 
        content={msg.content} 
        timestamp={msg.created_at}
        isFullReport={msg.content.includes('Relatório Completo')}
      />
    );
  }
  
  return msg.is_ai ? (
    <AxiomMessage content={msg.content} timestamp={msg.created_at} />
  ) : (
    <UserMessage content={msg.content} timestamp={msg.created_at} avatarUrl={userAvatar} />
  );
});

MessageItem.displayName = 'MessageItem';

export function ChatPanel({ isExpanded, onToggle }: ChatPanelProps) {
  const {
    messages,
    uiActions,
    input,
    setInput,
    loading,
    loadingMessages,
    loadingMore,
    hasMoreMessages,
    isRecording,
    isTranscribing,
    userAvatar,
    sendMessage,
    toggleRecording,
    handleKeyDown,
    proactiveQuestions,
    respondingToQuestion,
    setRespondingToQuestion,
    handleRespondToQuestion,
    handleDismissQuestion,
    loadMoreMessages
  } = useChatContext();

  const { 
    size, 
    setCompact, 
    setNormal, 
    setExpanded, 
    widthClass, 
    isCompact 
  } = useChatPanelResize();

  const {
    scrollContainerRef,
    messagesEndRef,
    isAtBottom,
    unreadCount,
    scrollToBottom,
    handleScroll,
    handleNewMessage
  } = useChatScroll({ 
    threshold: 50, 
    onLoadMore: hasMoreMessages ? loadMoreMessages : undefined 
  });

  const prevMessagesLength = useRef(messages.length);

  // Handle new messages - auto scroll if at bottom
  useEffect(() => {
    if (messages.length > prevMessagesLength.current) {
      handleNewMessage();
    }
    prevMessagesLength.current = messages.length;
  }, [messages.length, handleNewMessage]);

  // Initial scroll to bottom when messages first load
  useEffect(() => {
    if (!loadingMessages && messages.length > 0) {
      scrollToBottom('instant');
    }
  }, [loadingMessages]);

  const handleOnboardingSelect = (id: string) => {
    const labels: Record<string, string> = {
      empreendedor: 'Empreendedor Solo',
      executivo: 'Executivo Corporativo',
      freelancer: 'Freelancer Criativo',
      vendas: 'Profissional de Vendas',
      personalizado: 'Quero criar minha configuração personalizada'
    };
    setInput(labels[id] || id);
    setTimeout(() => sendMessage(), 100);
  };

  // Compact mode: show only avatar and expand button
  if (isCompact) {
    return (
      <aside className={cn(
        "chat-panel fixed right-0 top-0 h-screen z-40",
        "w-20 flex flex-col items-center",
        "bg-card/95 backdrop-blur-xl",
        "border-l border-border/50",
        "transition-all duration-300",
        isExpanded ? "translate-x-0" : "translate-x-full",
        "lg:translate-x-0"
      )}>
        {/* Compact Header */}
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="relative cursor-pointer" onClick={setNormal}>
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center hover:bg-primary/30 transition-colors">
              <img src={axiomLogo} alt="Axiom" className="w-8 h-8" />
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-card" />
          </div>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={setNormal}
                className="text-muted-foreground hover:text-foreground"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Expandir chat</TooltipContent>
          </Tooltip>
        </div>
        
        {/* Unread indicator */}
        {messages.length > 0 && (
          <div className="mt-auto mb-4">
            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
              {messages.filter(m => m.is_ai).length}
            </div>
          </div>
        )}
      </aside>
    );
  }

  return (
    <aside className={cn(
      "chat-panel fixed right-0 top-0 h-screen z-40",
      "flex flex-col",
      "bg-card/95 backdrop-blur-xl",
      "border-l border-border/50",
      "transition-all duration-300",
      // Mobile: always full width
      "w-full sm:w-96",
      // Desktop: respect size setting
      `lg:${widthClass}`,
      isExpanded ? "translate-x-0" : "translate-x-full",
      "lg:translate-x-0"
    )}>
      {/* Chat Header */}
      <div className="chat-header flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <img src={axiomLogo} alt="Axiom" className="w-6 h-6" />
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-card" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Axiom</h3>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Online
            </span>
          </div>
        </div>
        
        {/* Size controls */}
        <div className="flex items-center gap-1">
          {/* Desktop size controls */}
          <div className="hidden lg:flex items-center gap-1">
            <SizeButton 
              icon={<Minimize2 className="h-3.5 w-3.5" />}
              label="Compacto"
              active={size === 'compact'}
              onClick={setCompact}
            />
            <SizeButton 
              icon={<Square className="h-3.5 w-3.5" />}
              label="Normal"
              active={size === 'normal'}
              onClick={setNormal}
            />
            <SizeButton 
              icon={<Maximize2 className="h-3.5 w-3.5" />}
              label="Expandido"
              active={size === 'expanded'}
              onClick={setExpanded}
            />
          </div>
          
          {/* Mobile close button */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="lg:hidden"
            onClick={onToggle}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages Container */}
      <div className="relative flex-1 overflow-hidden">
        <div 
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="messages-container h-full overflow-y-auto p-4"
        >
          <div className="space-y-4">
            {/* Loading more indicator */}
            {loadingMore && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground ml-2">
                  Carregando mensagens antigas...
                </span>
              </div>
            )}
            
            {loadingMessages ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 && uiActions.length === 0 ? (
              <div className="py-4">
                <AxiomMessage 
                  content={`Olá! Sou Axiom, seu estrategista de vida. 🎯

Vou te ajudar a organizar tudo: dinheiro, projetos, hábitos, tarefas.

Pra começar rápido, escolha quem você é:`}
                  timestamp={new Date().toISOString()}
                />
                <OnboardingOptions 
                  options={ONBOARDING_OPTIONS}
                  onSelect={handleOnboardingSelect}
                  disabled={loading}
                />
              </div>
            ) : (
              <>
                {/* Proactive Questions */}
                {proactiveQuestions.length > 0 && (
                  <div className="space-y-3 mb-4">
                    {proactiveQuestions.map(q => (
                      <ProactiveQuestion
                        key={q.id}
                        id={q.id}
                        question={q.question}
                        priority={q.priority as 'critical' | 'important' | 'normal' | 'reflective'}
                        triggerType={q.trigger_type}
                        timestamp={q.created_at}
                        onRespond={handleRespondToQuestion}
                        onDismiss={handleDismissQuestion}
                      />
                    ))}
                  </div>
                )}
                
                {/* Messages */}
                {messages.map(msg => (
                  <MessageItem key={msg.id} msg={msg} userAvatar={userAvatar} />
                ))}
                
                {/* UI Actions */}
                {uiActions.map(action => (
                  <ActionConfirmation 
                    key={action.id} 
                    message={action.message} 
                    module={action.module} 
                    timestamp={action.timestamp} 
                  />
                ))}
              </>
            )}
            
            {loading && <AxiomTyping />}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Floating scroll to bottom button */}
        {!isAtBottom && (
          <button 
            onClick={() => scrollToBottom('smooth')}
            className="absolute bottom-4 right-4 z-10 w-10 h-10 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors"
          >
            <ChevronDown className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-destructive rounded-full text-xs flex items-center justify-center font-medium">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Input Area */}
      <div className="chat-input-wrapper p-4 border-t border-border/50">
        {respondingToQuestion && (
          <div className="flex items-center gap-2 text-primary text-sm mb-3">
            <span className="relative flex h-2 w-2">
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Respondendo pergunta do Axiom...
            <button 
              onClick={() => setRespondingToQuestion(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              (cancelar)
            </button>
          </div>
        )}
        
        {isRecording && (
          <div className="flex items-center gap-2 text-destructive text-sm mb-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive"></span>
            </span>
            Gravando... Clique no microfone para parar
          </div>
        )}
        
        <div className="chat-input flex gap-2 items-end rounded-xl p-2 bg-background/50 border border-border/50">
          <Textarea 
            value={input} 
            onChange={e => setInput(e.target.value)} 
            onKeyDown={handleKeyDown} 
            placeholder="Converse com Axiom..." 
            className="min-h-[44px] max-h-32 resize-none flex-1 border-0 bg-transparent focus-visible:ring-0" 
            rows={1} 
            disabled={loading || isRecording || isTranscribing} 
          />
          <div className="flex gap-1">
            <Button 
              size="icon" 
              variant={isRecording ? 'destructive' : 'ghost'}
              onClick={toggleRecording} 
              disabled={loading || isTranscribing}
              className={cn(isRecording && 'animate-pulse')}
            >
              {isTranscribing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isRecording ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>
            <Button 
              size="icon" 
              onClick={sendMessage} 
              disabled={loading || !input.trim() || isRecording}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}

// Size toggle button component
function SizeButton({ 
  icon, 
  label, 
  active, 
  onClick 
}: { 
  icon: React.ReactNode; 
  label: string; 
  active: boolean; 
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClick}
          className={cn(
            "h-7 w-7",
            active && "bg-primary/20 text-primary"
          )}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
