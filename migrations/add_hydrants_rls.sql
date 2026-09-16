-- Abilita RLS (se non è già attivo)
ALTER TABLE public.hydrants ENABLE ROW LEVEL SECURITY;

-- 1. Permetti SELECT a tutti gli utenti autenticati (o personalizza a seconda delle necessità)
-- CREATE POLICY "Enable read access for all authenticated users" ON public.hydrants FOR SELECT USING (auth.role() = 'authenticated');

-- 2. Permetti INSERT a admin_ente e operator per il proprio comune, e ai superadmin per tutti
CREATE POLICY "Enable insert for admins and operators"
ON public.hydrants
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND (
      profiles.role = 'superadmin' OR 
      (profiles.role = 'referent' AND (profiles.municipality_id IS NULL OR profiles.municipality_id = hydrants.municipality_id)) OR
      ((profiles.role = 'admin_ente' OR profiles.role = 'operator') AND profiles.municipality_id = hydrants.municipality_id)
    )
  )
);

-- 3. Permetti UPDATE a admin_ente e operator per il proprio comune, e ai superadmin per tutti
CREATE POLICY "Enable update for admins and operators"
ON public.hydrants
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND (
      profiles.role = 'superadmin' OR 
      (profiles.role = 'referent' AND (profiles.municipality_id IS NULL OR profiles.municipality_id = hydrants.municipality_id)) OR
      ((profiles.role = 'admin_ente' OR profiles.role = 'operator') AND profiles.municipality_id = hydrants.municipality_id)
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND (
      profiles.role = 'superadmin' OR 
      (profiles.role = 'referent' AND (profiles.municipality_id IS NULL OR profiles.municipality_id = hydrants.municipality_id)) OR
      ((profiles.role = 'admin_ente' OR profiles.role = 'operator') AND profiles.municipality_id = hydrants.municipality_id)
    )
  )
);
