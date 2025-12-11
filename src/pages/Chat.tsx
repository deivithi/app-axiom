import { useState, useRef, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Send, Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: string;
  content: string;
  is_ai: boolean;
  created_at: string;
}

interface ExecutedAction {
  success: boolean;
  action: string;
  message: string;
  data?: any;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      loadMessages();
    }
  }, [user]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading messages:', error);
    } else {
      setMessages(data || []);
    }
    setLoadingMessages(false);
  };

  const showActionToast = (actions: ExecutedAction[]) => {
    actions.forEach((action) => {
      if (action.success) {
        const actionLabels: Record<string, string> = {
          create_task: '✅ Tarefa criada',
          create_habit: '🎯 Hábito criado',
          create_reminder: '⏰ Lembrete criado',
          create_transaction: '💰 Transação registrada',
          create_note: '📝 Nota criada',
          create_project: '📁 Projeto criado',
          create_journal_entry: '📖 Diário atualizado',
          list_tasks: '📋 Tarefas listadas',
          list_reminders: '🔔 Lembretes listados',
          get_finance_summary: '📊 Resumo financeiro',
          update_transaction: '✏️ Transação atualizada',
          delete_transaction: '🗑️ Transação excluída',
          create_account: '🏦 Conta criada',
          update_account: '🏦 Conta atualizada',
          list_accounts: '🏦 Contas listadas',
          list_transactions: '💰 Transações listadas',
          list_habits: '🎯 Hábitos listados',
          list_notes: '📝 Notas listadas',
          list_projects: '📁 Projetos listados',
          list_journal_entries: '📖 Entradas listadas',
        };

        toast({
          title: actionLabels[action.action] || 'Ação executada',
          description: action.message,
        });
      }
    });
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);

    // Add user message to UI immediately
    const tempUserMsg: Message = {
      id: crypto.randomUUID(),
      content: userMessage,
      is_ai: false,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    // Save user message to DB
    await supabase.from('messages').insert({
      user_id: user?.id,
      content: userMessage,
      is_ai: false,
    });

    // Prepare messages for AI
    const aiMessages = messages.slice(-10).map((m) => ({
      role: m.is_ai ? 'assistant' : 'user',
      content: m.content,
    }));
    aiMessages.push({ role: 'user', content: userMessage });

    try {
      // Get session for auth
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ messages: aiMessages }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao processar mensagem');
      }

      // Actions will be captured from stream

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let aiContent = '';
      const tempAiId = crypto.randomUUID();

      // Add empty AI message
      setMessages((prev) => [
        ...prev,
        { id: tempAiId, content: '', is_ai: true, created_at: new Date().toISOString() },
      ]);

      let textBuffer = '';
      
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            
            // Accept edge function format OR OpenAI standard format
            const content = parsed.content || parsed.choices?.[0]?.delta?.content;
            
            if (content) {
              aiContent += content;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempAiId ? { ...m, content: aiContent } : m
                )
              );
            }
            
            // Capture executed actions from stream
            if (parsed.actions && Array.isArray(parsed.actions)) {
              parsed.actions.forEach((actionName: string) => {
                showActionToast([{ success: true, action: actionName, message: 'Ação executada com sucesso' }]);
              });
            }
          } catch {
            // Incomplete JSON, continue
          }
        }
      }

      // Save AI response to DB
      if (aiContent) {
        await supabase.from('messages').insert({
          user_id: user?.id,
          content: aiContent,
          is_ai: true,
        });
      }
    } catch (error) {
      console.error('Chat error:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao enviar mensagem',
        variant: 'destructive',
      });
    }

    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-screen">
        <header className="p-4 border-b border-border">
          <h1 className="text-xl font-semibold">Chat com Jarvis</h1>
          <p className="text-sm text-muted-foreground">
            Seu assistente pessoal - pode criar tarefas, lembretes, registrar finanças e mais
          </p>
        </header>

        <ScrollArea className="flex-1 p-4">
          <div className="max-w-3xl mx-auto space-y-4">
            {loadingMessages ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-lg font-medium">Olá! Sou o Jarvis</p>
                <p className="text-sm mt-2">Como posso te ajudar hoje?</p>
                <div className="mt-6 text-left max-w-md mx-auto bg-card rounded-lg p-4 space-y-2">
                  <p className="text-xs font-medium text-foreground">Experimente:</p>
                  <ul className="text-xs space-y-1">
                    <li>• "Cria uma tarefa para estudar React amanhã"</li>
                    <li>• "Adiciona um lembrete para ligar pro banco às 14h"</li>
                    <li>• "Registra uma despesa de R$ 50 em alimentação"</li>
                    <li>• "Quanto gastei esse mês?"</li>
                    <li>• "Quais são minhas tarefas pendentes?"</li>
                  </ul>
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    'max-w-[85%] rounded-2xl px-4 py-3',
                    msg.is_ai
                      ? 'bg-card mr-auto'
                      : 'bg-primary text-primary-foreground ml-auto'
                  )}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              ))
            )}
            {loading && (
              <div className="bg-card max-w-[85%] rounded-2xl px-4 py-3 mr-auto">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:0.1s]" />
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:0.2s]" />
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-border">
          <div className="max-w-3xl mx-auto relative">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua mensagem... (ex: cria uma tarefa para...)"
              className="pr-12 min-h-[48px] max-h-32 resize-none"
              rows={1}
            />
            <Button
              size="icon"
              className="absolute right-2 bottom-2"
              onClick={sendMessage}
              disabled={loading || !input.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
