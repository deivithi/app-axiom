-- Add optimized_prompt column to prompt_library table
ALTER TABLE public.prompt_library 
ADD COLUMN optimized_prompt TEXT;