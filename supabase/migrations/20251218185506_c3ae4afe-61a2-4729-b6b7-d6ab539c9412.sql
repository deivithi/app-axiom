-- Add recurrence_day column for recurring transactions
ALTER TABLE public.transactions 
ADD COLUMN recurrence_day INTEGER;

-- Add check constraint for valid day range
ALTER TABLE public.transactions 
ADD CONSTRAINT check_recurrence_day CHECK (recurrence_day IS NULL OR (recurrence_day >= 1 AND recurrence_day <= 31));

-- Add comment for documentation
COMMENT ON COLUMN public.transactions.recurrence_day IS 'Day of month for recurring transactions (1-31). Used by CRON to generate instances on the correct date.';