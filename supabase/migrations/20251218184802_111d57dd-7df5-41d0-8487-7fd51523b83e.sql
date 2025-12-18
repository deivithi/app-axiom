-- Add transfer_id column to link transfer transactions
ALTER TABLE transactions 
ADD COLUMN transfer_id UUID NULL;

-- Create index for efficient transfer lookups
CREATE INDEX idx_transactions_transfer_id 
ON transactions(transfer_id) 
WHERE transfer_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN transactions.transfer_id IS 'Links paired transfer transactions (expense and income) together';