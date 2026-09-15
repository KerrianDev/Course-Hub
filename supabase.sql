-- À exécuter une seule fois dans Supabase > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  emoji text default '📘',
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.course_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  chapter_id uuid references public.chapters(id) on delete cascade,
  name text not null,
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint not null default 0,
  created_at timestamptz not null default now()
);

alter table public.subjects enable row level security;
alter table public.chapters enable row level security;
alter table public.course_files enable row level security;

create policy "subjects_owner_all" on public.subjects
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "chapters_owner_all" on public.chapters
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "course_files_owner_all" on public.course_files
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('course-files', 'course-files', false)
on conflict (id) do update set public = false;

create policy "storage_read_own" on storage.objects
for select using (
  bucket_id = 'course-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "storage_insert_own" on storage.objects
for insert with check (
  bucket_id = 'course-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "storage_delete_own" on storage.objects
for delete using (
  bucket_id = 'course-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);
