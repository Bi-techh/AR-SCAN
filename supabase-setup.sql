create table if not exists public.frames (
  id text primary key,
  name text not null,
  image_name text not null,
  image_url text not null,
  image_path text not null,
  video_name text not null,
  video_url text not null,
  video_path text not null,
  mind_name text,
  mind_url text,
  mind_path text,
  created_at timestamptz not null default now()
);

alter table public.frames add column if not exists mind_name text;
alter table public.frames add column if not exists mind_url text;
alter table public.frames add column if not exists mind_path text;

alter table public.frames enable row level security;

create policy "Anyone can read frame scan records"
on public.frames
for select
to anon
using (true);

create policy "Anyone can create frame scan records"
on public.frames
for insert
to anon
with check (true);

insert into storage.buckets (id, name, public)
values ('framecast', 'framecast', true)
on conflict (id) do update set public = true;

create policy "Anyone can read framecast files"
on storage.objects
for select
to anon
using (bucket_id = 'framecast');

create policy "Anyone can upload framecast files"
on storage.objects
for insert
to anon
with check (bucket_id = 'framecast');
