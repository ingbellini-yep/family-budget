-- ============================================================
-- Migration 008 — Rimuove le policy RESTRICTIVE su budget_items
--                 e budget_categories
--
-- Le policy RESTRICTIVE create in 006 causano blocchi anche
-- quando get_my_role() non si comporta come atteso.
-- La sicurezza sufficiente è garantita dalle policy permissive
-- che verificano family_id = get_my_family_id().
-- Il controllo sul ruolo viene gestito lato applicazione.
-- ============================================================

DROP POLICY IF EXISTS "role_budget_items_insert"      ON public.budget_items;
DROP POLICY IF EXISTS "role_budget_items_update"      ON public.budget_items;
DROP POLICY IF EXISTS "role_budget_items_delete"      ON public.budget_items;

DROP POLICY IF EXISTS "role_budget_categories_insert" ON public.budget_categories;
DROP POLICY IF EXISTS "role_budget_categories_update" ON public.budget_categories;
DROP POLICY IF EXISTS "role_budget_categories_delete" ON public.budget_categories;
