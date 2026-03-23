-- ============================================================
-- Migration 004 — REV04/REV05 schema additions
-- Nuove tabelle: planned_transfers, residual_distribution, family_invites
-- Nuova colonna: profiles.role
-- ============================================================

-- ------------------------------------------------------------
-- 1. Colonna role su profiles (sistema multi-utente con ruoli)
-- ------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'admin';

-- Ruoli validi: 'admin' | 'editor' | 'viewer' | 'dependent' | 'readonly'
-- admin     → accesso completo, può invitare, può eliminare famiglia
-- editor    → CRUD transazioni, budget, conti — no inviti, no elimina
-- viewer    → solo lettura
-- dependent → accesso limitato (pocket money, spese personali)
-- readonly  → solo dashboard / report


-- ------------------------------------------------------------
-- 2. Trasferimenti pianificati tra conti
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.planned_transfers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id         UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  from_account_id   UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  to_account_id     UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  amount            NUMERIC(12,2) NOT NULL,
  recurrence        TEXT NOT NULL DEFAULT 'monthly',
    -- 'monthly' | 'annual' | 'once' | 'quarterly'
  recurrence_month  INTEGER,        -- 1-12 per annual / once / quarterly
  recurrence_date   DATE,           -- data precisa per once
  description       TEXT,
  year              INTEGER NOT NULL,
  active            BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- Indici
CREATE INDEX IF NOT EXISTS idx_planned_transfers_family     ON public.planned_transfers(family_id);
CREATE INDEX IF NOT EXISTS idx_planned_transfers_from_acct  ON public.planned_transfers(from_account_id);
CREATE INDEX IF NOT EXISTS idx_planned_transfers_to_acct    ON public.planned_transfers(to_account_id);

-- RLS
ALTER TABLE public.planned_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "planned_transfers_select" ON public.planned_transfers
  FOR SELECT USING (family_id = get_my_family_id());

CREATE POLICY "planned_transfers_insert" ON public.planned_transfers
  FOR INSERT WITH CHECK (family_id = get_my_family_id());

CREATE POLICY "planned_transfers_update" ON public.planned_transfers
  FOR UPDATE USING (family_id = get_my_family_id());

CREATE POLICY "planned_transfers_delete" ON public.planned_transfers
  FOR DELETE USING (family_id = get_my_family_id());


-- ------------------------------------------------------------
-- 3. Distribuzione del residuo (saldo disponibile)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.residual_distribution (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id        UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  year             INTEGER NOT NULL,
  label            TEXT NOT NULL,           -- es. "Fondo emergenza", "Investimenti"
  account_id       UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  savings_goal_id  UUID REFERENCES public.savings_goals(id) ON DELETE SET NULL,
  percentage       NUMERIC(5,2) NOT NULL DEFAULT 0,   -- % del saldo disponibile
  sort_order       INTEGER DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- Indici
CREATE INDEX IF NOT EXISTS idx_residual_dist_family ON public.residual_distribution(family_id, year);

-- RLS
ALTER TABLE public.residual_distribution ENABLE ROW LEVEL SECURITY;

CREATE POLICY "residual_dist_select" ON public.residual_distribution
  FOR SELECT USING (family_id = get_my_family_id());

CREATE POLICY "residual_dist_insert" ON public.residual_distribution
  FOR INSERT WITH CHECK (family_id = get_my_family_id());

CREATE POLICY "residual_dist_update" ON public.residual_distribution
  FOR UPDATE USING (family_id = get_my_family_id());

CREATE POLICY "residual_dist_delete" ON public.residual_distribution
  FOR DELETE USING (family_id = get_my_family_id());


-- ------------------------------------------------------------
-- 4. Inviti famiglia (multi-utente)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.family_invites (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id    UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  invited_by   UUID NOT NULL REFERENCES public.profiles(id),
  email        TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'viewer',
  token        UUID DEFAULT gen_random_uuid(),
  status       TEXT NOT NULL DEFAULT 'pending',
    -- 'pending' | 'accepted' | 'expired' | 'revoked'
  created_at   TIMESTAMPTZ DEFAULT now(),
  expires_at   TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days'),
  accepted_at  TIMESTAMPTZ,
  UNIQUE (family_id, email, status)   -- no duplicati attivi per stessa email
);

-- Indici
CREATE INDEX IF NOT EXISTS idx_family_invites_family  ON public.family_invites(family_id);
CREATE INDEX IF NOT EXISTS idx_family_invites_token   ON public.family_invites(token);
CREATE INDEX IF NOT EXISTS idx_family_invites_email   ON public.family_invites(email);

-- RLS
ALTER TABLE public.family_invites ENABLE ROW LEVEL SECURITY;

-- Chi invita (admin di famiglia) vede i propri inviti
CREATE POLICY "family_invites_select" ON public.family_invites
  FOR SELECT USING (family_id = get_my_family_id());

CREATE POLICY "family_invites_insert" ON public.family_invites
  FOR INSERT WITH CHECK (family_id = get_my_family_id());

CREATE POLICY "family_invites_update" ON public.family_invites
  FOR UPDATE USING (family_id = get_my_family_id());

CREATE POLICY "family_invites_delete" ON public.family_invites
  FOR DELETE USING (family_id = get_my_family_id());

-- Chiunque può verificare un invito tramite token (per accettazione)
CREATE POLICY "family_invites_token_check" ON public.family_invites
  FOR SELECT USING (token IS NOT NULL);
