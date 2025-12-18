import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ProactiveQuestion {
  id: string;
  question: string;
  context: string | null;
  trigger_type: string;
  priority: 'critical' | 'important' | 'normal' | 'reflective';
  status: 'pending' | 'sent' | 'answered' | 'dismissed';
  sent_at: string | null;
  answered_at: string | null;
  user_response: string | null;
  created_at: string;
}

export function useProactiveQuestions(userId: string | undefined) {
  const [questions, setQuestions] = useState<ProactiveQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadQuestions = useCallback(async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('proactive_questions')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['pending', 'sent'])
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;

      // Type assertion since the table is new and not in types yet
      setQuestions((data as unknown as ProactiveQuestion[]) || []);
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const triggerAnalysis = useCallback(async () => {
    if (!userId) return;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-patterns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
        },
        body: JSON.stringify({ user_id: userId })
      });

      const result = await response.json();
      
      if (result.success && result.question) {
        // Reload questions to show the new one
        await loadQuestions();
      }
    } catch {
      // Silent fail
    }
  }, [userId, loadQuestions]);

  const markAsSent = useCallback(async (questionId: string) => {
    try {
      const { error } = await supabase
        .from('proactive_questions')
        .update({ 
          status: 'sent', 
          sent_at: new Date().toISOString() 
        })
        .eq('id', questionId);

      if (error) throw error;

      setQuestions(prev => prev.map(q => 
        q.id === questionId ? { ...q, status: 'sent' as const, sent_at: new Date().toISOString() } : q
      ));
    } catch {
      // Silent fail
    }
  }, []);

  const answerQuestion = useCallback(async (questionId: string, response: string) => {
    try {
      const { error } = await supabase
        .from('proactive_questions')
        .update({ 
          status: 'answered', 
          answered_at: new Date().toISOString(),
          user_response: response
        })
        .eq('id', questionId);

      if (error) throw error;

      setQuestions(prev => prev.filter(q => q.id !== questionId));

      toast({
        title: '✅ Resposta registrada',
        description: 'Axiom processou sua resposta'
      });
    } catch {
      // Silent fail
    }
  }, [toast]);

  const dismissQuestion = useCallback(async (questionId: string) => {
    try {
      const { error } = await supabase
        .from('proactive_questions')
        .update({ status: 'dismissed' })
        .eq('id', questionId);

      if (error) throw error;

      setQuestions(prev => prev.filter(q => q.id !== questionId));

      toast({
        title: '📌 Pergunta salva',
        description: 'Você pode responder depois via histórico'
      });
    } catch {
      // Silent fail
    }
  }, [toast]);

  // Initial load
  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  // Real-time subscription
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('proactive-questions')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'proactive_questions',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          const newQuestion = payload.new as unknown as ProactiveQuestion;
          if (newQuestion.status === 'pending' || newQuestion.status === 'sent') {
            setQuestions(prev => [newQuestion, ...prev]);
            
            toast({
              title: '🎯 Nova pergunta do Axiom',
              description: 'Confira no chat',
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, toast]);

  // Trigger analysis on initial load (once per session)
  useEffect(() => {
    if (!userId) return;

    const lastAnalysis = sessionStorage.getItem(`axiom_analysis_${userId}`);
    const now = Date.now();

    // Only trigger if not analyzed in this session or more than 1 hour ago
    if (!lastAnalysis || now - parseInt(lastAnalysis) > 3600000) {
      sessionStorage.setItem(`axiom_analysis_${userId}`, now.toString());
      triggerAnalysis();
    }
  }, [userId, triggerAnalysis]);

  return {
    questions,
    loading,
    loadQuestions,
    triggerAnalysis,
    markAsSent,
    answerQuestion,
    dismissQuestion
  };
}
