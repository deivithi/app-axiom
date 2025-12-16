-- Create axiom_score_history table for tracking score evolution
CREATE TABLE public.axiom_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  total_score INTEGER NOT NULL DEFAULT 0,
  execution_score INTEGER NOT NULL DEFAULT 0,
  financial_score INTEGER NOT NULL DEFAULT 0,
  habits_score INTEGER NOT NULL DEFAULT 0,
  projects_score INTEGER NOT NULL DEFAULT 0,
  clarity_score INTEGER NOT NULL DEFAULT 0,
  breakdown JSONB DEFAULT '{}',
  calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.axiom_score_history ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own score history"
ON public.axiom_score_history
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert score history"
ON public.axiom_score_history
FOR INSERT
WITH CHECK (true);

-- Index for fast queries
CREATE INDEX idx_score_history_user_date ON public.axiom_score_history(user_id, calculated_at DESC);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.axiom_score_history;