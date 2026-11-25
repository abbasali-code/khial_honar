-- Secure upload area for registration applications.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('academy-application-uploads','academy-application-uploads',true,8388608,
  array['image/jpeg','image/png','image/webp','image/gif','application/pdf']::text[])
on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "Applicants upload their own application files" on storage.objects;
create policy "Applicants upload their own application files"
on storage.objects for insert to authenticated
with check (
  bucket_id='academy-application-uploads'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and (storage.foldername(name))[2]='applications'
);

drop policy if exists "Applicants delete their own application files" on storage.objects;
create policy "Applicants delete their own application files"
on storage.objects for delete to authenticated
using (
  bucket_id='academy-application-uploads'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and (storage.foldername(name))[2]='applications'
);
