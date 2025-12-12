-- Adicionar coluna account_id na tabela transactions (opcional, FK para accounts)
ALTER TABLE public.transactions 
ADD COLUMN account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL;