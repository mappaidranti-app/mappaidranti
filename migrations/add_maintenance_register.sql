-- =====================================================================
-- REGISTRO MANUTENZIONE – eseguire nell'SQL Editor di Supabase PRIMA del deploy.
-- Aggiunge: tracciabilità sulla scheda idrante (chi ha censito / modificato),
-- tabella delle codifiche intervento e registro degli interventi.
-- Lo script si può rieseguire senza errori.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Permessi: chi può lavorare sugli idranti di un comune
--    (stessa regola delle policy di insert/update su hydrants)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_edit_municipality(mun uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role = 'superadmin'
        OR (p.role = 'referent' AND (p.municipality_id IS NULL OR p.municipality_id = mun))
        OR (p.role IN ('admin_ente', 'operator') AND p.municipality_id = mun)
      )
  );
$$;

-- Solo gli amministratori (non gli operatori): serve per cancellare voci del registro
CREATE OR REPLACE FUNCTION public.can_admin_municipality(mun uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role = 'superadmin'
        OR (p.role = 'referent' AND (p.municipality_id IS NULL OR p.municipality_id = mun))
        OR (p.role = 'admin_ente' AND p.municipality_id = mun)
      )
  );
$$;

-- ---------------------------------------------------------------------
-- 1. Tracciabilità sulla scheda idrante
-- ---------------------------------------------------------------------
ALTER TABLE public.hydrants
  ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by_name text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by_name text;

-- Ad ogni modifica: data e autore aggiornati dal database; i dati di censimento non cambiano.
CREATE OR REPLACE FUNCTION public.hydrants_before_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  NEW.created_at := OLD.created_at;
  NEW.created_by := OLD.created_by;
  NEW.created_by_name := OLD.created_by_name;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS hydrants_before_update ON public.hydrants;
CREATE TRIGGER hydrants_before_update
  BEFORE UPDATE ON public.hydrants
  FOR EACH ROW EXECUTE FUNCTION public.hydrants_before_update();

-- ---------------------------------------------------------------------
-- 2. Codifiche intervento (es. le 576 voci fornite dal committente)
--    Lettura per gli utenti autenticati; scrittura solo dal server (import del superadmin).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.intervention_codes (
  code text PRIMARY KEY,
  description text NOT NULL,
  category text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.intervention_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Codifiche leggibili dagli utenti autenticati" ON public.intervention_codes;
CREATE POLICY "Codifiche leggibili dagli utenti autenticati"
  ON public.intervention_codes FOR SELECT TO authenticated
  USING (true);

-- ---------------------------------------------------------------------
-- 3. Registro interventi
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hydrant_interventions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hydrant_id uuid NOT NULL REFERENCES public.hydrants(id) ON DELETE CASCADE,
  -- copiato dall'idrante dal trigger qui sotto: non lo decide il browser
  municipality_id uuid REFERENCES public.municipalities(id) ON DELETE SET NULL,
  performed_at date NOT NULL DEFAULT current_date,
  category text NOT NULL CHECK (category IN (
    'verifica', 'prova_acqua', 'verniciatura', 'tappi', 'catenelle', 'riparazione', 'altro'
  )),
  code text REFERENCES public.intervention_codes(code) ON UPDATE CASCADE,
  outcome text CHECK (outcome IN ('positivo', 'negativo', 'parziale')),
  water_ok boolean,
  pressure_bar numeric(5, 2) CHECK (pressure_bar IS NULL OR (pressure_bar >= 0 AND pressure_bar < 100)),
  quantity integer CHECK (quantity IS NULL OR quantity >= 0),
  -- chi ha eseguito l'intervento: operatore o ditta, con eventuale codice
  performed_by text,
  notes text,
  photo_url text,
  -- stato dell'idrante dopo l'intervento (se indicato, aggiorna anche la scheda)
  status_after text CHECK (status_after IN ('Funzionante', 'Non funzionante', 'Da verificare')),
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interventions_hydrant ON public.hydrant_interventions (hydrant_id, performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_interventions_municipality ON public.hydrant_interventions (municipality_id, performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_interventions_category ON public.hydrant_interventions (category, performed_at DESC);

CREATE OR REPLACE FUNCTION public.hydrant_interventions_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT h.municipality_id INTO NEW.municipality_id
  FROM public.hydrants h WHERE h.id = NEW.hydrant_id;
  NEW.created_by := auth.uid();
  NEW.created_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS hydrant_interventions_before_insert ON public.hydrant_interventions;
CREATE TRIGGER hydrant_interventions_before_insert
  BEFORE INSERT ON public.hydrant_interventions
  FOR EACH ROW EXECUTE FUNCTION public.hydrant_interventions_before_insert();

ALTER TABLE public.hydrant_interventions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Interventi leggibili dal proprio comune" ON public.hydrant_interventions;
CREATE POLICY "Interventi leggibili dal proprio comune"
  ON public.hydrant_interventions FOR SELECT TO authenticated
  USING (public.can_edit_municipality(municipality_id));

-- Il registro non si modifica: si aggiungono voci. Il controllo usa il comune
-- dell'idrante (il trigger sopra lo imposta prima del controllo della policy).
DROP POLICY IF EXISTS "Interventi registrabili dal proprio comune" ON public.hydrant_interventions;
CREATE POLICY "Interventi registrabili dal proprio comune"
  ON public.hydrant_interventions FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_municipality(municipality_id));

DROP POLICY IF EXISTS "Interventi cancellabili dagli amministratori" ON public.hydrant_interventions;
CREATE POLICY "Interventi cancellabili dagli amministratori"
  ON public.hydrant_interventions FOR DELETE TO authenticated
  USING (public.can_admin_municipality(municipality_id));
