-- Applied to project qapppwgruymsnsxfvlda on 2026-11-08 (migration "delete_my_account").
-- Lets a signed-in user delete their own account and all their data (Profile -> delete account).
-- Same 2FA rule as the "mfa if enrolled" policy: a user with a verified TOTP factor must be at aal2.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if exists (select 1 from auth.mfa_factors f where f.user_id = uid and f.status = 'verified')
     and coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'aal2 required' using errcode = '42501';
  end if;
  delete from public.user_docs where user_id = uid;
  delete from public.ai_usage where user_id = uid;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
