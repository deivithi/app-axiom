import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Loader2, Mic, MicOff, X } from 'lucide-react';
import { UserMessage } from '@/components/chat/UserMessage';
import { AxiomMessage } from '@/components/chat/AxiomMessage';
import { AxiomTyping } from '@/components/chat/AxiomTyping';
import { ActionConfirmation } from '@/components/chat/ActionConfirmation';
import { ProactiveQuestion } from '@/components/chat/ProactiveQuestion';
import { OnboardingOptions } from '@/components/chat/OnboardingOptions';
import { WeeklyReportCard } from '@/components/chat/WeeklyReportCard';
import { useChatContext } from '@/contexts/ChatContext';
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

export function ChatPanel({ isExpanded, onToggle }: ChatPanelProps) {
  const {
    messages,
    uiActions,
    input,
    setInput,
    loading,
    loadingMessages,
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
    scrollRef
  } = useChatContext();

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

  return (
    <aside className={cn(
      "chat-panel fixed right-0 top-0 h-screen z-40",
      "w-full sm:w-96 flex flex-col",
      "bg-card/95 backdrop-blur-xl",
      "border-l border-border/50",
      "transition-transform duration-300",
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
        <Button 
          variant="ghost" 
          size="icon" 
          className="lg:hidden"
          onClick={onToggle}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages ScrollArea */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
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
              {messages.map(msg => {
                const isWeeklyReport = msg.is_ai && (
                  msg.content.includes('📊 **Axiom Insights**') || 
                  msg.content.includes('📊 **Relatório Completo da Semana**')
                );
                
                if (isWeeklyReport) {
                  return (
                    <WeeklyReportCard 
                      key={msg.id} 
                      content={msg.content} 
                      timestamp={msg.created_at}
                      isFullReport={msg.content.includes('Relatório Completo')}
                    />
                  );
                }
                
                return msg.is_ai ? (
                  <AxiomMessage key={msg.id} content={msg.content} timestamp={msg.created_at} />
                ) : (
                  <UserMessage key={msg.id} content={msg.content} timestamp={msg.created_at} avatarUrl={userAvatar} />
                );
              })}
              
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
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

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
