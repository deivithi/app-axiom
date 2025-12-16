-- Create table for proactive questions from Axiom
CREATE TABLE public.proactive_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  question TEXT NOT NULL,
  context TEXT,
  trigger_type TEXT NOT NULL, -- 'score_drop', 'project_inactive', 'habit_broken', 'spending_anomaly', 'daily', 'custom'
  priority TEXT NOT NULL DEFAULT 'normal', -- 'critical', 'important', 'normal', 'reflective'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'answered', 'dismissed'
  sent_at TIMESTAMP WITH TIME ZONE,
  answered_at TIMESTAMP WITH TIME ZONE,
  user_response TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.proactive_questions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own proactive questions"
ON public.proactive_questions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own proactive questions"
ON public.proactive_questions
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own proactive questions"
ON public.proactive_questions
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert proactive questions"
ON public.proactive_questions
FOR INSERT
WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.proactive_questions;