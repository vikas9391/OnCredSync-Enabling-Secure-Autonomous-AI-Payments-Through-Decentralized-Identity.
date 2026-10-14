-- Convert legacy demo amounts to wei-denominated ETH values.
-- The old values were demo-only dollar-like units, not actual fiat balances.
-- Preserve the displayed numeric amount as ETH for continuity; no exchange rate is implied.
ALTER TABLE spending_policies
  CHANGE COLUMN transaction_limit_cents transaction_limit_wei DECIMAL(65,0) NOT NULL,
  CHANGE COLUMN daily_limit_cents daily_limit_wei DECIMAL(65,0) NOT NULL;

ALTER TABLE payments
  CHANGE COLUMN amount_cents amount_wei DECIMAL(65,0) NOT NULL;

UPDATE spending_policies
SET transaction_limit_wei = CAST(transaction_limit_wei * 10000000000000000 AS DECIMAL(65,0)),
    daily_limit_wei = CAST(daily_limit_wei * 10000000000000000 AS DECIMAL(65,0));

UPDATE payments
SET amount_wei = CAST(amount_wei * 10000000000000000 AS DECIMAL(65,0));
