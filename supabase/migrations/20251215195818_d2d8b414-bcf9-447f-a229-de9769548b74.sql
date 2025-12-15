-- Tabela para biblioteca de prompts
CREATE TABLE public.prompt_library (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'geral',
  ai_diagnosis TEXT,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.prompt_library ENABLE ROW LEVEL SECURITY;

-- RLS policies para prompt_library
CREATE POLICY "Users can view own prompts" ON public.prompt_library FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own prompts" ON public.prompt_library FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own prompts" ON public.prompt_library FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own prompts" ON public.prompt_library FOR DELETE USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE TRIGGER update_prompt_library_updated_at
BEFORE UPDATE ON public.prompt_library
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela para sites salvos
CREATE TABLE public.saved_sites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'geral',
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.saved_sites ENABLE ROW LEVEL SECURITY;

-- RLS policies para saved_sites
CREATE POLICY "Users can view own sites" ON public.saved_sites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sites" ON public.saved_sites FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sites" ON public.saved_sites FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own sites" ON public.saved_sites FOR DELETE USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE TRIGGER update_saved_sites_updated_at
BEFORE UPDATE ON public.saved_sites
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();