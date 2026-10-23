-- Run once in the existing LUKEN Supabase SQL Editor.
begin;
create table if not exists public.marketing_clients (
 id uuid primary key default gen_random_uuid(),
 brand_name text not null check(char_length(brand_name) between 1 and 120),
 branch_name text not null check(char_length(branch_name) between 1 and 120),
 contact_name text not null default '' check(char_length(contact_name)<=120),
 phone text not null default '' check(char_length(phone)<=60),
 email text not null default '' check(char_length(email)<=254),
 address text not null default '' check(char_length(address)<=500),
 service text not null default '' check(char_length(service)<=500),
 status text not null default '진행 중' check(status in ('상담 중','진행 중','보류','계약 종료')),
 contract_start date,
 contract_end date,
 memo text not null default '' check(char_length(memo)<=5000),
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(contract_end is null or contract_start is null or contract_end>=contract_start)
);
create unique index if not exists marketing_clients_brand_branch_unique on public.marketing_clients(lower(btrim(brand_name)),lower(btrim(branch_name)));
alter table public.marketing_clients enable row level security;
revoke all on public.marketing_clients from anon,authenticated;
grant select,insert,update,delete on public.marketing_clients to authenticated;
drop policy if exists marketing_clients_read on public.marketing_clients;
create policy marketing_clients_read on public.marketing_clients for select to authenticated using (
 exists(select 1 from public.profiles p where p.user_id=auth.uid() and (p.is_owner is true or p.is_hq is true))
 or exists(select 1 from public.branch_members b where b.user_id=auth.uid() and b.branch_id='marketing')
);
drop policy if exists marketing_clients_insert on public.marketing_clients;
create policy marketing_clients_insert on public.marketing_clients for insert to authenticated with check (
 created_by=auth.uid() and (exists(select 1 from public.profiles p where p.user_id=auth.uid() and (p.is_owner is true or p.is_hq is true))
 or exists(select 1 from public.branch_members b where b.user_id=auth.uid() and b.branch_id='marketing' and b.role='manager'))
);
drop policy if exists marketing_clients_update on public.marketing_clients;
create policy marketing_clients_update on public.marketing_clients for update to authenticated using (
 exists(select 1 from public.profiles p where p.user_id=auth.uid() and (p.is_owner is true or p.is_hq is true))
 or exists(select 1 from public.branch_members b where b.user_id=auth.uid() and b.branch_id='marketing' and b.role='manager')
) with check (
 exists(select 1 from public.profiles p where p.user_id=auth.uid() and (p.is_owner is true or p.is_hq is true))
 or exists(select 1 from public.branch_members b where b.user_id=auth.uid() and b.branch_id='marketing' and b.role='manager')
);
drop policy if exists marketing_clients_delete on public.marketing_clients;
create policy marketing_clients_delete on public.marketing_clients for delete to authenticated using (
 exists(select 1 from public.profiles p where p.user_id=auth.uid() and (p.is_owner is true or p.is_hq is true))
 or exists(select 1 from public.branch_members b where b.user_id=auth.uid() and b.branch_id='marketing' and b.role='manager')
);
create or replace function public.touch_marketing_client() returns trigger language plpgsql set search_path=public as $$
begin
 new.created_by=old.created_by;new.created_at=old.created_at;new.updated_at=clock_timestamp();return new;
end;$$;
drop trigger if exists marketing_clients_updated on public.marketing_clients;
create trigger marketing_clients_updated before update on public.marketing_clients for each row execute function public.touch_marketing_client();
commit;
