-- Add CHECK constraint for positive amount
ALTER TABLE transactions 
ADD CONSTRAINT transactions_amount_positive 
CHECK (amount > 0);

-- Add version column for optimistic locking
ALTER TABLE transactions 
ADD COLUMN version INTEGER NOT NULL DEFAULT 1;