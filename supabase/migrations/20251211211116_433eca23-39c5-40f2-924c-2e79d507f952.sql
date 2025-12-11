-- Adicionar coluna ai_insights nas tabelas notes e journal_entries
ALTER TABLE public.notes ADD COLUMN ai_insights text;
ALTER TABLE public.journal_entries ADD COLUMN ai_insights text;