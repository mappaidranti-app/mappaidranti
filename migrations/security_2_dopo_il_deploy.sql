-- =====================================================================
-- SICUREZZA – PASSO 2: eseguire DOPO il deploy del nuovo codice e dopo aver
-- verificato che il login operatore (telefono + PIN) funzioni.
-- =====================================================================

-- 0. (Diagnostica) Elenco policy attuali: controlla che non ne restino altre "aperte"
--    (qual / with_check = true) oltre a quelle rimosse qui sotto.
-- SELECT tablename, policyname, cmd, roles, qual, with_check
-- FROM pg_policies
-- WHERE schemaname IN ('public', 'storage')
-- ORDER BY tablename, cmd;

-- 1. Idranti: via la policy dell'MVP che permetteva a CHIUNQUE di inserire.
--    Restano attive "Enable insert/update for admins and operators" (add_hydrants_rls.sql),
--    che limitano la scrittura a superadmin / referenti / admin_ente / operatori del comune.
DROP POLICY IF EXISTS "Public hydrants insert" ON public.hydrants;

-- La lettura resta pubblica (serve alla modalità Visitatore).
-- Se la modalità Visitatore non serve, sostituirla con la sola lettura per utenti autenticati:
-- DROP POLICY IF EXISTS "Public hydrants read" ON public.hydrants;
-- CREATE POLICY "Authenticated hydrants read" ON public.hydrants
--   FOR SELECT TO authenticated USING (true);

-- 2. Foto: upload consentito solo a utenti autenticati (gli operatori ora lo sono).
DROP POLICY IF EXISTS "Public hydrant photos upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated hydrant photos upload" ON storage.objects;
CREATE POLICY "Authenticated hydrant photos upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'hydrant-photos');
