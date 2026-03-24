-- Migration 011 — Aggiunge 'mesi_specifici' ai check constraint
--               di budget_items e recurring_expenses

ALTER TABLE public.budget_items
  DROP CONSTRAINT IF EXISTS budget_items_recurrence_check;

ALTER TABLE public.budget_items
  ADD CONSTRAINT budget_items_recurrence_check
  CHECK (recurrence IN ('weekly','monthly','annual','once','quarterly','mesi_specifici'));

ALTER TABLE public.recurring_expenses
  DROP CONSTRAINT IF EXISTS recurring_expenses_frequency_check;

ALTER TABLE public.recurring_expenses
  ADD CONSTRAINT recurring_expenses_frequency_check
  CHECK (frequency IN ('mensile','annuale','settimanale','mesi_specifici'));
