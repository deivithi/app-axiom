-- Índice composto para a query principal (filtro por usuário + data)
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, transaction_date);

-- Índice para user_id isolado (usado em outras queries)
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);

-- Índice para reference_month (usado no filtro de mês)
CREATE INDEX IF NOT EXISTS idx_transactions_user_month ON public.transactions(user_id, reference_month);