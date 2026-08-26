begin;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

alter table public.events add column if not exists client_request_id uuid;
create unique index if not exists events_creator_request_id_uidx
  on public.events(created_by, client_request_id)
  where client_request_id is not null;

alter table public.event_files add column if not exists storage_path text;
update public.event_files
set storage_path = split_part(
  case
    when kind = 'PHOTO' then split_part(url, '/photos/', 2)
    else split_part(url, '/documents/', 2)
  end,
  '?',
  1
)
where storage_path is null
  and (
    (kind = 'PHOTO' and url like '%/photos/%')
    or (kind = 'DOC' and url like '%/documents/%')
  );

create table if not exists public.event_collaborators (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'EDITOR' check (role in ('EDITOR', 'VIEWER')),
  invited_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (event_id, user_id)
);

alter table public.event_collaborators enable row level security;
create index if not exists event_collaborators_user_id_idx
  on public.event_collaborators(user_id, event_id);
create index if not exists events_created_by_start_at_idx
  on public.events(created_by, start_at desc);
create index if not exists event_files_event_kind_scope_created_idx
  on public.event_files(event_id, kind, scope, created_at desc);
create index if not exists attendance_event_name_idx
  on public.attendance(event_id, person_name);
create index if not exists event_notes_event_created_idx
  on public.event_notes(event_id, created_at desc);

insert into public.event_collaborators(event_id, user_id, role, invited_by)
select e.id, u.id, 'EDITOR', e.created_by
from public.events e
cross join public.users u
where u.is_active = true
  and u.id is distinct from e.created_by
on conflict (event_id, user_id) do nothing;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.users
    where id = (select auth.uid())
      and role = 'ADMIN'
      and is_active = true
  );
$$;

create or replace function private.can_view_event(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin()
    or exists (
      select 1 from public.events e
      where e.id = target_event_id
        and e.created_by = (select auth.uid())
    )
    or exists (
      select 1 from public.event_collaborators c
      where c.event_id = target_event_id
        and c.user_id = (select auth.uid())
    );
$$;

create or replace function private.can_edit_event(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin()
    or exists (
      select 1 from public.events e
      where e.id = target_event_id
        and e.created_by = (select auth.uid())
    )
    or exists (
      select 1 from public.event_collaborators c
      where c.event_id = target_event_id
        and c.user_id = (select auth.uid())
        and c.role = 'EDITOR'
    );
$$;

create or replace function private.can_manage_event(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin()
    or exists (
      select 1 from public.events e
      where e.id = target_event_id
        and e.created_by = (select auth.uid())
    );
$$;

create or replace function private.storage_event_id(object_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return split_part(object_name, '/', 1)::uuid;
exception when others then
  return null;
end;
$$;

grant execute on function private.is_admin() to authenticated;
grant execute on function private.can_view_event(uuid) to authenticated;
grant execute on function private.can_edit_event(uuid) to authenticated;
grant execute on function private.can_manage_event(uuid) to authenticated;
grant execute on function private.storage_event_id(text) to authenticated;

create or replace function private.protect_event_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is distinct from old.created_by and not private.is_admin() then
    raise exception 'O proprietário do evento não pode ser alterado.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_event_owner on public.events;
create trigger protect_event_owner
before update of created_by on public.events
for each row execute function private.protect_event_owner();

create or replace function private.prevent_last_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'ADMIN'
     and old.is_active = true
     and (new.role <> 'ADMIN' or new.is_active = false)
     and (select count(*) from public.users where role = 'ADMIN' and is_active = true) <= 1 then
    raise exception 'Mantenha pelo menos um administrador ativo.';
  end if;
  if old.id = (select auth.uid()) and old.is_active = true and new.is_active = false then
    raise exception 'Você não pode desativar a própria conta.';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_last_admin on public.users;
create trigger prevent_last_admin
before update of role, is_active on public.users
for each row execute function private.prevent_last_admin();

commit;
