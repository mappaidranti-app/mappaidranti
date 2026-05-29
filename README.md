# Mappa Idranti

Web app Next.js 15 per censire idranti su mappa OpenStreetMap con Leaflet e Supabase.

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

Crea la tabella `hydrants`:

```sql
create table public.hydrants (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  type text not null,
  status text not null,
  notes text,
  latitude double precision not null,
  longitude double precision not null,
  photo_url text,
  created_at timestamptz not null default now()
);

alter table public.hydrants enable row level security;

create policy "Public hydrants read"
on public.hydrants for select
using (true);

create policy "Public hydrants insert"
on public.hydrants for insert
with check (true);
```

Crea anche il bucket Storage `hydrant-photos`. Per un MVP pubblico, rendilo public e aggiungi una policy di insert sugli oggetti del bucket.

```sql
create policy "Public hydrant photos upload"
on storage.objects for insert
with check (bucket_id = 'hydrant-photos');
```
