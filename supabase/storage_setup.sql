-- Supabase Storage setup for frontend direct upload/download.
-- This setup is intentionally permissive for the current demo architecture
-- (frontend uses anon key without Supabase Auth session).
-- Tighten these policies before production.

-- 1) Create/Update bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'files',
  'files',
  false,
  52428800,
  array[
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 2) Storage object policies (demo-open for anon/authenticated)
drop policy if exists "files_select_anon" on storage.objects;
create policy "files_select_anon"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'files');

drop policy if exists "files_insert_anon" on storage.objects;
create policy "files_insert_anon"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'files');

drop policy if exists "files_update_anon" on storage.objects;
create policy "files_update_anon"
on storage.objects
for update
to anon, authenticated
using (bucket_id = 'files')
with check (bucket_id = 'files');

drop policy if exists "files_delete_anon" on storage.objects;
create policy "files_delete_anon"
on storage.objects
for delete
to anon, authenticated
using (bucket_id = 'files');
