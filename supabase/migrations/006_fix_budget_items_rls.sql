-- ============================================================
-- Migration 006 — Fix RLS budget_items
-- La migration 005 ha rimpiazzato le policy permissive con
-- policy che richiedono get_my_role() IN ('admin','editor').
-- Se get_my_role() restituisce NULL o un valore diverso per
-- qualsiasi motivo, ogni INSERT/UPDATE/DELETE è bloccato.
--
-- Soluzione: le policy su budget_items devono essere
-- RESTRICTIVE (si sommano alle permissive esistenti) oppure
-- la policy permissiva deve tornare a fare solo il check
-- family_id e la limitazione per ruolo va in una policy
-- RESTRICTIVE separata.
--
-- Questo script ripristina il comportamento corretto:
-- 1. Policy permissiva: controlla family_id (come originale)
-- 2. Policy restrictiva SEPARATA: controlla il ruolo
-- ============================================================

-- ── STEP 1: elimina le policy attuali ──────────────────────

DROP POLICY IF EXISTS "budget_items_insert"  ON public.budget_items;
DROP POLICY IF EXISTS "budget_items_update"  ON public.budget_items;
DROP POLICY IF EXISTS "budget_items_delete"  ON public.budget_items;

-- Policy restrictive separate (potrebbero già esistere da 005)
DROP POLICY IF EXISTS "role_budget_items_insert" ON public.budget_items;
DROP POLICY IF EXISTS "role_budget_items_update" ON public.budget_items;
DROP POLICY IF EXISTS "role_budget_items_delete" ON public.budget_items;

-- ── STEP 2: policy permissive (solo family_id check) ───────

CREATE POLICY "budget_items_insert" ON public.budget_items
  FOR INSERT
  TO authenticated
  WITH CHECK (family_id = get_my_family_id());

CREATE POLICY "budget_items_update" ON public.budget_items
  FOR UPDATE
  TO authenticated
  USING (family_id = get_my_family_id());

CREATE POLICY "budget_items_delete" ON public.budget_items
  FOR DELETE
  TO authenticated
  USING (family_id = get_my_family_id());

-- ── STEP 3: policy RESTRICTIVE per ruolo ───────────────────
-- Si somma alle permissive: accesso = permissiva AND restrictiva

CREATE POLICY "role_budget_items_insert" ON public.budget_items
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'editor'));

CREATE POLICY "role_budget_items_update" ON public.budget_items
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (get_my_role() IN ('admin', 'editor'));

CREATE POLICY "role_budget_items_delete" ON public.budget_items
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (get_my_role() IN ('admin', 'editor'));

-- ── STEP 4: stessa correzione per budget_categories ────────

DROP POLICY IF EXISTS "budget_categories_insert" ON public.budget_categories;
DROP POLICY IF EXISTS "budget_categories_update" ON public.budget_categories;
DROP POLICY IF EXISTS "budget_categories_delete" ON public.budget_categories;
DROP POLICY IF EXISTS "role_budget_categories_insert" ON public.budget_categories;
DROP POLICY IF EXISTS "role_budget_categories_update" ON public.budget_categories;
DROP POLICY IF EXISTS "role_budget_categories_delete" ON public.budget_categories;

CREATE POLICY "budget_categories_insert" ON public.budget_categories
  FOR INSERT TO authenticated
  WITH CHECK (family_id = get_my_family_id());

CREATE POLICY "budget_categories_update" ON public.budget_categories
  FOR UPDATE TO authenticated
  USING (family_id = get_my_family_id());

CREATE POLICY "budget_categories_delete" ON public.budget_categories
  FOR DELETE TO authenticated
  USING (family_id = get_my_family_id());

CREATE POLICY "role_budget_categories_insert" ON public.budget_categories
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'editor'));

CREATE POLICY "role_budget_categories_update" ON public.budget_categories
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'editor'));

CREATE POLICY "role_budget_categories_delete" ON public.budget_categories
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (get_my_role() IN ('admin', 'editor'));
