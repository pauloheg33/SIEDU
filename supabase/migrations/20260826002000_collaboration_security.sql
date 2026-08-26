begin;

create or replace function public.admin_update_user(
  target_user_id uuid,
  target_role public.user_role default null,
  target_active boolean default null
)
returns public.users
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_user public.users;
begin
  if not private.is_admin() then
    raise exception 'Apenas administradores podem gerenciar usuários.';
  end if;
  update public.users
  set role = coalesce(target_role, role),
      is_active = coalesce(target_active, is_active)
  where id = target_user_id
  returning * into updated_user;
  if updated_user.id is null then raise exception 'Usuário não encontrado.'; end if;
  return updated_user;
end;
$$;

create or replace function public.set_event_share(target_event_id uuid, enabled boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  token text;
begin
  if not private.can_manage_event(target_event_id) then
    raise exception 'Sem permissão para compartilhar este evento.';
  end if;
  if enabled then
    update public.events
      set share_token = coalesce(share_token, pg_catalog.gen_random_uuid()::text)
      where id = target_event_id
      returning share_token into token;
  else
    update public.events set share_token = null where id = target_event_id;
    token := null;
  end if;
  return token;
end;
$$;

revoke all on function public.admin_update_user(uuid, public.user_role, boolean) from public, anon;
grant execute on function public.admin_update_user(uuid, public.user_role, boolean) to authenticated;
revoke all on function public.set_event_share(uuid, boolean) from public, anon;
grant execute on function public.set_event_share(uuid, boolean) to authenticated;

drop policy if exists "Users can view all users" on public.users;
drop policy if exists "Users can update own profile" on public.users;
drop policy if exists "Admins can update any user" on public.users;
drop policy if exists "Anyone can view users of shared events" on public.users;
create policy "Authenticated users can view directory" on public.users
  for select to authenticated using (true);
create policy "Users can update own profile fields" on public.users
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists "Authenticated users can view events" on public.events;
drop policy if exists "Authenticated users can create events" on public.events;
drop policy if exists "Authenticated users can update events" on public.events;
drop policy if exists "Creators and admins can update events" on public.events;
drop policy if exists "Creators and admins can delete events" on public.events;
drop policy if exists "Anyone can view shared events by token" on public.events;
create policy "Members can view events" on public.events
  for select to authenticated using (private.can_view_event(id));
create policy "Users can create owned events" on public.events
  for insert to authenticated with check (created_by = (select auth.uid()));
create policy "Editors can update events" on public.events
  for update to authenticated
  using (private.can_edit_event(id))
  with check (private.can_edit_event(id));
create policy "Owners can delete events" on public.events
  for delete to authenticated using (private.can_manage_event(id));

drop policy if exists "Members can view collaborators" on public.event_collaborators;
drop policy if exists "Owners can add collaborators" on public.event_collaborators;
drop policy if exists "Owners can update collaborators" on public.event_collaborators;
drop policy if exists "Owners can remove collaborators" on public.event_collaborators;
create policy "Members can view collaborators" on public.event_collaborators
  for select to authenticated using (private.can_view_event(event_id));
create policy "Owners can add collaborators" on public.event_collaborators
  for insert to authenticated with check (private.can_manage_event(event_id));
create policy "Owners can update collaborators" on public.event_collaborators
  for update to authenticated using (private.can_manage_event(event_id)) with check (private.can_manage_event(event_id));
create policy "Owners can remove collaborators" on public.event_collaborators
  for delete to authenticated using (private.can_manage_event(event_id));

drop policy if exists "Authenticated users can view files" on public.event_files;
drop policy if exists "Authenticated users can upload files" on public.event_files;
drop policy if exists "Uploaders and admins can delete files" on public.event_files;
drop policy if exists "Anyone can view files of shared events" on public.event_files;
create policy "Members can view files" on public.event_files for select to authenticated using (private.can_view_event(event_id));
create policy "Editors can add files" on public.event_files for insert to authenticated with check (private.can_edit_event(event_id));
create policy "Editors can update files" on public.event_files for update to authenticated using (private.can_edit_event(event_id)) with check (private.can_edit_event(event_id));
create policy "Editors can delete files" on public.event_files for delete to authenticated using (private.can_edit_event(event_id));

drop policy if exists "Authenticated users can view attendance" on public.attendance;
drop policy if exists "Authenticated users can manage attendance" on public.attendance;
drop policy if exists "Anyone can view attendance of shared events" on public.attendance;
create policy "Members can view attendance" on public.attendance for select to authenticated using (private.can_view_event(event_id));
create policy "Editors can add attendance" on public.attendance for insert to authenticated with check (private.can_edit_event(event_id));
create policy "Editors can update attendance" on public.attendance for update to authenticated using (private.can_edit_event(event_id)) with check (private.can_edit_event(event_id));
create policy "Editors can delete attendance" on public.attendance for delete to authenticated using (private.can_edit_event(event_id));

drop policy if exists "Authenticated users can view notes" on public.event_notes;
drop policy if exists "Authenticated users can create notes" on public.event_notes;
drop policy if exists "Authors and admins can update notes" on public.event_notes;
drop policy if exists "Authors and admins can delete notes" on public.event_notes;
drop policy if exists "Anyone can view notes of shared events" on public.event_notes;
create policy "Members can view notes" on public.event_notes for select to authenticated using (private.can_view_event(event_id));
create policy "Editors can add notes" on public.event_notes for insert to authenticated with check (private.can_edit_event(event_id));
create policy "Editors can update notes" on public.event_notes for update to authenticated using (private.can_edit_event(event_id)) with check (private.can_edit_event(event_id));
create policy "Editors can delete notes" on public.event_notes for delete to authenticated using (private.can_edit_event(event_id));

drop policy if exists "Authenticated users can view reports" on public.event_reports;
drop policy if exists "Authenticated users can create reports" on public.event_reports;
drop policy if exists "Authors and admins can update reports" on public.event_reports;
drop policy if exists "Authors and admins can delete reports" on public.event_reports;
drop policy if exists "Anyone can view reports of shared events" on public.event_reports;
create policy "Members can view reports" on public.event_reports for select to authenticated using (private.can_view_event(event_id));
create policy "Editors can add reports" on public.event_reports for insert to authenticated with check (private.can_edit_event(event_id));
create policy "Editors can update reports" on public.event_reports for update to authenticated using (private.can_edit_event(event_id)) with check (private.can_edit_event(event_id));
create policy "Editors can delete reports" on public.event_reports for delete to authenticated using (private.can_edit_event(event_id));

update storage.buckets set public = false where id in ('photos', 'documents');

drop policy if exists "Authenticated users can upload photos" on storage.objects;
drop policy if exists "Anyone can view photos" on storage.objects;
drop policy if exists "Uploaders can delete their photos" on storage.objects;
drop policy if exists "Authenticated users can upload documents" on storage.objects;
drop policy if exists "Authenticated users can view documents" on storage.objects;
drop policy if exists "Uploaders can delete their documents" on storage.objects;
create policy "Members can read event files" on storage.objects
  for select to authenticated
  using (bucket_id in ('photos', 'documents') and private.can_view_event(private.storage_event_id(name)));
create policy "Editors can upload event files" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('photos', 'documents') and private.can_edit_event(private.storage_event_id(name)));
create policy "Editors can update event files" on storage.objects
  for update to authenticated
  using (bucket_id in ('photos', 'documents') and private.can_edit_event(private.storage_event_id(name)))
  with check (bucket_id in ('photos', 'documents') and private.can_edit_event(private.storage_event_id(name)));
create policy "Editors can delete event files" on storage.objects
  for delete to authenticated
  using (bucket_id in ('photos', 'documents') and private.can_edit_event(private.storage_event_id(name)));

revoke update on public.events from authenticated;
grant update(title, type, status, start_at, end_at, location, audience, description, tags, schools, updated_at) on public.events to authenticated;
revoke update on public.users from authenticated;
grant update(name) on public.users to authenticated;

commit;
