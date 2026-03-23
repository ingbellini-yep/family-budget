-- ============================================================
-- Migration 005 — Fase 7: Utenti e Inviti
-- Aggiunge: allowed_sections, pocket_money_limit su profiles
-- Aggiunge: get_my_role() helper
-- Aggiunge: RLS RESTRICTIVE per ruoli readonly/viewer/dependent
-- ============================================================

-- 1. Nuove colonne su profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS allowed_sections TEXT[]    DEFAULT NULL,  -- NULL = tutte le sezioni
  ADD COLUMN IF NOT EXISTS pocket_money_limit NUMERIC(10,2) DEFAULT NULL;  -- solo per ruolo dependent

-- 2. Helper per ottenere il ruolo dell'utente corrente
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(role, 'admin') FROM public.profiles WHERE id = auth.uid()
$$;

-- ============================================================
-- 3. RLS RESTRICTIVE — limitazioni per ruolo
--    Si sommano alle policy permissive esistenti:
--    accesso = policy_permissiva AND policy_restrictiva
-- ============================================================

-- ── TRANSACTIONS ────────────────────────────────────────────

DROP POLICY IF EXISTS "role_transactions_select" ON public.transactions;
CREATE POLICY "role_transactions_select" ON public.transactions
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (
    CASE
      WHEN get_my_role() = 'dependent' THEN created_by = auth.uid()
      ELSE true
    END
  );

DROP POLICY IF EXISTS "role_transactions_insert" ON public.transactions;
CREATE POLICY "role_transactions_insert" ON public.transactions
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    get_my_role() IN ('admin', 'editor', 'dependent')
  );

DROP POLICY IF EXISTS "role_transactions_update" ON public.transactions;
CREATE POLICY "role_transactions_update" ON public.transactions
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (
    CASE
      WHEN get_my_role() IN ('admin', 'editor') THEN true
      WHEN get_my_role() = 'dependent'          THEN created_by = auth.uid()
      ELSE false
    END
  );

DROP POLICY IF EXISTS "role_transactions_delete" ON public.transactions;
CREATE POLICY "role_transactions_delete" ON public.transactions
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (
    CASE
      WHEN get_my_role() IN ('admin', 'editor') THEN true
      WHEN get_my_role() = 'dependent'          THEN created_by = auth.uid()
      ELSE false
    END
  );

-- ── ACCOUNTS ────────────────────────────────────────────────

DROP POLICY IF EXISTS "role_accounts_write" ON public.accounts;
CREATE POLICY "role_accounts_write" ON public.accounts
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'editor'));

DROP POLICY IF EXISTS "role_accounts_update" ON public.accounts;
CREATE POLICY "role_accounts_update" ON public.accounts
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (get_my_role() IN ('admin', 'editor'));

DROP POLICY IF EXISTS "role_accounts_delete" ON public.accounts;
CREATE POLICY "role_accounts_delete" ON public.accounts
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (get_my_role() = 'admin');

-- ── CATEGORIES ──────────────────────────────────────────────

DROP POLICY IF EXISTS "role_categories_write" ON public.categories;
CREATE POLICY "role_categories_write" ON public.categories
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'editor'));

DROP POLICY IF EXISTS "role_categories_update" ON public.categories;
CREATE POLICY "role_categories_update" ON public.categories
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (get_my_role() IN ('admin', 'editor'));

DROP POLICY IF EXISTS "role_categories_delete" ON public.categories;
CREATE POLICY "role_categories_delete" ON public.categories
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (get_my_role() IN ('admin', 'editor'));

-- ── BUDGET ITEMS ────────────────────────────────────────────

DROP POLICY IF EXISTS "budget_items_insert" ON public.budget_items;
CREATE POLICY "budget_items_insert" ON public.budget_items
  FOR INSERT
  TO authenticated
  WITH CHECK (family_id = get_my_family_id() AND get_my_role() IN ('admin', 'editor'));

DROP POLICY IF EXISTS "budget_items_update" ON public.budget_items;
CREATE POLICY "budget_items_update" ON public.budget_items
  FOR UPDATE
  TO authenticated
  USING (family_id = get_my_family_id() AND get_my_role() IN ('admin', 'editor'));

DROP POLICY IF EXISTS "budget_items_delete" ON public.budget_items;
CREATE POLICY "budget_items_delete" ON public.budget_items
  FOR DELETE
  TO authenticated
  USING (family_id = get_my_family_id() AND get_my_role() IN ('admin', 'editor'));

-- ── BUDGET CATEGORIES ────────────────────────────────────────

DROP POLICY IF EXISTS "budget_categories_insert" ON public.budget_categories;
CREATE POLICY "budget_categories_insert" ON public.budget_categories
  FOR INSERT
  TO authenticated
  WITH CHECK (family_id = get_my_family_id() AND get_my_role() IN ('admin', 'editor'));

DROP POLICY IF EXISTS "budget_categories_update" ON public.budget_categories;
CREATE POLICY "budget_categories_update" ON public.budget_categories
  FOR UPDATE
  TO authenticated
  USING (family_id = get_my_family_id() AND get_my_role() IN ('admin', 'editor'));

DROP POLICY IF EXISTS "budget_categories_delete" ON public.budget_categories;
CREATE POLICY "budget_categories_delete" ON public.budget_categories
  FOR DELETE
  TO authenticated
  USING (family_id = get_my_family_id() AND get_my_role() IN ('admin', 'editor'));

-- ── FAMILY INVITES: solo admin può inviare ───────────────────

DROP POLICY IF EXISTS "family_invites_insert" ON public.family_invites;
CREATE POLICY "family_invites_insert" ON public.family_invites
  FOR INSERT
  TO authenticated
  WITH CHECK (family_id = get_my_family_id() AND get_my_role() = 'admin');

DROP POLICY IF EXISTS "family_invites_update" ON public.family_invites;
CREATE POLICY "family_invites_update" ON public.family_invites
  FOR UPDATE
  TO authenticated
  USING (family_id = get_my_family_id() AND get_my_role() = 'admin');

DROP POLICY IF EXISTS "family_invites_delete" ON public.family_invites;
CREATE POLICY "family_invites_delete" ON public.family_invites
  FOR DELETE
  TO authenticated
  USING (family_id = get_my_family_id() AND get_my_role() = 'admin');

-- ── PROFILES: admin può aggiornare ruoli dei membri ──────────

DROP POLICY IF EXISTS "admin_update_family_profiles" ON public.profiles;
CREATE POLICY "admin_update_family_profiles" ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    family_id = get_my_family_id() AND
    family_id IS NOT NULL AND
    get_my_role() = 'admin'
  )
  WITH CHECK (
    family_id = get_my_family_id() AND
    family_id IS NOT NULL
  );
