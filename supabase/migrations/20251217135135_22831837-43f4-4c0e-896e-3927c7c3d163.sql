-- Enable pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create memory type enum
DO $$ BEGIN
  CREATE TYPE memory_type AS ENUM ('personality', 'routine', 'goal', 'pattern', 'preference', 'fact', 'insight');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create memories table
CREATE TABLE public.memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type memory_type NOT NULL,
  content TEXT NOT NULL,
  context JSONB DEFAULT '{"topics": [], "relatedMemories": [], "confidence": 3}'::jsonb,
  embedding vector(1536), -- OpenAI ada-002 dimension
  conversation_id UUID,
  usage_count INT DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  archived_at TIMESTAMPTZ
);

-- Create conversations table for chat history organization
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  summary TEXT,
  context_topics TEXT[] DEFAULT '{}',
  message_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX idx_memories_user_type ON public.memories(user_id, type, created_at DESC);
CREATE INDEX idx_memories_user_active ON public.memories(user_id) WHERE archived_at IS NULL;
CREATE INDEX idx_memories_embedding ON public.memories USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_conversations_user ON public.conversations(user_id, updated_at DESC);

-- Enable RLS
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for memories
CREATE POLICY "Users can view own memories"
ON public.memories FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own memories"
ON public.memories FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own memories"
ON public.memories FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own memories"
ON public.memories FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies for conversations
CREATE POLICY "Users can view own conversations"
ON public.conversations FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations"
ON public.conversations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
ON public.conversations FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
ON public.conversations FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at on memories
CREATE TRIGGER update_memories_updated_at
BEFORE UPDATE ON public.memories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for updated_at on conversations
CREATE TRIGGER update_conversations_updated_at
BEFORE UPDATE ON public.conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.memories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;

-- Add comments
COMMENT ON TABLE public.memories IS 'Long-term memory storage for Axiom AI assistant. Stores user preferences, routines, goals, patterns, and insights extracted from conversations.';
COMMENT ON TABLE public.conversations IS 'Conversation history with summaries and context topics for memory continuity.';