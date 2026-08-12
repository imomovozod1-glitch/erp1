-- Safe to run multiple times.

ALTER TABLE customers ADD COLUMN IF NOT EXISTS credit_balance DECIMAL(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;
