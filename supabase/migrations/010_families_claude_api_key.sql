-- Migration 010 — Aggiunge campo claude_api_key alla tabella families
-- La chiave viene salvata dall'utente in Impostazioni → Integrazione AI
-- e usata lato browser per chiamare l'API Anthropic direttamente

ALTER TABLE public.families
  ADD COLUMN IF NOT EXISTS claude_api_key TEXT;
