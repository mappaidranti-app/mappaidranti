-- Migrazione per aggiungere la colonna closeup_photo_url (foto ravvicinata)
-- Eseguire questo script nell'SQL Editor di Supabase PRIMA del deploy del nuovo codice:
-- il salvataggio di un idrante scrive questa colonna e fallirebbe se non esistesse.

ALTER TABLE hydrants
ADD COLUMN IF NOT EXISTS closeup_photo_url text;

-- Recupero dati storici: fino ad ora l'URL della foto ravvicinata veniva accodato
-- alle note come "[Foto Ravvicinata]: <url>". Lo spostiamo nella nuova colonna
-- e lo togliamo dalle note (insieme alla riga vuota che lo separava dal testo).
UPDATE hydrants
SET
  closeup_photo_url = substring(notes FROM '\[Foto Ravvicinata\]: (\S+)'),
  notes = nullif(
    btrim(regexp_replace(notes, '\s*\[Foto Ravvicinata\]: \S+', '', 'g')),
    ''
  )
WHERE closeup_photo_url IS NULL
  AND notes LIKE '%[Foto Ravvicinata]: %';
