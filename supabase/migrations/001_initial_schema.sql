-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- TABLES
-- =============================================

-- Families
CREATE TABLE IF NOT EXISTS public.families (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Profiles (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  family_id UUID REFERENCES public.families(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Accounts
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('corrente', 'carta', 'investimento', 'risparmio')),
  bank_name TEXT,
  color TEXT,
  icon TEXT,
  balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Categories
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('entrata', 'uscita', 'risparmio')),
  color TEXT,
  icon TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Budgets
CREATE TABLE IF NOT EXISTS public.budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  year INTEGER NOT NULL,
  month INTEGER CHECK (month BETWEEN 1 AND 12),
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (family_id, category_id, year, month)
);

-- Transactions
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('entrata', 'uscita')),
  description TEXT NOT NULL,
  original_description TEXT,
  note TEXT,
  source TEXT NOT NULL DEFAULT 'manuale' CHECK (source IN ('manuale', 'pdf', 'screenshot', 'csv')),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET DEFAULT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Recurring expenses
CREATE TABLE IF NOT EXISTS public.recurring_expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('mensile', 'annuale', 'settimanale')),
  due_day INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  next_due_date DATE NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Savings goals
CREATE TABLE IF NOT EXISTS public.savings_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount NUMERIC(12, 2) NOT NULL,
  current_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  target_date DATE,
  color TEXT,
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Import logs
CREATE TABLE IF NOT EXISTS public.import_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('pdf', 'screenshot', 'csv')),
  bank_name TEXT,
  file_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  transactions_imported INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_profiles_family_id ON public.profiles(family_id);
CREATE INDEX IF NOT EXISTS idx_accounts_family_id ON public.accounts(family_id);
CREATE INDEX IF NOT EXISTS idx_categories_family_id ON public.categories(family_id);
CREATE INDEX IF NOT EXISTS idx_budgets_family_id ON public.budgets(family_id);
CREATE INDEX IF NOT EXISTS idx_budgets_year_month ON public.budgets(year, month);
CREATE INDEX IF NOT EXISTS idx_transactions_family_id ON public.transactions(family_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON public.transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON public.transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_family_id ON public.recurring_expenses(family_id);
CREATE INDEX IF NOT EXISTS idx_savings_goals_family_id ON public.savings_goals(family_id);
CREATE INDEX IF NOT EXISTS idx_import_logs_family_id ON public.import_logs(family_id);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES
-- =============================================

-- Helper function: get the family_id for the current authenticated user
CREATE OR REPLACE FUNCTION public.get_my_family_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT family_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- FAMILIES
-- Any authenticated user can create a family
CREATE POLICY "families_insert" ON public.families
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Members can read their own family
CREATE POLICY "families_select" ON public.families
  FOR SELECT TO authenticated
  USING (id = public.get_my_family_id());

-- Members can update their own family
CREATE POLICY "families_update" ON public.families
  FOR UPDATE TO authenticated
  USING (id = public.get_my_family_id())
  WITH CHECK (id = public.get_my_family_id());

-- PROFILES
-- Users can read their own profile
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Users can read profiles in same family
CREATE POLICY "profiles_select_family" ON public.profiles
  FOR SELECT TO authenticated
  USING (family_id = public.get_my_family_id() AND family_id IS NOT NULL);

-- Users can insert their own profile
CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ACCOUNTS
CREATE POLICY "accounts_all" ON public.accounts
  FOR ALL TO authenticated
  USING (family_id = public.get_my_family_id())
  WITH CHECK (family_id = public.get_my_family_id());

-- CATEGORIES
CREATE POLICY "categories_all" ON public.categories
  FOR ALL TO authenticated
  USING (family_id = public.get_my_family_id())
  WITH CHECK (family_id = public.get_my_family_id());

-- BUDGETS
CREATE POLICY "budgets_all" ON public.budgets
  FOR ALL TO authenticated
  USING (family_id = public.get_my_family_id())
  WITH CHECK (family_id = public.get_my_family_id());

-- TRANSACTIONS
CREATE POLICY "transactions_all" ON public.transactions
  FOR ALL TO authenticated
  USING (family_id = public.get_my_family_id())
  WITH CHECK (family_id = public.get_my_family_id());

-- RECURRING EXPENSES
CREATE POLICY "recurring_expenses_all" ON public.recurring_expenses
  FOR ALL TO authenticated
  USING (family_id = public.get_my_family_id())
  WITH CHECK (family_id = public.get_my_family_id());

-- SAVINGS GOALS
CREATE POLICY "savings_goals_all" ON public.savings_goals
  FOR ALL TO authenticated
  USING (family_id = public.get_my_family_id())
  WITH CHECK (family_id = public.get_my_family_id());

-- IMPORT LOGS
CREATE POLICY "import_logs_all" ON public.import_logs
  FOR ALL TO authenticated
  USING (family_id = public.get_my_family_id())
  WITH CHECK (family_id = public.get_my_family_id());

-- =============================================
-- TRIGGER: auto-create profile on user signup
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, family_id)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NULL
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Drop trigger if exists, then recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
