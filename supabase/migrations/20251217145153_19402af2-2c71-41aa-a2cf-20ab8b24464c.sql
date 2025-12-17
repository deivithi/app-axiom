-- Add new columns to prompt_library for enhanced analysis
ALTER TABLE prompt_library ADD COLUMN IF NOT EXISTS analysis_score integer;
ALTER TABLE prompt_library ADD COLUMN IF NOT EXISTS analysis_status text DEFAULT 'analyzed' CHECK (analysis_status IN ('analyzing', 'analyzed', 'failed'));
ALTER TABLE prompt_library ADD COLUMN IF NOT EXISTS analysis_problems text[] DEFAULT '{}';
ALTER TABLE prompt_library ADD COLUMN IF NOT EXISTS analysis_strengths text[] DEFAULT '{}';
ALTER TABLE prompt_library ADD COLUMN IF NOT EXISTS improvements jsonb DEFAULT '[]';
ALTER TABLE prompt_library ADD COLUMN IF NOT EXISTS usage_count integer DEFAULT 0;
ALTER TABLE prompt_library ADD COLUMN IF NOT EXISTS last_used_at timestamp with time zone;