-- ============================================================
-- Migration 012 — Rimuove le policy RESTRICTIVE su transactions
--
-- Le policy RESTRICTIVE role_transactions_* causano blocchi
-- quando get_my_role() restituisce NULL o un valore non atteso
-- (stesso problema risolto in 008 per budget_items).
-- La sicurezza è garantita dalle policy permissive che verificano
-- family_id = get_my_family_id(). Il controllo ruolo è lato app.
-- ============================================================

DROP POLICY IF EXISTS "role_transactions_insert" ON public.transactions;
DROP POLICY IF EXISTS "role_transactions_update" ON public.transactions;
DROP POLICY IF EXISTS "role_transactions_delete" ON public.transactions;
