-- Run in Supabase SQL Editor. Replaces the existing admin-only Clear Chat RPC.
-- The WHERE condition is intentional; it deletes all messages.
create or replace function public.gcg_clear_chat()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.gcg_is_admin() then
    raise exception 'Admin permission required';
  end if;

  delete from public.gcg_chat_messages where true;
end;
$$;

revoke all on function public.gcg_clear_chat() from public, anon;
grant execute on function public.gcg_clear_chat() to authenticated;
