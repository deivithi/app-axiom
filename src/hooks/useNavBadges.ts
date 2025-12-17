import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface NavBadges {
  execution: number;
  finances: number;
  habits: number;
}

export function useNavBadges() {
  const { user } = useAuth();
  const [badges, setBadges] = useState<NavBadges>({
    execution: 0,
    finances: 0,
    habits: 0,
  });

  const fetchBadges = useCallback(async () => {
    if (!user?.id) return;

    const today = new Date().toISOString().split('T')[0];

    // Parallel queries for performance
    const [tasksRes, transactionsRes, habitsRes, logsRes] = await Promise.all([
      // Pending tasks (status != 'done')
      supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .neq('status', 'done'),

      // Unpaid transactions
      supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_paid', false),

      // Total habits
      supabase
        .from('habits')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),

      // Habits completed today
      supabase
        .from('habit_logs')
        .select('habit_id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('completed_at', today),
    ]);

    const totalHabits = habitsRes.count || 0;
    const completedToday = logsRes.count || 0;

    setBadges({
      execution: tasksRes.count || 0,
      finances: transactionsRes.count || 0,
      habits: Math.max(totalHabits - completedToday, 0),
    });
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    fetchBadges();

    // Real-time subscriptions
    const channel = supabase
      .channel('nav-badges')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, fetchBadges)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, fetchBadges)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'habit_logs' }, fetchBadges)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'habits' }, fetchBadges)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchBadges]);

  return badges;
}
