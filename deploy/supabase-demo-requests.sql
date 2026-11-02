-- Demo requests from the cerebel.tech "Request a Demo" form, kept beside the presale backers in the
-- `cerebel-site` Supabase project (ref zmwcglopxlsbewvegoyw) so a Playground outage cannot lose one.
-- Same pattern as public.backers: the browser calls one function with the publishable key; the table
-- itself is never readable with it. Run once in the SQL editor (or `psql`) as the project owner.
create table if not exists public.demo_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text not null default '',
  organization text not null default '',
  interest text not null default '',
  message text not null default '',
  path text not null default '/',
  ref text not null default '',
  utm_source text not null default '',
  utm_campaign text not null default '',
  country text not null default '',
  visitor text not null default '',
  status text not null default 'new',
  created_at timestamptz not null default now()
);
create index if not exists demo_requests_created_at_idx on public.demo_requests (created_at desc);
alter table public.demo_requests enable row level security;
revoke all on public.demo_requests from anon, authenticated;

create or replace function public.submit_demo_request(p jsonb)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_email text := lower(trim(coalesce(p->>'email', '')));
  v_name text := left(trim(coalesce(p->>'name', '')), 120);
  v_org text := left(trim(coalesce(p->>'organization', '')), 160);
  v_interest text := left(trim(coalesce(p->>'interest', '')), 80);
  v_message text := left(trim(coalesce(p->>'message', '')), 4000);
  v_headers jsonb := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  v_ref text := '';
  v_recent integer;
begin
  if v_name = '' or v_email = '' or v_org = '' or v_interest = '' or v_message = '' then
    raise exception 'Name, work email, organization, area of interest, and message are all required.' using errcode = '22023';
  end if;
  if length(v_email) > 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Please enter a valid work email.' using errcode = '22023';
  end if;
  -- This route is public and the caller's IP is not stored, so the limit is a global one.
  select count(*) into v_recent from public.demo_requests where created_at > now() - interval '1 minute';
  if v_recent >= 30 or (select count(*) from public.demo_requests) >= 20000 then
    raise exception 'Please try again later.' using errcode = '53400';
  end if;
  -- Keep only the referring site's hostname, never its full address.
  v_ref := coalesce(substring(coalesce(p->>'referrer', '') from '^[a-zA-Z]+://([^/:?#]+)'), '');
  if lower(v_ref) in ('cerebel.tech', 'www.cerebel.tech') then
    v_ref := '';
  end if;
  insert into public.demo_requests (email, name, organization, interest, message, path, ref, utm_source, utm_campaign, country, visitor)
  values (
    v_email, v_name, v_org, v_interest, v_message,
    coalesce(nullif(left(split_part(split_part(coalesce(p->>'path', ''), '?', 1), '#', 1), 120), ''), '/'),
    left(lower(v_ref), 80),
    left(coalesce(p->>'utmSource', ''), 60),
    left(coalesce(p->>'utmCampaign', ''), 80),
    case when coalesce(v_headers->>'cf-ipcountry', '') ~ '^[A-Z]{2}$' and v_headers->>'cf-ipcountry' <> 'XX'
         then v_headers->>'cf-ipcountry' else '' end,
    case when coalesce(p->>'visitor', '') ~ '^[A-Za-z0-9-]{6,64}$' then p->>'visitor' else '' end
  );
end;
$function$;

create or replace function public.admin_list_demo_requests(token text)
returns setof public.demo_requests
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if not private.admin_token_ok(token) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query select * from public.demo_requests order by created_at desc;
end;
$function$;

create or replace function public.admin_set_demo_request_status(token text, request_id uuid, new_status text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not private.admin_token_ok(token) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if new_status not in ('new', 'contacted', 'qualified', 'closed') then
    raise exception 'Invalid status.' using errcode = '22023';
  end if;
  update public.demo_requests set status = new_status where id = request_id;
end;
$function$;

grant execute on function public.submit_demo_request(jsonb) to anon, authenticated;
grant execute on function public.admin_list_demo_requests(text) to anon, authenticated;
grant execute on function public.admin_set_demo_request_status(text, uuid, text) to anon, authenticated;
