-- Migration 003: REV03 Schema Updates
-- 1. accounts: new fields (owner, initial_balance, active, notes, is_default)
-- 2. budget_categories: add active field
-- 3. budget_items: add planned_account_id
-- 4. transactions: add budget_category_id

-- ── accounts ──────────────────────────────────────────────────
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS owner TEXT DEFAULT 'family',
  ADD COLUMN IF NOT EXISTS initial_balance NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

-- ── budget_categories ─────────────────────────────────────────
ALTER TABLE public.budget_categories
  ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- ── budget_items: planned_account_id (conto previsto per la voce) ──
ALTER TABLE public.budget_items
  ADD COLUMN IF NOT EXISTS planned_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_budget_items_planned_account ON public.budget_items(planned_account_id);

-- ── transactions: budget_category_id (macro categoria diretta) ──
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS budget_category_id UUID REFERENCES public.budget_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_budget_category ON public.transactions(budget_category_id);
