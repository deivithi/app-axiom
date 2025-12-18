import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type TableName = 'tasks' | 'habits' | 'habit_logs' | 'reminders' | 'transactions' | 'accounts' | 'notes' | 'projects' | 'project_tasks' | 'journal_entries' | 'prompt_library' | 'saved_sites' | 'messages';

interface RealtimeSyncOptions<T> {
  onInsert?: (payload: T) => void;
  onUpdate?: (payload: T) => void;
  onDelete?: (payload: { old: T }) => void;
}

export function useRealtimeSync<T extends { id: string; user_id?: string }>(
  tableName: TableName,
  userId: string | undefined,
  options: RealtimeSyncOptions<T>
) {
  const { onInsert, onUpdate, onDelete } = options;

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`${tableName}-realtime-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: tableName,
          filter: `user_id=eq.${userId}`,
        },
        (payload: RealtimePostgresChangesPayload<T>) => {
          if (payload.eventType === 'INSERT' && onInsert) {
            onInsert(payload.new as T);
          } else if (payload.eventType === 'UPDATE' && onUpdate) {
            onUpdate(payload.new as T);
          } else if (payload.eventType === 'DELETE' && onDelete) {
            onDelete({ old: payload.old as T });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, tableName, onInsert, onUpdate, onDelete]);
}

// Hook for tables without user_id filter (like habit_logs that filter by habit_id)
export function useRealtimeSyncCustomFilter<T extends { id: string }>(
  tableName: TableName,
  filterColumn: string,
  filterValue: string | undefined,
  options: RealtimeSyncOptions<T>
) {
  const { onInsert, onUpdate, onDelete } = options;

  useEffect(() => {
    if (!filterValue) return;

    const channel = supabase
      .channel(`${tableName}-realtime-${filterValue}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: tableName,
          filter: `${filterColumn}=eq.${filterValue}`,
        },
        (payload: RealtimePostgresChangesPayload<T>) => {
          if (payload.eventType === 'INSERT' && onInsert) {
            onInsert(payload.new as T);
          } else if (payload.eventType === 'UPDATE' && onUpdate) {
            onUpdate(payload.new as T);
          } else if (payload.eventType === 'DELETE' && onDelete) {
            onDelete({ old: payload.old as T });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filterValue, tableName, filterColumn, onInsert, onUpdate, onDelete]);
}
