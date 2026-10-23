-- LUKEN customer requests. Run AFTER marketing-clients.sql in Supabase SQL Editor.
begin;
create or replace function public.luken_marketing_access(p_write boolean default false)
returns boolean language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and (
 exists(select 1 from public.profiles p where p.user_id=auth.uid() and (p.is_owner is true or p.is_hq is true))
 or exists(select 1 from public.branch_members b where b.user_id=auth.uid() and b.branch_id='marketing' and (not p_write or b.role='manager')));
$$;
revoke all on function public.luken_marketing_access(boolean) from public,anon;
grant execute on function public.luken_marketing_access(boolean) to authenticated;

create table if not exists public.marketing_request_links (
 client_id uuid primary key references public.marketing_clients(id) on delete cascade,
 token text not null unique default (replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','')),
 enabled boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.marketing_request_links enable row level security;
revoke all on public.marketing_request_links from anon,authenticated;

create table if not exists public.marketing_requests (
 id uuid primary key default gen_random_uuid(),
 client_id uuid references public.marketing_clients(id) on delete set null,
 client_label text not null,
 submission_key uuid not null,
 content text not null check(char_length(content) between 1 and 5000),
 desired_date date,
 photos jsonb not null default '[]'::jsonb,
 status text not null default '접수' check(status in ('접수','처리 중','완료')),
 internal_note text not null default '' check(char_length(internal_note)<=5000),
 extra_cost boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 completed_at timestamptz,
 unique(client_id,submission_key)
);
create index if not exists marketing_requests_status_created_idx on public.marketing_requests(status,created_at desc);
alter table public.marketing_requests enable row level security;
revoke all on public.marketing_requests from anon,authenticated;
grant select on public.marketing_requests to authenticated;
drop policy if exists marketing_requests_read on public.marketing_requests;
create policy marketing_requests_read on public.marketing_requests for select to authenticated using(public.luken_marketing_access(false));

-- Only staff may issue, rotate, or revoke a customer's bearer link.
create or replace function public.luken_request_link(p_client_id uuid,p_action text default 'get')
returns jsonb language plpgsql security definer set search_path=public as $$
declare v public.marketing_request_links%rowtype;
begin
 if not public.luken_marketing_access(true) then raise exception '수정 권한이 없습니다.';end if;
 if p_action not in ('get','rotate','revoke') then raise exception '잘못된 작업입니다.';end if;
 if not exists(select 1 from public.marketing_clients where id=p_client_id and status<>'계약 종료') then raise exception '고객사 또는 계약 상태를 확인해 주세요.';end if;
 insert into public.marketing_request_links(client_id) values(p_client_id) on conflict(client_id) do nothing;
 select * into v from public.marketing_request_links where client_id=p_client_id for update;
 if p_action='rotate' then
  update public.marketing_request_links set token=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''),enabled=true,updated_at=clock_timestamp() where client_id=p_client_id returning * into v;
 elsif p_action='revoke' then
  update public.marketing_request_links set enabled=false,updated_at=clock_timestamp() where client_id=p_client_id returning * into v;
 end if;
 return jsonb_build_object('token',v.token,'enabled',v.enabled);
end;$$;
revoke all on function public.luken_request_link(uuid,text) from public,anon;
grant execute on function public.luken_request_link(uuid,text) to authenticated;

-- No public SELECT of customer tables: disclose only the name on a valid link.
create or replace function public.luken_request_context(p_token text)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare label text;
begin
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then return null;end if;
 select c.brand_name||' · '||c.branch_name into label from public.marketing_request_links l join public.marketing_clients c on c.id=l.client_id where l.token=p_token and l.enabled and c.status<>'계약 종료';
 if label is null then return null;end if;
 return jsonb_build_object('label',label);
end;$$;
revoke all on function public.luken_request_context(text) from public;
grant execute on function public.luken_request_context(text) to anon,authenticated;

-- All public submissions pass validation here. Serializes by link for rate limits
-- and an idempotency key prevents duplicates when a response is lost/retried.
create or replace function public.luken_submit_request(p_token text,p_submission_key uuid,p_content text,p_desired_date date default null,p_photos jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare link public.marketing_request_links%rowtype;v_id uuid;label text;photo jsonb;n integer;
begin
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception '사용할 수 없는 요청 링크입니다.';end if;
 select * into link from public.marketing_request_links where token=p_token and enabled for update;
 if link.client_id is null then raise exception '사용할 수 없는 요청 링크입니다.';end if;
 select brand_name||' · '||branch_name into label from public.marketing_clients where id=link.client_id and status<>'계약 종료';
 if label is null then raise exception '현재 요청을 접수할 수 없습니다. 카톡으로 문의해 주세요.';end if;
 if p_submission_key is null then raise exception '접수 번호가 없습니다. 페이지를 새로고침해 주세요.';end if;
 select id into v_id from public.marketing_requests where client_id=link.client_id and submission_key=p_submission_key;
 if v_id is not null then return jsonb_build_object('id',v_id,'duplicate',true);end if;
 if p_content is null or char_length(btrim(p_content)) not between 1 and 5000 then raise exception '요청 내용을 1~5,000자로 입력해 주세요.';end if;
 if p_desired_date is not null and p_desired_date<(now() at time zone 'Asia/Seoul')::date then raise exception '희망일은 오늘 이후로 선택해 주세요.';end if;
 if p_photos is null or jsonb_typeof(p_photos)<>'array' then raise exception '사진 형식이 올바르지 않습니다.';end if;
 if jsonb_array_length(p_photos)>3 or octet_length(p_photos::text)>3000000 then raise exception '사진은 최대 3장까지 첨부해 주세요.';end if;
 for photo in select value from jsonb_array_elements(p_photos) loop
  if jsonb_typeof(photo)<>'object' or photo->>'name' is null or char_length(photo->>'name') not between 1 and 120 or photo->>'data' is null or char_length(photo->>'data')>950000 or (photo->>'data') !~ '^data:image/jpeg;base64,/9j/[A-Za-z0-9+/]*={0,2}$' then raise exception '첨부 사진을 다시 선택해 주세요.';end if;
 end loop;
 select count(*) into n from public.marketing_requests where client_id=link.client_id and created_at>now()-interval '1 hour';
 if n>=10 then raise exception '접수가 많아 잠시 쉬고 있습니다. 급한 요청은 카톡으로 문의해 주세요.';end if;
 insert into public.marketing_requests(client_id,client_label,submission_key,content,desired_date,photos) values(link.client_id,label,p_submission_key,btrim(p_content),p_desired_date,p_photos) returning id into v_id;
 return jsonb_build_object('id',v_id,'duplicate',false);
end;$$;
revoke all on function public.luken_submit_request(text,uuid,text,date,jsonb) from public;
grant execute on function public.luken_submit_request(text,uuid,text,date,jsonb) to anon,authenticated;

create or replace function public.luken_update_request(p_id uuid,p_version timestamptz,p_status text,p_note text,p_extra_cost boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v public.marketing_requests%rowtype;
begin
 if not public.luken_marketing_access(true) then raise exception '수정 권한이 없습니다.';end if;
 if p_status is null or p_status not in ('접수','처리 중','완료') or p_note is null or char_length(p_note)>5000 or p_extra_cost is null then raise exception '입력 내용을 확인해 주세요.';end if;
 update public.marketing_requests set status=p_status,internal_note=p_note,extra_cost=p_extra_cost,updated_at=clock_timestamp(),completed_at=case when p_status='완료' then coalesce(completed_at,now()) else null end where id=p_id and updated_at=p_version returning * into v;
 if v.id is null then raise exception '다른 화면에서 변경된 요청입니다. 닫고 새로고침해 주세요.';end if;
 return jsonb_build_object('id',v.id);
end;$$;
revoke all on function public.luken_update_request(uuid,timestamptz,text,text,boolean) from public,anon;
grant execute on function public.luken_update_request(uuid,timestamptz,text,text,boolean) to authenticated;
commit;
