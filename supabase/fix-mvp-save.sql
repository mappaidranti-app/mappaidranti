-- Run this in the Supabase SQL editor to restore the simple MVP save flow.
-- It removes multi-tenant restrictions from hydrants and allows anonymous MVP inserts.

do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'hydrants'
  loop
    execute format('drop policy if exists %I on public.hydrants', policy_record.policyname);
  end loop;
end $$;

alter table public.hydrants enable row level security;

alter table public.hydrants
  add column if not exists code text,
  add column if not exists type text,
  add column if not exists status text,
  add column if not exists notes text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists photo_url text,
  add column if not exists created_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'hydrants'
      and column_name = 'municipality_id'
  ) then
    alter table public.hydrants alter column municipality_id drop not null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'hydrants'
      and column_name = 'created_by'
  ) then
    alter table public.hydrants alter column created_by drop not null;
  end if;
end $$;

create policy "Public hydrants read"
on public.hydrants for select
using (true);

create policy "Public hydrants insert"
on public.hydrants for insert
with check (true);

do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname like '%hydrant%'
  loop
    execute format('drop policy if exists %I on storage.objects', policy_record.policyname);
  end loop;
end $$;

insert into storage.buckets (id, name, public)
values ('hydrant-photos', 'hydrant-photos', true)
on conflict (id) do update
set public = true;

create policy "Public hydrant photos upload"
on storage.objects for insert
with check (bucket_id = 'hydrant-photos');

create policy "Public hydrant photos read"
on storage.objects for select
using (bucket_id = 'hydrant-photos');
