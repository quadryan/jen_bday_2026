create extension if not exists "pgcrypto";

create table if not exists public.wishes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  message text not null,
  memory text,
  song text,
  image_url text,
  image_path text,
  frame_fit text not null default 'contain' check (frame_fit in ('cover', 'contain')),
  photo_aspect_ratio double precision not null default 1 check (photo_aspect_ratio between 0.62 and 1.9),
  edit_token text not null,
  position_x double precision not null default 50,
  position_y double precision not null default 50,
  rotation double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.wishes
  add column if not exists photo_aspect_ratio double precision not null default 1;

alter table public.wishes
  alter column frame_fit set default 'contain';

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.site_settings (key, value)
values ('reveal_enabled', 'false'::jsonb)
on conflict (key) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'wish-photos',
  'wish-photos',
  false,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;
