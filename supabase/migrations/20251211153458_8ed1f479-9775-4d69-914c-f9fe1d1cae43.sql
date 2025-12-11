-- Add payment_method to transactions
ALTER TABLE transactions 
ADD COLUMN payment_method text DEFAULT 'pix';

-- Add user_context to profiles
ALTER TABLE profiles 
ADD COLUMN user_context text;