import { createContext, useContext, useState, useRef, useEffect, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAxiomSync, UIAction } from '@/contexts/AxiomSyncContext';
import { useProactiveQuestions } from '@/hooks/useProactiveQuestions';

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

interface ProactiveQuestion {
  id: string;
  question: string;
  priority: string;
  trigger_type: string;
  created_at: string;
}

interface ChatContextType {
  messages: Message[];
  uiActions: UIAction[];
  input: string;
  setInput: (value: string) => void;
  loading: boolean;
  loadingMessages: boolean;
  loadingMore: boolean;
  hasMoreMessages: boolean;
  isRecording: boolean;
  isTranscribing: boolean;
  userAvatar: string | null;
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  sendMessage: () => Promise<void>;
  toggleRecording: () => Promise<void>;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  proactiveQuestions: ProactiveQuestion[];
  respondingToQuestion: string | null;
  setRespondingToQuestion: (id: string | null) => void;
  handleRespondToQuestion: (questionId: string) => void;
  handleDismissQuestion: (questionId: string) => void;
  loadMoreMessages: () => Promise<void>;
}

const ChatContext = createContext<ChatContextType | null>(null);

export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
};

const MESSAGES_PER_PAGE = 50;

export const ChatProvider = ({ children }: { children: ReactNode }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [uiActions, setUiActions] = useState<UIAction[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(true);
  const [respondingToQuestion, setRespondingToQuestion] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const { subscribeToActions } = useAxiomSync();
  const { 
    questions: proactiveQuestions, 
    answerQuestion, 
    dismissQuestion 
  } = useProactiveQuestions(user?.id);

  // Subscribe to personality mode changes
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('profile-personality-changes')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${user.id}`
      }, (payload: any) => {
        if (payload.new?.personality_mode && payload.old?.personality_mode && 
            payload.new.personality_mode !== payload.old.personality_mode) {
          const modeNames: Record<string, string> = { 
            direto: 'Direto 🎯', 
            sabio: 'Sábio 🧘', 
            parceiro: 'Parceiro 🤝' 
          };
          toast({
            title: 'Modo alterado',
            description: `Axiom agora está no modo ${modeNames[payload.new.personality_mode] || payload.new.personality_mode}`
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, toast]);

  // Subscribe to UI actions
  useEffect(() => {
    const unsubscribe = subscribeToActions((action: UIAction) => {
      setUiActions(prev => [...prev, action]);
    });
    return unsubscribe;
  }, [subscribeToActions]);

  // Load messages and avatar
  useEffect(() => {
    if (user) {
      loadMessages();
      loadUserAvatar();
    }
  }, [user]);

  const loadMessages = async (pageNum = 1, prepend = false) => {
    const from = (pageNum - 1) * MESSAGES_PER_PAGE;
    const to = from + MESSAGES_PER_PAGE - 1;
    
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, to);
    
    if (error) {
      // Silent fail - messages will be empty
    } else if (data) {
      const reversed = [...data].reverse();
      if (prepend) {
        setMessages(prev => [...reversed, ...prev]);
      } else {
        setMessages(reversed);
      }
      setHasMoreMessages(data.length === MESSAGES_PER_PAGE);
    }
    setLoadingMessages(false);
  };

  const loadMoreMessages = async () => {
    if (!hasMoreMessages || loadingMore) return;
    
    setLoadingMore(true);
    const nextPage = page + 1;
    await loadMessages(nextPage, true);
    setPage(nextPage);
    setLoadingMore(false);
  };

  const loadUserAvatar = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', user?.id)
      .single();
    
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
          create_batch_transactions: '💰 Transações em lote criadas',
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

  const handleRespondToQuestion = (questionId: string) => {
    const question = proactiveQuestions.find(q => q.id === questionId);
    if (question) {
      setRespondingToQuestion(questionId);
      setInput('');
      setChatOpen(true);
    }
  };

  const handleDismissQuestion = (questionId: string) => {
    dismissQuestion(questionId);
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
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
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        audioChunksRef.current = [];
        
        mediaRecorder.ondataavailable = e => {
          if (e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };
        
        mediaRecorder.onstop = async () => {
          stream.getTracks().forEach(track => track.stop());
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          await transcribeAudio(audioBlob);
        };
        
        mediaRecorder.start();
        mediaRecorderRef.current = mediaRecorder;
        setIsRecording(true);
        toast({
          title: '🎤 Gravando...',
          description: 'Fale sua mensagem e clique novamente para enviar'
        });
      } catch {
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

    if (respondingToQuestion) {
      const question = proactiveQuestions.find(q => q.id === respondingToQuestion);
      if (question) {
        await answerQuestion(respondingToQuestion, userMessage);
      }
      setRespondingToQuestion(null);
    }

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

    const aiMessages = messages.slice(-20).map(m => ({
      role: m.is_ai ? 'assistant' : 'user',
      content: m.content
    }));
    aiMessages.push({ role: 'user', content: userMessage });

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
        },
        body: JSON.stringify({ messages: aiMessages })
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
            const content = parsed.content || parsed.choices?.[0]?.delta?.content;
            if (content) {
              aiContent += content;
              setMessages(prev => prev.map(m => 
                m.id === tempAiId ? { ...m, content: aiContent } : m
              ));
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

  return (
    <ChatContext.Provider value={{
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
      chatOpen,
      setChatOpen,
      sendMessage,
      toggleRecording,
      handleKeyDown,
      proactiveQuestions,
      respondingToQuestion,
      setRespondingToQuestion,
      handleRespondToQuestion,
      handleDismissQuestion,
      loadMoreMessages
    }}>
      {children}
    </ChatContext.Provider>
  );
};
