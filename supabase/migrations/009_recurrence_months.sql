-- Migration 009 — Aggiunge colonna recurrence_months per ricorrenza "Mesi specifici"
-- Array di interi (1=Gen ... 12=Dic) che indica in quali mesi applicare l'importo

ALTER TABLE public.budget_items
  ADD COLUMN IF NOT EXISTS recurrence_months INTEGER[];

ALTER TABLE public.recurring_expenses
  ADD COLUMN IF NOT EXISTS recurrence_months INTEGER[];
