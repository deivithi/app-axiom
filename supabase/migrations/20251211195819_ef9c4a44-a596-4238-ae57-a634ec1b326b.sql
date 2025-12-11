-- Add payment tracking columns to transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_paid boolean NOT NULL DEFAULT false;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS parent_transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reference_month text;

-- Create index for faster queries on recurring transactions
CREATE INDEX IF NOT EXISTS idx_transactions_parent_id ON transactions(parent_transaction_id);
CREATE INDEX IF NOT EXISTS idx_transactions_reference_month ON transactions(reference_month);
CREATE INDEX IF NOT EXISTS idx_transactions_is_paid ON transactions(is_paid);