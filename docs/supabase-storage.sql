create policy "storage_avatars_select" on storage.objects
  for select using (
    bucket_id = 'umoya-files'
    and owner = auth.uid()
    and name like 'avatars/%'
  );

create policy "storage_avatars_insert" on storage.objects
  for insert with check (
    bucket_id = 'umoya-files'
    and owner = auth.uid()
    and name like 'avatars/%'
  );

create policy "storage_avatars_update" on storage.objects
  for update using (
    bucket_id = 'umoya-files'
    and owner = auth.uid()
    and name like 'avatars/%'
  )
  with check (
    bucket_id = 'umoya-files'
    and owner = auth.uid()
    and name like 'avatars/%'
  );

create policy "storage_avatars_delete" on storage.objects
  for delete using (
    bucket_id = 'umoya-files'
    and owner = auth.uid()
    and name like 'avatars/%'
  );
