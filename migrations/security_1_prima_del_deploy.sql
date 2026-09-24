-- =====================================================================
-- SICUREZZA – PASSO 1: eseguire nell'SQL Editor di Supabase PRIMA del deploy
-- del nuovo codice. Non rompe nulla della versione attuale.
-- =====================================================================

-- 1. Colonne necessarie al nuovo login operatore
ALTER TABLE public.operators
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS failed_pin_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_operators_auth_user_id
  ON public.operators(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- 2. La tabella operators contiene telefoni e hash dei PIN: nessun accesso dal browser.
--    Solo il server (service role, che ignora RLS) può leggerla/scriverla.
--    Senza RLS, chiunque con la chiave anon può scaricarla via API REST.
ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;
-- (nessuna policy = nessun accesso per anon/authenticated)
