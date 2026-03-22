-- Migration 002: Budget REV02
-- Crea budget_categories, budget_items, category_budget_mapping

CREATE TABLE IF NOT EXISTS public.budget_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT DEFAULT '#6366f1',
  sort_order INTEGER DEFAULT 0,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.budget_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  budget_category_id UUID REFERENCES public.budget_categories(id) ON DELETE SET NULL,
  year INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'saving_goal')),
  description TEXT NOT NULL,
  recurrence TEXT NOT NULL CHECK (recurrence IN ('weekly', 'monthly', 'annual', 'once', 'quarterly')),
  recurrence_month INTEGER CHECK (recurrence_month BETWEEN 1 AND 12),
  recurrence_day INTEGER,
  recurrence_date DATE,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_variable BOOLEAN DEFAULT false,
  notes TEXT,
  active BOOLEAN DEFAULT true,
  target_amount NUMERIC(12,2),
  target_date DATE,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.category_budget_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  transaction_category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  budget_category_id UUID NOT NULL REFERENCES public.budget_categories(id) ON DELETE CASCADE,
  UNIQUE(family_id, transaction_category_id)
);

CREATE INDEX IF NOT EXISTS idx_budget_categories_family ON public.budget_categories(family_id);
CREATE INDEX IF NOT EXISTS idx_budget_items_family_year ON public.budget_items(family_id, year);
CREATE INDEX IF NOT EXISTS idx_cbm_family ON public.category_budget_mapping(family_id);

-- RLS
ALTER TABLE public.budget_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_budget_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "budget_categories_select" ON public.budget_categories FOR SELECT TO authenticated USING (family_id = get_my_family_id());
CREATE POLICY "budget_categories_insert" ON public.budget_categories FOR INSERT TO authenticated WITH CHECK (family_id = get_my_family_id());
CREATE POLICY "budget_categories_update" ON public.budget_categories FOR UPDATE TO authenticated USING (family_id = get_my_family_id());
CREATE POLICY "budget_categories_delete" ON public.budget_categories FOR DELETE TO authenticated USING (family_id = get_my_family_id());

CREATE POLICY "budget_items_select" ON public.budget_items FOR SELECT TO authenticated USING (family_id = get_my_family_id());
CREATE POLICY "budget_items_insert" ON public.budget_items FOR INSERT TO authenticated WITH CHECK (family_id = get_my_family_id());
CREATE POLICY "budget_items_update" ON public.budget_items FOR UPDATE TO authenticated USING (family_id = get_my_family_id());
CREATE POLICY "budget_items_delete" ON public.budget_items FOR DELETE TO authenticated USING (family_id = get_my_family_id());

CREATE POLICY "cbm_select" ON public.category_budget_mapping FOR SELECT TO authenticated USING (family_id = get_my_family_id());
CREATE POLICY "cbm_insert" ON public.category_budget_mapping FOR INSERT TO authenticated WITH CHECK (family_id = get_my_family_id());
CREATE POLICY "cbm_update" ON public.category_budget_mapping FOR UPDATE TO authenticated USING (family_id = get_my_family_id());
CREATE POLICY "cbm_delete" ON public.category_budget_mapping FOR DELETE TO authenticated USING (family_id = get_my_family_id());
