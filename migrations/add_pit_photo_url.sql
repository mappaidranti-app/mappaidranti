-- Migrazione per aggiungere la colonna pit_photo_url
-- Eseguire questo script nell'SQL Editor di Supabase

ALTER TABLE hydrants 
ADD COLUMN pit_photo_url text;
