-- Execute before and after the staged migrations and retain both result sets.
select 'users' as entity, count(*) as total from public.users
union all select 'events', count(*) from public.events
union all select 'event_files', count(*) from public.event_files
union all select 'attendance', count(*) from public.attendance
union all select 'event_notes', count(*) from public.event_notes
union all select 'event_reports', count(*) from public.event_reports;

select 'files_without_event' as check_name, count(*) as total
from public.event_files f left join public.events e on e.id = f.event_id where e.id is null
union all
select 'attendance_without_event', count(*)
from public.attendance a left join public.events e on e.id = a.event_id where e.id is null
union all
select 'notes_without_event', count(*)
from public.event_notes n left join public.events e on e.id = n.event_id where e.id is null
union all
select 'reports_without_event', count(*)
from public.event_reports r left join public.events e on e.id = r.event_id where e.id is null;

select count(*) as missing_legacy_editor_memberships
from public.events e
cross join public.users u
left join public.event_collaborators c on c.event_id = e.id and c.user_id = u.id
where u.is_active = true
  and u.id is distinct from e.created_by
  and c.user_id is null;

select count(*) as files_without_storage_path
from public.event_files
where storage_path is null or storage_path = '';

select id, name, public
from storage.buckets
where id in ('photos', 'documents')
order by id;
