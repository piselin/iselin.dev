-- Run this in the Supabase SQL Editor after creating the owner Auth user.
-- Replace the UUID below with that user's ID from Authentication > Users.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.site_owner (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null unique references auth.users (id) on delete cascade
);
alter table private.site_owner enable row level security;
revoke all on table private.site_owner from public, anon, authenticated;

create or replace function public.is_site_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.site_owner
    where user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_site_owner() from public, anon;
grant execute on function public.is_site_owner() to authenticated;

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  body text not null check (char_length(body) between 1 and 20000),
  created_at timestamptz not null default now()
);
alter table public.notes enable row level security;
revoke all on table public.notes from anon, authenticated;
grant select, insert, update, delete on table public.notes to authenticated;
drop policy if exists "Owner reads notes" on public.notes;
create policy "Owner reads notes" on public.notes
  for select to authenticated
  using ((select public.is_site_owner()) and user_id = (select auth.uid()));
drop policy if exists "Owner creates notes" on public.notes;
create policy "Owner creates notes" on public.notes
  for insert to authenticated
  with check ((select public.is_site_owner()) and user_id = (select auth.uid()));
drop policy if exists "Owner updates notes" on public.notes;
create policy "Owner updates notes" on public.notes
  for update to authenticated
  using ((select public.is_site_owner()) and user_id = (select auth.uid()))
  with check ((select public.is_site_owner()) and user_id = (select auth.uid()));
drop policy if exists "Owner deletes notes" on public.notes;
create policy "Owner deletes notes" on public.notes
  for delete to authenticated
  using ((select public.is_site_owner()) and user_id = (select auth.uid()));

create table if not exists public.private_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  storage_path text not null unique,
  original_name text not null check (char_length(original_name) between 1 and 240),
  content_type text not null default 'application/octet-stream',
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  created_at timestamptz not null default now()
);
alter table public.private_files enable row level security;
revoke all on table public.private_files from anon, authenticated;
grant select, insert, delete on table public.private_files to authenticated;
drop policy if exists "Owner reads private file records" on public.private_files;
create policy "Owner reads private file records" on public.private_files
  for select to authenticated
  using ((select public.is_site_owner()) and user_id = (select auth.uid()));
drop policy if exists "Owner creates private file records" on public.private_files;
create policy "Owner creates private file records" on public.private_files
  for insert to authenticated
  with check ((select public.is_site_owner()) and user_id = (select auth.uid()));
drop policy if exists "Owner deletes private file records" on public.private_files;
create policy "Owner deletes private file records" on public.private_files
  for delete to authenticated
  using ((select public.is_site_owner()) and user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit)
values ('private-documents', 'private-documents', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = 10485760;

drop policy if exists "Owner reads private documents" on storage.objects;
create policy "Owner reads private documents" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'private-documents'
    and (select public.is_site_owner())
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
drop policy if exists "Owner uploads private documents" on storage.objects;
create policy "Owner uploads private documents" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'private-documents'
    and (select public.is_site_owner())
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
drop policy if exists "Owner deletes private documents" on storage.objects;
create policy "Owner deletes private documents" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'private-documents'
    and (select public.is_site_owner())
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

insert into private.site_owner (singleton, user_id)
values (true, '00000000-0000-0000-0000-000000000000')
on conflict (singleton) do update set user_id = excluded.user_id;
