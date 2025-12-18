-- Criar tabela para rastrear exclusões agendadas (LGPD soft delete)
CREATE TABLE public.scheduled_deletions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  confirmed BOOLEAN DEFAULT false,
  confirmation_token UUID DEFAULT gen_random_uuid() UNIQUE,
  cancelled_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'confirmed', 'cancelled', 'executed')),
  CONSTRAINT unique_pending_deletion UNIQUE (user_id)
);

-- Enable Row Level Security
ALTER TABLE public.scheduled_deletions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own scheduled deletions
CREATE POLICY "Users can view own scheduled deletions"
ON public.scheduled_deletions
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can insert their own scheduled deletions
CREATE POLICY "Users can insert own scheduled deletions"
ON public.scheduled_deletions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own scheduled deletions (for cancellation)
CREATE POLICY "Users can update own scheduled deletions"
ON public.scheduled_deletions
FOR UPDATE
USING (auth.uid() = user_id);

-- Policy: Service role can manage all deletions (for cron job)
CREATE POLICY "Service role can manage all deletions"
ON public.scheduled_deletions
FOR ALL
USING (true)
WITH CHECK (true);

-- Add deleted_at column to profiles for soft delete indicator
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deletion_scheduled_for TIMESTAMPTZ;

-- Create index for efficient cron job queries
CREATE INDEX idx_scheduled_deletions_status_scheduled 
ON public.scheduled_deletions (status, scheduled_for) 
WHERE status = 'confirmed';