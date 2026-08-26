-- Migrazione per la ristrutturazione Pozzetto e Cappellotto
-- Eseguire questo script nell'SQL Editor di Supabase

-- 1. Aggiunta colonna pit_status (con vincoli check stile enum)
ALTER TABLE hydrants 
ADD COLUMN pit_status text CHECK (pit_status IN ('apre_facilmente', 'bloccato', 'non_ispezionabile'));

-- 2. Aggiunta colonna cappellotto_status (con vincoli check stile enum)
ALTER TABLE hydrants 
ADD COLUMN cappellotto_status text CHECK (cappellotto_status IN ('integro', 'mancante', 'danneggiato'));

-- 3. Migrazione dati esistenti (opzionale/se necessario)
-- Migrazione vecchio pit_inspectable (booleano) verso il nuovo pit_status
UPDATE hydrants 
SET pit_status = 
  CASE 
    WHEN pit_inspectable = true THEN 'apre_facilmente'
    WHEN pit_inspectable = false THEN 'bloccato'
    ELSE NULL
  END
WHERE pit_inspectable IS NOT NULL;

-- Migrazione vecchio attached_pit (booleano per il cappello) verso cappellotto_status
UPDATE hydrants 
SET cappellotto_status = 
  CASE 
    WHEN attached_pit = true THEN 'integro'
    WHEN attached_pit = false THEN 'mancante'
    ELSE NULL
  END
WHERE attached_pit IS NOT NULL;

-- NOTA: I vecchi campi attached_pit e pit_inspectable sono stati mantenuti
-- nel database per retrocompatibilità temporanea, non eliminarli subito.
