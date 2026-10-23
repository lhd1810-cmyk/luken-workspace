-- Run after marketing-clients.sql and marketing-requests.sql in Supabase.
begin;
create table if not exists public.marketing_reports (
 id uuid primary key default gen_random_uuid(),
 client_id uuid not null references public.marketing_clients(id) on delete restrict,
 report_month date not null check(extract(day from report_month)=1),
 report_data jsonb not null default '{}'::jsonb,
 public_snapshot jsonb,
 share_token text not null unique default (replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','')),
 share_enabled boolean not null default false,
 published_at timestamptz,
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(client_id,report_month)
);
alter table public.marketing_reports enable row level security;
revoke all on public.marketing_reports from public,anon,authenticated;
grant select on public.marketing_reports to authenticated;
drop policy if exists marketing_reports_read on public.marketing_reports;
create policy marketing_reports_read on public.marketing_reports for select to authenticated using(public.luken_marketing_access(false));

-- Keep only customer-facing fields. No mission descriptions or internal notes.
create or replace function public.luken_clean_report(p_data jsonb)
returns jsonb language plpgsql immutable set search_path=public as $$
declare v jsonb;pair jsonb;metric text;side text;entry jsonb;num numeric;metrics jsonb:='{}';keywords jsonb:='[]';works jsonb:='[]';t text;u text;
begin
 if p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>200000 then raise exception '리포트 내용이 너무 크거나 형식이 잘못되었습니다.';end if;
 foreach t in array array['summary','analysis','next_plan','rank_basis'] loop
  if p_data?t and jsonb_typeof(p_data->t)<>'string' then raise exception '설명은 텍스트로 입력해 주세요.';end if;
  if char_length(coalesce(p_data->>t,''))>5000 then raise exception '설명은 항목당 5,000자 이내로 입력해 주세요.';end if;
 end loop;
 v:=coalesce(p_data->'metrics','{}'::jsonb);if jsonb_typeof(v)<>'object' then raise exception '지표 형식을 확인해 주세요.';end if;
 foreach metric in array array['views','calls','directions','reservations','orders','reviews','spend','impressions','clicks'] loop
  pair:='{}';
  foreach side in array array['current','previous'] loop
   entry:=v->metric->side;
   if entry is null or entry='null'::jsonb then pair:=pair||jsonb_build_object(side,null);
   else
    if jsonb_typeof(entry)<>'number' then raise exception '지표는 숫자로 입력해 주세요.';end if;
    num:=(entry::text)::numeric;
    if num<0 or num>1000000000000 or (metric<>'spend' and num<>trunc(num)) then raise exception '지표는 0 이상의 유효한 숫자로 입력해 주세요.';end if;
    pair:=pair||jsonb_build_object(side,num);
   end if;
  end loop;
  metrics:=metrics||jsonb_build_object(metric,pair);
 end loop;
 v:=coalesce(p_data->'keywords','[]'::jsonb);
 if jsonb_typeof(v)<>'array' then raise exception '키워드 형식을 확인해 주세요.';end if;
 if jsonb_array_length(v)>20 then raise exception '키워드는 최대 20개입니다.';end if;
 for entry in select value from jsonb_array_elements(v) loop
  if jsonb_typeof(entry)<>'object' or jsonb_typeof(entry->'keyword')<>'string' or char_length(btrim(coalesce(entry->>'keyword',''))) not between 1 and 100 then raise exception '키워드명을 확인해 주세요.';end if;
  pair:=jsonb_build_object('keyword',btrim(entry->>'keyword'));
  foreach side in array array['start_rank','current_rank'] loop
   if entry->side is null or entry->side='null'::jsonb then pair:=pair||jsonb_build_object(side,null);
   else
    if jsonb_typeof(entry->side)<>'number' then raise exception '순위는 숫자로 입력해 주세요.';end if;
    num:=(entry->>side)::numeric;
    if num<1 or num>1000 or num<>trunc(num) then raise exception '순위는 1~1,000의 정수로 입력해 주세요. 미확인은 빈칸으로 두세요.';end if;
    pair:=pair||jsonb_build_object(side,num);
   end if;
  end loop;
  keywords:=keywords||jsonb_build_array(pair);
 end loop;
 v:=coalesce(p_data->'work_items','[]'::jsonb);
 if jsonb_typeof(v)<>'array' then raise exception '업무 형식을 확인해 주세요.';end if;
 if jsonb_array_length(v)>50 then raise exception '업무는 최대 50개입니다.';end if;
 for entry in select value from jsonb_array_elements(v) loop
  t:=btrim(coalesce(entry->>'title',''));u:=btrim(coalesce(entry->>'url',''));
  if jsonb_typeof(entry)<>'object' or jsonb_typeof(entry->'title')<>'string' or char_length(t) not between 1 and 300 or char_length(u)>2000 then raise exception '업무 제목과 증빙 링크를 확인해 주세요.';end if;
  if u<>'' and u !~* '^https?://[^[:space:]<>]+$' then raise exception '증빙 링크는 http 또는 https 주소로 입력해 주세요.';end if;
  works:=works||jsonb_build_array(jsonb_build_object('title',t,'url',u));
 end loop;
 return jsonb_build_object('summary',coalesce(p_data->>'summary',''),'analysis',coalesce(p_data->>'analysis',''),'next_plan',coalesce(p_data->>'next_plan',''),'rank_basis',coalesce(p_data->>'rank_basis',''),'metrics',metrics,'keywords',keywords,'work_items',works);
end;$$;
revoke all on function public.luken_clean_report(jsonb) from public,anon,authenticated;

create or replace function public.luken_save_report(p_id uuid,p_version timestamptz,p_client_id uuid,p_month date,p_data jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare cleaned jsonb;v public.marketing_reports%rowtype;
begin
 if not public.luken_marketing_access(true) then raise exception '리포트 수정 권한이 없습니다.';end if;
 if p_month is null or extract(day from p_month)<>1 or p_month<'2000-01-01' or p_month>'2100-12-01' then raise exception '보고 월을 확인해 주세요.';end if;
 if not exists(select 1 from public.marketing_clients where id=p_client_id) then raise exception '고객사를 찾을 수 없습니다.';end if;
 cleaned:=public.luken_clean_report(p_data);
 if p_id is null then
  insert into public.marketing_reports(client_id,report_month,report_data) values(p_client_id,p_month,cleaned) returning * into v;
 else
  update public.marketing_reports set report_data=cleaned,updated_at=clock_timestamp() where id=p_id and client_id=p_client_id and report_month=p_month and updated_at=p_version returning * into v;
  if v.id is null then raise exception '다른 화면에서 변경된 리포트입니다. 닫고 다시 불러와 주세요.';end if;
 end if;
 return jsonb_build_object('id',v.id);
end;$$;
revoke all on function public.luken_save_report(uuid,timestamptz,uuid,date,jsonb) from public,anon;
grant execute on function public.luken_save_report(uuid,timestamptz,uuid,date,jsonb) to authenticated;

-- Saving a draft NEVER changes the shared report. Explicit publication required.
create or replace function public.luken_publish_report(p_id uuid,p_version timestamptz,p_action text default 'publish')
returns jsonb language plpgsql security definer set search_path=public as $$
declare v public.marketing_reports%rowtype;label text;
begin
 if not public.luken_marketing_access(true) then raise exception '리포트 공유 권한이 없습니다.';end if;
 if p_action is null or p_action not in ('publish','rotate','revoke') then raise exception '잘못된 작업입니다.';end if;
 select * into v from public.marketing_reports where id=p_id for update;
 if v.id is null or v.updated_at is distinct from p_version then raise exception '리포트가 변경되었습니다. 다시 불러와 주세요.';end if;
 if p_action='publish' then
  select brand_name||' · '||branch_name into label from public.marketing_clients where id=v.client_id;
  update public.marketing_reports set public_snapshot=jsonb_build_object('client_label',label,'month',v.report_month,'data',public.luken_clean_report(v.report_data)),share_enabled=true,published_at=clock_timestamp(),updated_at=clock_timestamp() where id=p_id returning * into v;
 elsif p_action='rotate' then
  if v.public_snapshot is null then raise exception '먼저 리포트를 고객용으로 공개해 주세요.';end if;
  update public.marketing_reports set share_token=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''),share_enabled=true,updated_at=clock_timestamp() where id=p_id returning * into v;
 else
  update public.marketing_reports set share_enabled=false,updated_at=clock_timestamp() where id=p_id returning * into v;
 end if;
 return jsonb_build_object('id',v.id,'token',v.share_token,'enabled',v.share_enabled);
end;$$;
revoke all on function public.luken_publish_report(uuid,timestamptz,text) from public,anon;
grant execute on function public.luken_publish_report(uuid,timestamptz,text) to authenticated;

create or replace function public.luken_public_report(p_token text)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then return null;end if;
 select public_snapshot||jsonb_build_object('published_at',published_at) into result from public.marketing_reports where share_token=p_token and share_enabled and public_snapshot is not null;
 return result;
end;$$;
revoke all on function public.luken_public_report(text) from public;
grant execute on function public.luken_public_report(text) to anon,authenticated;
commit;
