-- Cloud save for Animal Draft. Run once in the Supabase SQL editor (project "animal-draft").
-- Also needed: Authentication > Sign In / Providers > "Allow anonymous sign-ins" ON.
-- Every phone signs in anonymously; its progress is one JSON row. Moving to a new phone uses a short one-time code.

create table if not exists public.saves (
  user_id    uuid primary key references auth.users on delete cascade,
  data       jsonb not null,
  rev        int not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.saves enable row level security;
drop policy if exists "read own save" on public.saves;
create policy "read own save" on public.saves for select to authenticated using (auth.uid() = user_id);
grant select on table public.saves to authenticated;   -- the read policy above needs this table permission too
-- No insert/update/delete policies: writes only go through the functions below.

create table if not exists public.transfers (
  code       text primary key,
  user_id    uuid not null references auth.users on delete cascade,
  expires_at timestamptz not null
);
alter table public.transfers enable row level security;   -- no policies: only the functions below use it

-- Saves the player's progress if p_rev is newer than what the server has. Returns the server's revision after the call.
create or replace function public.save_progress(p_data jsonb, p_rev int) returns int
language plpgsql security definer set search_path = public as $$
declare cur int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if octet_length(p_data::text) > 200000 then raise exception 'save too big'; end if;
  insert into saves(user_id, data, rev) values (auth.uid(), p_data, p_rev)
    on conflict (user_id) do update set data = excluded.data, rev = excluded.rev, updated_at = now()
    where saves.rev < excluded.rev;
  select rev into cur from saves where user_id = auth.uid();
  return cur;
end $$;

-- Makes a 6-letter code (valid 15 minutes) that lets another phone copy this player's progress.
create or replace function public.make_transfer_code() returns text
language plpgsql security definer set search_path = public as $$
declare c text; letters text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from saves where user_id = auth.uid()) then raise exception 'nothing saved yet'; end if;
  delete from transfers where user_id = auth.uid() or expires_at < now();
  loop
    c := (select string_agg(substr(letters, 1 + floor(random() * length(letters))::int, 1), '') from generate_series(1, 6));
    exit when not exists (select 1 from transfers where code = c);
  end loop;
  insert into transfers(code, user_id, expires_at) values (c, auth.uid(), now() + interval '15 minutes');
  return c;
end $$;

-- Copies the progress behind a code onto this phone's account (the code is used up). Returns {data, rev}.
create or replace function public.claim_transfer(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare src uuid; d jsonb; r int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from transfers where code = upper(p_code) and expires_at > now() returning user_id into src;
  if src is null then raise exception 'code not found or expired'; end if;
  if src = auth.uid() then raise exception 'same phone'; end if;
  select data into d from saves where user_id = src;
  select coalesce(max(rev), 0) + 1 into r from saves where user_id in (src, auth.uid());
  insert into saves(user_id, data, rev) values (auth.uid(), d, r)
    on conflict (user_id) do update set data = excluded.data, rev = excluded.rev, updated_at = now();
  return jsonb_build_object('data', d, 'rev', r);
end $$;

revoke all on function public.save_progress(jsonb, int), public.make_transfer_code(), public.claim_transfer(text) from public, anon;
grant execute on function public.save_progress(jsonb, int), public.make_transfer_code(), public.claim_transfer(text) to authenticated;
