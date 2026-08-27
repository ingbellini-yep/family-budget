-- Aggiunge il campo budget_type alle macro-categorie budget
-- Valori: 'familiare' (default) | 'professionale'
ALTER TABLE budget_categories
  ADD COLUMN IF NOT EXISTS budget_type text NOT NULL DEFAULT 'familiare'
  CHECK (budget_type IN ('familiare', 'professionale'));
