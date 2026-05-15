# Mappa Idranti

Piattaforma multi-tenant Next.js 15 per censire idranti comunali su OpenStreetMap con Supabase Auth, ruoli applicativi e dashboard protette.

## Ruoli

- `super_admin`: vede tutti i comuni, utenti e idranti.
- `client_admin`: vede statistiche e utenti del proprio comune.
- `surveyor`: usa la mappa operativa e salva idranti nel proprio comune.

## Avvio

```bash
npm install
npm run dev
```

Crea `.env.local` partendo da `.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Supabase

Abilita Supabase Auth con email/password. Poi crea schema e policy:

```sql
create type public.app_role as enum ('super_admin', 'client_admin', 'surveyor');

create table public.municipalities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  province text,
  region text,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role public.app_role not null default 'surveyor',
  municipality_id uuid references public.municipalities(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint municipality_required_for_client_roles
    check (
      role = 'super_admin'
      or municipality_id is not null
    )
);

create table public.hydrants (
  id uuid primary key default gen_random_uuid(),
  municipality_id uuid not null references public.municipalities(id) on delete cascade,
  code text not null,
  type text not null,
  status text not null,
  notes text,
  latitude double precision not null,
  longitude double precision not null,
  photo_url text,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index hydrants_municipality_id_idx on public.hydrants(municipality_id);
create index profiles_municipality_id_idx on public.profiles(municipality_id);
```

### Helper RLS

```sql
create or replace function public.current_user_role()
returns public.app_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.current_user_municipality_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select municipality_id from public.profiles where id = auth.uid()
$$;
```

### Policy

```sql
alter table public.municipalities enable row level security;
alter table public.profiles enable row level security;
alter table public.hydrants enable row level security;

create policy "municipalities super admin read"
on public.municipalities for select
using (public.current_user_role() = 'super_admin');

create policy "municipalities tenant read"
on public.municipalities for select
using (id = public.current_user_municipality_id());

create policy "profiles own read"
on public.profiles for select
using (id = auth.uid());

create policy "profiles super admin read"
on public.profiles for select
using (public.current_user_role() = 'super_admin');

create policy "profiles client admin tenant read"
on public.profiles for select
using (
  public.current_user_role() = 'client_admin'
  and municipality_id = public.current_user_municipality_id()
);

create policy "hydrants tenant read"
on public.hydrants for select
using (
  public.current_user_role() = 'super_admin'
  or municipality_id = public.current_user_municipality_id()
);

create policy "hydrants surveyor insert"
on public.hydrants for insert
with check (
  public.current_user_role() = 'surveyor'
  and municipality_id = public.current_user_municipality_id()
);
```

## Storage

Crea il bucket `hydrant-photos`. L'app carica le foto nella cartella `{municipality_id}/...`.

```sql
create policy "hydrant photos tenant upload"
on storage.objects for insert
with check (
  bucket_id = 'hydrant-photos'
  and public.current_user_role() = 'surveyor'
  and (storage.foldername(name))[1] = public.current_user_municipality_id()::text
);

create policy "hydrant photos tenant read"
on storage.objects for select
using (
  bucket_id = 'hydrant-photos'
  and (
    public.current_user_role() = 'super_admin'
    or (storage.foldername(name))[1] = public.current_user_municipality_id()::text
  )
);
```

Se il bucket e pubblico, `photo_url` puo essere usato direttamente in dashboard e report.
