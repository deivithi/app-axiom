import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAxiomSync } from '@/contexts/AxiomSyncContext';

export function useScoreNotifications() {
  const { user } = useAuth();
  const { notifyAction } = useAxiomSync();
  const previousScoreRef = useRef<number | null>(null);
  const isCalculatingRef = useRef(false);

  const calculateAndNotify = useCallback(async () => {
    if (!user || isCalculatingRef.current) return;
    
    isCalculatingRef.current = true;
    
    try {
      const response = await supabase.functions.invoke('calculate-score', {
        body: { userId: user.id, saveHistory: true }
      });

      if (response.data?.total_score !== undefined) {
        const newScore = response.data.total_score;
        
        if (previousScoreRef.current !== null && newScore !== previousScoreRef.current) {
          const diff = newScore - previousScoreRef.current;
          const emoji = diff > 0 ? '📈' : '📉';
          const sign = diff > 0 ? '+' : '';
          
          notifyAction(
            'score_change',
            'intelligence',
            `${emoji} Score: ${previousScoreRef.current} → ${newScore} (${sign}${diff})`
          );
        }
        
        previousScoreRef.current = newScore;
      }
    } catch (error) {
      console.error('Error calculating score:', error);
    } finally {
      isCalculatingRef.current = false;
    }
  }, [user, notifyAction]);

  useEffect(() => {
    if (!user) return;

    // Initial calculation
    calculateAndNotify();

    // Subscribe to relevant table changes
    const channel = supabase
      .channel('score-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${user.id}` }, calculateAndNotify)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'habits', filter: `user_id=eq.${user.id}` }, calculateAndNotify)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'habit_logs', filter: `user_id=eq.${user.id}` }, calculateAndNotify)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${user.id}` }, calculateAndNotify)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects', filter: `user_id=eq.${user.id}` }, calculateAndNotify)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes', filter: `user_id=eq.${user.id}` }, calculateAndNotify)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'journal_entries', filter: `user_id=eq.${user.id}` }, calculateAndNotify)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, calculateAndNotify]);

  return { currentScore: previousScoreRef.current };
}
