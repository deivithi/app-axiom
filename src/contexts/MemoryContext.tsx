import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface Memory {
  id: string;
  type: 'personality' | 'routine' | 'goal' | 'pattern' | 'preference' | 'fact' | 'insight';
  content: string;
  context: {
    topics: string[];
    relatedMemories: string[];
    confidence: number;
  };
  usage_count: number;
  last_used_at: string | null;
  created_at: string;
  archived_at: string | null;
}

export interface Conversation {
  id: string;
  title: string | null;
  summary: string | null;
  context_topics: string[];
  message_count: number;
  created_at: string;
  updated_at: string;
}

interface LearningInsights {
  personality: Memory[];
  routine: Memory[];
  goals: Memory[];
  patterns: Memory[];
  preferences: Memory[];
  facts: Memory[];
  insights: Memory[];
}

interface MemoryContextType {
  activeContext: string[];
  recentConversations: Conversation[];
  learningInsights: LearningInsights;
  totalMemories: number;
  isLoading: boolean;
  searchMemories: (query: string, types?: string[]) => Promise<Memory[]>;
  trackMemoryUsage: (memoryId: string) => Promise<void>;
  archiveMemory: (memoryId: string) => Promise<void>;
  refreshMemories: () => Promise<void>;
}

const MemoryContext = createContext<MemoryContextType | undefined>(undefined);

export function MemoryProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [activeContext, setActiveContext] = useState<string[]>([]);
  const [recentConversations, setRecentConversations] = useState<Conversation[]>([]);
  const [learningInsights, setLearningInsights] = useState<LearningInsights>({
    personality: [],
    routine: [],
    goals: [],
    patterns: [],
    preferences: [],
    facts: [],
    insights: []
  });
  const [totalMemories, setTotalMemories] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const refreshMemories = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Fetch all active memories
      const { data: memories, error } = await supabase
        .from('memories')
        .select('*')
        .eq('user_id', user.id)
        .is('archived_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Calculate total
      setTotalMemories(memories?.length || 0);

      // Group by type for learning insights
      const grouped: LearningInsights = {
        personality: [],
        routine: [],
        goals: [],
        patterns: [],
        preferences: [],
        facts: [],
        insights: []
      };

      memories?.forEach((mem: any) => {
        const memory: Memory = {
          ...mem,
          context: typeof mem.context === 'string' ? JSON.parse(mem.context) : mem.context
        };
        switch (memory.type) {
          case 'personality': grouped.personality.push(memory); break;
          case 'routine': grouped.routine.push(memory); break;
          case 'goal': grouped.goals.push(memory); break;
          case 'pattern': grouped.patterns.push(memory); break;
          case 'preference': grouped.preferences.push(memory); break;
          case 'fact': grouped.facts.push(memory); break;
          case 'insight': grouped.insights.push(memory); break;
        }
      });

      setLearningInsights(grouped);

      // Extract active context (most used topics)
      const topicCounts = new Map<string, number>();
      memories?.slice(0, 20).forEach((mem: any) => {
        const context = typeof mem.context === 'string' ? JSON.parse(mem.context) : mem.context;
        context?.topics?.forEach((topic: string) => {
          topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
        });
      });

      const sortedTopics = Array.from(topicCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([topic]) => topic);

      setActiveContext(sortedTopics);

      // Fetch recent conversations
      const { data: conversations } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(5);

      setRecentConversations(conversations || []);

    } catch (error) {
      console.error('Error fetching memories:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const searchMemories = useCallback(async (query: string, types?: string[]): Promise<Memory[]> => {
    if (!user) return [];

    try {
      const { data, error } = await supabase.functions.invoke('search-memories', {
        body: { userId: user.id, query, types, limit: 10 }
      });

      if (error) throw error;
      return data.memories || [];
    } catch (error) {
      console.error('Error searching memories:', error);
      return [];
    }
  }, [user]);

  const trackMemoryUsage = useCallback(async (memoryId: string) => {
    if (!user) return;

    try {
      // First get current usage count
      const { data: memory } = await supabase
        .from('memories')
        .select('usage_count')
        .eq('id', memoryId)
        .eq('user_id', user.id)
        .single();

      if (memory) {
        await supabase
          .from('memories')
          .update({ 
            usage_count: (memory.usage_count || 0) + 1,
            last_used_at: new Date().toISOString()
          })
          .eq('id', memoryId)
          .eq('user_id', user.id);
      }
    } catch (error) {
      console.error('Error tracking memory usage:', error);
    }
  }, [user]);

  const archiveMemory = useCallback(async (memoryId: string) => {
    if (!user) return;

    try {
      await supabase
        .from('memories')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', memoryId)
        .eq('user_id', user.id);

      await refreshMemories();
    } catch (error) {
      console.error('Error archiving memory:', error);
    }
  }, [user, refreshMemories]);

  useEffect(() => {
    if (user) {
      refreshMemories();
    }
  }, [user, refreshMemories]);

  // Subscribe to memory changes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('memories_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'memories',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          refreshMemories();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refreshMemories]);

  return (
    <MemoryContext.Provider
      value={{
        activeContext,
        recentConversations,
        learningInsights,
        totalMemories,
        isLoading,
        searchMemories,
        trackMemoryUsage,
        archiveMemory,
        refreshMemories
      }}
    >
      {children}
    </MemoryContext.Provider>
  );
}

export const useMemory = () => {
  const context = useContext(MemoryContext);
  if (!context) {
    throw new Error('useMemory must be used within a MemoryProvider');
  }
  return context;
};
