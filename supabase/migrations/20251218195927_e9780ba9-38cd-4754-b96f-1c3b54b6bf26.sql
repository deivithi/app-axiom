-- Função atômica para pagar transação e atualizar saldo
CREATE OR REPLACE FUNCTION pay_transaction_atomic(
  p_transaction_id UUID,
  p_user_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_account_id UUID;
  v_amount NUMERIC;
  v_type TEXT;
  v_is_paid BOOLEAN;
BEGIN
  -- Buscar dados da transação com lock
  SELECT account_id, amount, type, is_paid
  INTO v_account_id, v_amount, v_type, v_is_paid
  FROM transactions
  WHERE id = p_transaction_id AND user_id = p_user_id
  FOR UPDATE;
  
  -- Verificar se já está paga
  IF v_is_paid THEN
    RAISE EXCEPTION 'Transação já está paga';
  END IF;
  
  -- Atualizar transação como paga
  UPDATE transactions 
  SET is_paid = true 
  WHERE id = p_transaction_id AND user_id = p_user_id;
  
  -- Atualizar saldo da conta se houver
  IF v_account_id IS NOT NULL THEN
    IF v_type = 'income' THEN
      UPDATE accounts 
      SET balance = balance + v_amount 
      WHERE id = v_account_id AND user_id = p_user_id;
    ELSE
      UPDATE accounts 
      SET balance = balance - v_amount 
      WHERE id = v_account_id AND user_id = p_user_id;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Função atômica para desfazer pagamento
CREATE OR REPLACE FUNCTION unpay_transaction_atomic(
  p_transaction_id UUID,
  p_user_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_account_id UUID;
  v_amount NUMERIC;
  v_type TEXT;
  v_is_paid BOOLEAN;
BEGIN
  -- Buscar dados da transação com lock
  SELECT account_id, amount, type, is_paid
  INTO v_account_id, v_amount, v_type, v_is_paid
  FROM transactions
  WHERE id = p_transaction_id AND user_id = p_user_id
  FOR UPDATE;
  
  -- Verificar se está paga
  IF NOT v_is_paid THEN
    RAISE EXCEPTION 'Transação não está paga';
  END IF;
  
  -- Atualizar transação como não paga
  UPDATE transactions 
  SET is_paid = false 
  WHERE id = p_transaction_id AND user_id = p_user_id;
  
  -- Reverter saldo da conta se houver
  IF v_account_id IS NOT NULL THEN
    IF v_type = 'income' THEN
      UPDATE accounts 
      SET balance = balance - v_amount 
      WHERE id = v_account_id AND user_id = p_user_id;
    ELSE
      UPDATE accounts 
      SET balance = balance + v_amount 
      WHERE id = v_account_id AND user_id = p_user_id;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;