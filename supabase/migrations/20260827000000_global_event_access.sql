begin;

-- A biblioteca do SIEDU pertence à equipe: toda conta ativa pode consultar e
-- editar todos os eventos, inclusive arquivos, frequência, observações e relatórios.
-- A propriedade do evento ainda é usada para exclusão e gestão de compartilhamento.
create or replace function private.can_view_event(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_event_id is not null
    and exists (
      select 1
      from public.users
      where id = (select auth.uid())
        and is_active = true
    );
$$;

create or replace function private.can_edit_event(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_event_id is not null
    and exists (
      select 1
      from public.users
      where id = (select auth.uid())
        and is_active = true
    );
$$;

grant execute on function private.can_view_event(uuid) to authenticated;
grant execute on function private.can_edit_event(uuid) to authenticated;

commit;
