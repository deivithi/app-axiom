import { useState, useRef, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Send, Loader2, Mic, MicOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { UserMessage } from '@/components/chat/UserMessage';
import { AxiomMessage } from '@/components/chat/AxiomMessage';
import { AxiomTyping } from '@/components/chat/AxiomTyping';
import { ActionConfirmation } from '@/components/chat/ActionConfirmation';
import { useAxiomSync, UIAction } from '@/contexts/AxiomSyncContext';
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
  const [uiActions, setUiActions] = useState<UIAction[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const {
    user
  } = useAuth();
  const {
    toast
  } = useToast();
  const { subscribeToActions, setLastActionSource } = useAxiomSync();

  // Subscribe to UI actions to show confirmations in chat
  useEffect(() => {
    const unsubscribe = subscribeToActions((action: UIAction) => {
      setUiActions(prev => [...prev, action]);
    });
    return unsubscribe;
  }, [subscribeToActions]);
  useEffect(() => {
    if (user) {
      loadMessages();
      loadUserAvatar();
    }
  }, [user]);
  useEffect(() => {
    scrollRef.current?.scrollIntoView({
      behavior: 'smooth'
    });
  }, [messages]);
  const loadMessages = async () => {
    const {
      data,
      error
    } = await supabase.from('messages').select('*').order('created_at', {
      ascending: true
    });
    if (error) {
      console.error('Error loading messages:', error);
    } else {
      setMessages(data || []);
    }
    setLoadingMessages(false);
  };
  const loadUserAvatar = async () => {
    const {
      data
    } = await supabase.from('profiles').select('avatar_url').eq('id', user?.id).single();
    if (data?.avatar_url) {
      setUserAvatar(data.avatar_url);
    }
  };
  const showActionToast = (actions: ExecutedAction[]) => {
    actions.forEach(action => {
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
          list_journal_entries: '📖 Entradas listadas'
        };
        toast({
          title: actionLabels[action.action] || 'Ação executada',
          description: action.message
        });
      }
    });
  };
  const transcribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      // Get access token for authenticated request
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Usuário não autenticado');
      }
      
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.webm');
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: formData
      });
      const result = await response.json();
      if (result.text) {
        setInput(result.text);
        toast({
          title: '✅ Transcrição concluída',
          description: 'Revise e envie sua mensagem'
        });
      } else {
        throw new Error(result.error || 'Falha na transcrição');
      }
    } catch (error) {
      console.error('Transcription error:', error);
      toast({
        title: 'Erro na transcrição',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      });
    } finally {
      setIsTranscribing(false);
    }
  };
  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true
        });
        const mediaRecorder = new MediaRecorder(stream);
        audioChunksRef.current = [];
        mediaRecorder.ondataavailable = e => {
          if (e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };
        mediaRecorder.onstop = async () => {
          stream.getTracks().forEach(track => track.stop());
          const audioBlob = new Blob(audioChunksRef.current, {
            type: 'audio/webm'
          });
          await transcribeAudio(audioBlob);
        };
        mediaRecorder.start();
        mediaRecorderRef.current = mediaRecorder;
        setIsRecording(true);
        toast({
          title: '🎤 Gravando...',
          description: 'Fale sua mensagem e clique novamente para enviar'
        });
      } catch (error) {
        console.error('Microphone error:', error);
        toast({
          title: 'Erro',
          description: 'Não foi possível acessar o microfone',
          variant: 'destructive'
        });
      }
    }
  };
  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMessage = input.trim();
    setInput('');
    setLoading(true);
    const tempUserMsg: Message = {
      id: crypto.randomUUID(),
      content: userMessage,
      is_ai: false,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMsg]);
    await supabase.from('messages').insert({
      user_id: user?.id,
      content: userMessage,
      is_ai: false
    });
    const aiMessages = messages.slice(-10).map(m => ({
      role: m.is_ai ? 'assistant' : 'user',
      content: m.content
    }));
    aiMessages.push({
      role: 'user',
      content: userMessage
    });
    try {
      const {
        data: sessionData
      } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
        },
        body: JSON.stringify({
          messages: aiMessages
        })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao processar mensagem');
      }
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let aiContent = '';
      const tempAiId = crypto.randomUUID();
      setMessages(prev => [...prev, {
        id: tempAiId,
        content: '',
        is_ai: true,
        created_at: new Date().toISOString()
      }]);
      let textBuffer = '';
      while (reader) {
        const {
          done,
          value
        } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, {
          stream: true
        });
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
            const content = parsed.content || parsed.choices?.[0]?.delta?.content;
            if (content) {
              aiContent += content;
              setMessages(prev => prev.map(m => m.id === tempAiId ? {
                ...m,
                content: aiContent
              } : m));
            }
            if (parsed.actions && Array.isArray(parsed.actions)) {
              parsed.actions.forEach((actionName: string) => {
                showActionToast([{
                  success: true,
                  action: actionName,
                  message: 'Ação executada com sucesso'
                }]);
              });
            }
          } catch {
            // Incomplete JSON, continue
          }
        }
      }
      if (aiContent) {
        await supabase.from('messages').insert({
          user_id: user?.id,
          content: aiContent,
          is_ai: true
        });
      }
    } catch (error) {
      console.error('Chat error:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao enviar mensagem',
        variant: 'destructive'
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
  return <AppLayout>
      <div className="flex flex-col h-screen">
        <header className="p-4 pl-16 md:pl-4 border-b border-border">
          <h1 className="text-xl font-semibold text-foreground">Axiom</h1>
          <p className="text-sm text-muted-foreground">
            Estrategista conversacional • Diga o que precisa, eu executo
          </p>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground/70">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Online
            </span>
            <span>•</span>
            <span>Atalho: Cmd/Ctrl+K</span>
          </div>
        </header>

        <ScrollArea className="flex-1 p-4">
          <div className="max-w-3xl mx-auto space-y-4">
            {loadingMessages ? <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div> : messages.length === 0 && uiActions.length === 0 ? <div className="py-8">
                <AxiomMessage 
                  content={`Olá! Sou Axiom, seu estrategista pessoal. 🎯

Me conte: o que você quer organizar primeiro?

💰 **Dinheiro** — rastreie gastos, receitas e contas
📋 **Tarefas** — gerencie o que precisa fazer  
🎯 **Hábitos** — construa rotinas consistentes
📁 **Projetos** — organize iniciativas maiores
⏰ **Lembretes** — nunca mais esqueça compromissos

Apenas me diga e eu cuido do resto.`}
                  timestamp={new Date().toISOString()}
                />
              </div> : <>
                {messages.map(msg => msg.is_ai ? <AxiomMessage key={msg.id} content={msg.content} timestamp={msg.created_at} /> : <UserMessage key={msg.id} content={msg.content} timestamp={msg.created_at} avatarUrl={userAvatar} />)}
                {uiActions.map(action => (
                  <ActionConfirmation 
                    key={action.id} 
                    message={action.message} 
                    module={action.module} 
                    timestamp={action.timestamp} 
                  />
                ))}
              </>}
            {loading && <AxiomTyping />}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-border">
          <div className="max-w-3xl mx-auto">
            {isRecording && <div className="flex items-center gap-2 text-destructive text-sm mb-3">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive"></span>
                </span>
                Gravando... Clique no microfone para parar
              </div>}
            <div className="flex gap-2">
              <Textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Digite ou fale sua mensagem..." className="min-h-[48px] max-h-32 resize-none flex-1" rows={1} disabled={loading || isRecording || isTranscribing} />
              <div className="flex flex-col gap-2">
                <Button size="icon" variant={isRecording ? 'destructive' : 'outline'} onClick={toggleRecording} disabled={loading || isTranscribing} className={isRecording ? 'animate-pulse' : ''}>
                  {isTranscribing ? <Loader2 className="h-4 w-4 animate-spin" /> : isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
                <Button size="icon" onClick={sendMessage} disabled={loading || !input.trim() || isRecording}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>;
}