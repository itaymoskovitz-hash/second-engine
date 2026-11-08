-- Applied to project qapppwgruymsnsxfvlda on 2026-11-08 (migration "reminders").
-- Daily workout reminders through Web Push.
--   push_subs: one row per browser that turned reminders on. The app keeps `days` (date -> workout title,
--   next 14 days, in the user's language) fresh, because calendar plans live only in the browser.
--   The edge function send-reminders runs hourly (pg_cron + pg_net) and sends today's workout at the user's hour.
--   VAPID keys and the cron secret live in Vault; reminders_config() hands them to the function (service_role only).
--   Nothing secret is in this file.

create table public.push_subs (
  endpoint   text primary key check (char_length(endpoint) between 10 and 1000),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  p256dh     text not null check (char_length(p256dh) < 200),
  auth       text not null check (char_length(auth) < 100),
  tz         text not null default 'Asia/Jerusalem' check (char_length(tz) < 64),
  hour       smallint not null default 7 check (hour between 0 and 23),
  lang       text not null default 'he' check (lang in ('he', 'en')),
  days       jsonb not null default '{}'::jsonb check (pg_column_size(days) < 20000),
  last_sent  date,
  updated_at timestamptz not null default now()
);
create index push_subs_user_idx on public.push_subs (user_id);
alter table public.push_subs enable row level security;

create policy "own read"   on public.push_subs for select to authenticated using ((select auth.uid()) = user_id);
create policy "own insert" on public.push_subs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own update" on public.push_subs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own delete" on public.push_subs for delete to authenticated using ((select auth.uid()) = user_id);
create policy "mfa if enrolled" on public.push_subs as restrictive for all to authenticated using (
  array[(select auth.jwt() ->> 'aal')] <@ (
    select case when count(f.id) > 0 then array['aal2'] else array['aal1', 'aal2'] end
    from auth.mfa_factors f where (select auth.uid()) = f.user_id and f.status = 'verified'));

create or replace function public.reminders_config()
returns jsonb language sql security definer set search_path = '' as $$
  select jsonb_object_agg(name, decrypted_secret) from vault.decrypted_secrets
  where name in ('vapid_public', 'vapid_private', 'reminders_cron_secret');
$$;
revoke all on function public.reminders_config() from public, anon, authenticated;
grant execute on function public.reminders_config() to service_role;

-- delete_my_account also removes reminder subscriptions (the FK cascades too; explicit for clarity)
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if exists (select 1 from auth.mfa_factors f where f.user_id = uid and f.status = 'verified')
     and coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'aal2 required' using errcode = '42501';
  end if;
  delete from public.push_subs where user_id = uid;
  delete from public.user_docs where user_id = uid;
  delete from public.ai_usage where user_id = uid;
  delete from auth.users where id = uid;
end; $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

create extension if not exists pg_net;
create extension if not exists pg_cron;
-- Applied as migration "reminders_keys": the send-reminders function generates the VAPID pair on first use and stores it.
create or replace function public.reminders_store_keys(pub text, priv text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from vault.secrets where name = 'vapid_private') then return; end if;
  perform vault.create_secret(pub, 'vapid_public');
  perform vault.create_secret(priv, 'vapid_private');
end; $$;
revoke all on function public.reminders_store_keys(text, text) from public, anon, authenticated;
grant execute on function public.reminders_store_keys(text, text) to service_role;

do $$ begin
  if not exists (select 1 from vault.secrets where name = 'reminders_cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'reminders_cron_secret');
  end if;
end $$;

-- Scheduled once with execute_sql (not a migration):
--   select cron.schedule('send-reminders', '5 * * * *', $$ select net.http_post(
--     url := 'https://qapppwgruymsnsxfvlda.supabase.co/functions/v1/send-reminders',
--     headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret',
--       (select decrypted_secret from vault.decrypted_secrets where name = 'reminders_cron_secret')),
--     body := '{}'::jsonb) $$);
