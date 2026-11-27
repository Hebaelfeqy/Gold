-- Gold catalog schema (run once in Supabase SQL editor)

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  code text,
  name text not null,
  category text not null check (category in ('necklace','ring','set','bracelet','earrings','other')),
  karat int not null check (karat in (18,21,22,24)),
  grams numeric(10,3) not null check (grams > 0),
  extra_fee numeric(10,2),            -- null = use default markup from settings
  stock int not null default 0 check (stock >= 0),
  photos text[] not null default '{}',
  description text,
  visible boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  price_mode text not null default 'daily' check (price_mode in ('daily','fixed')),
  markup numeric(10,2) not null default 500,        -- commission added per piece in 'daily' mode (QR)
  fixed_24 numeric(10,2),                           -- 'fixed' mode: QR per gram, set by admin
  fixed_22 numeric(10,2),
  fixed_21 numeric(10,2),
  fixed_18 numeric(10,2),
  last_price_24k numeric(10,2),                     -- last auto price saved (fallback)
  last_price_at timestamptz,
  whatsapp text,                                    -- e.g. 97455555555
  shop_name text default 'فوري الذهب'
);
insert into public.settings (id) values (1) on conflict do nothing;

alter table public.items enable row level security;
alter table public.settings enable row level security;

drop policy if exists "public read visible items" on public.items;
create policy "public read visible items" on public.items
  for select using (visible or auth.role() = 'authenticated');
drop policy if exists "admin write items" on public.items;
create policy "admin write items" on public.items
  for all to authenticated using (true) with check (true);

drop policy if exists "public read settings" on public.settings;
create policy "public read settings" on public.settings for select using (true);
drop policy if exists "admin write settings" on public.settings;
create policy "admin write settings" on public.settings
  for update to authenticated using (true) with check (true);

-- Photo storage (public read, admin upload)
insert into storage.buckets (id, name, public) values ('items','items', true)
  on conflict (id) do nothing;
drop policy if exists "admin upload photos" on storage.objects;
create policy "admin upload photos" on storage.objects
  for insert to authenticated with check (bucket_id = 'items');
drop policy if exists "admin delete photos" on storage.objects;
create policy "admin delete photos" on storage.objects
  for delete to authenticated using (bucket_id = 'items');
