-- ============================================================
-- Migration 007 — Fix get_my_role() NULL edge case
--
-- Problema: get_my_role() restituiva NULL quando non trovava
-- una riga in profiles (invece di 'admin').
-- COALESCE(role, 'admin') si applica ai valori di ogni riga,
-- ma se la SELECT non ritorna righe il risultato è NULL.
-- NULL IN ('admin','editor') = NULL → policy RESTRICTIVE blocca.
--
-- Fix: wrappare la subquery in un COALESCE esterno.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.profiles WHERE id = auth.uid()),
    'admin'
  )
$$;
