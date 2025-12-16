-- Add personality_mode column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS personality_mode TEXT DEFAULT 'direto';

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.personality_mode IS 'Personality mode for Axiom: direto, sabio, parceiro';