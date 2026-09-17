-- Migration: add water_leak column to hydrants table
-- Run this in Supabase SQL Editor or via CLI
ALTER TABLE public.hydrants
  ADD COLUMN IF NOT EXISTS water_leak boolean DEFAULT false;

COMMENT ON COLUMN public.hydrants.water_leak IS 'Indica se l''idrante presenta una perdita d''acqua visibile.';
