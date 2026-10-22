-- Run once in the LUKEN Supabase SQL Editor.
-- Uses the same owner / HQ flags as the workspace. No branch manager access.
begin;
create table if not exists public.executive_events (
 id uuid primary key default gen_random_uuid(),
 title text not null check (char_length(title) between 1 and 160),
 assignee text not null default 'shared' check (assignee in ('owner','head','shared')),
 start_date date not null,
 end_date date not null,
 all_day boolean not null default true,
 start_time time,
 end_time time,
 location text not null default '' check (char_length(location)<=300),
 memo text not null default '' check (char_length(memo)<=5000),
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (end_date>=start_date),
 check (all_day or (start_time is not null and end_time is not null)),
 check (all_day or end_date>start_date or end_time>start_time)
);
create index if not exists executive_events_dates_idx on public.executive_events(start_date,end_date);
alter table public.executive_events enable row level security;
revoke all on public.executive_events from anon, authenticated;
grant select,insert,update,delete on public.executive_events to authenticated;
drop policy if exists executive_events_read on public.executive_events;
create policy executive_events_read on public.executive_events for select to authenticated
using (exists(select 1 from public.profiles p where p.user_id=auth.uid() and (p.is_owner is true or p.is_hq is true)));
drop policy if exists executive_events_insert on public.executive_events;
create policy executive_events_insert on public.executive_events for insert to authenticated
with check (created_by=auth.uid() and exists(select 1 from public.profiles p where p.user_id=auth.uid() and (p.is_owner is true or p.is_hq is true)));
drop policy if exists executive_events_update on public.executive_events;
create policy executive_events_update on public.executive_events for update to authenticated
using (exists(select 1 from public.profiles p where p.user_id=auth.uid() and (p.is_owner is true or p.is_hq is true)))
with check (exists(select 1 from public.profiles p where p.user_id=auth.uid() and (p.is_owner is true or p.is_hq is true)));
drop policy if exists executive_events_delete on public.executive_events;
create policy executive_events_delete on public.executive_events for delete to authenticated
using (exists(select 1 from public.profiles p where p.user_id=auth.uid() and (p.is_owner is true or p.is_hq is true)));
create or replace function public.touch_executive_event() returns trigger
language plpgsql set search_path=public as $$
begin
 new.created_by=old.created_by;
 new.created_at=old.created_at;
 new.updated_at=clock_timestamp();
 return new;
end;
$$;
drop trigger if exists executive_events_updated on public.executive_events;
create trigger executive_events_updated before update on public.executive_events
for each row execute function public.touch_executive_event();
commit;
