-- Convert legacy demo amounts to wei-denominated ETH values.
-- Legacy values were demo-only dollar-like units, not actual fiat balances.
-- For UI continuity, map legacy values are stored in cents; multiplying by 1e16 wei per cent preserves the old displayed numeric amount as ETH. This is a demo conversion, not an exchange rate.
ALTER TABLE spending_policies
  DROP CHECK chk_policy_transaction_limit,
  DROP CHECK chk_policy_daily_limit,
  CHANGE COLUMN transaction_limit_cents transaction_limit_wei DECIMAL(65,0) NOT NULL,
  CHANGE COLUMN daily_limit_cents daily_limit_wei DECIMAL(65,0) NOT NULL;

ALTER TABLE spending_policies
  ADD CONSTRAINT chk_policy_transaction_limit CHECK (transaction_limit_wei > 0),
  ADD CONSTRAINT chk_policy_daily_limit CHECK (daily_limit_wei > 0);

ALTER TABLE payments
  DROP CHECK chk_payment_amount,
  CHANGE COLUMN amount_cents amount_wei DECIMAL(65,0) NOT NULL,
  ADD CONSTRAINT chk_payment_amount CHECK (amount_wei > 0);

UPDATE spending_policies
SET transaction_limit_wei = CAST(transaction_limit_wei * 10000000000000000 AS DECIMAL(65,0)),
    daily_limit_wei = CAST(daily_limit_wei * 10000000000000 AS DECIMAL(65,0));

UPDATE payments
SET amount_wei = CAST(amount_wei * 10000000000000 AS DECIMAL(65,0));
