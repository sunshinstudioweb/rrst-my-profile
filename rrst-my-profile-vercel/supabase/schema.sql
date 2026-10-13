-- RRST.FASHION / My Profile database schema
-- Run this in Supabase SQL Editor before enabling real accounts.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  username text unique,
  bio text not null default '' check (char_length(bio) <= 160),
  avatar_url text,
  privacy text not null default 'public' check (privacy in ('public','private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  unique (requester_id, recipient_id),
  check (requester_id <> recipient_id)
);

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, friend_id),
  check (user_id <> friend_id)
);

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.profiles enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.blocks enable row level security;

-- Public profiles can be discovered. Private profiles are visible only to their owner or accepted friends.
drop policy if exists "Profiles visible by privacy" on public.profiles;
create policy "Profiles visible by privacy" on public.profiles
for select to authenticated using (
  id = auth.uid()
  or privacy = 'public'
  or exists (
    select 1 from public.friendships f
    where f.user_id = auth.uid() and f.friend_id = profiles.id
  )
);

drop policy if exists "Members insert own profile" on public.profiles;
create policy "Members insert own profile" on public.profiles
for insert to authenticated with check (id = auth.uid());

drop policy if exists "Members update own profile" on public.profiles;
create policy "Members update own profile" on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "Requests visible to participants" on public.friend_requests;
create policy "Requests visible to participants" on public.friend_requests
for select to authenticated using (requester_id = auth.uid() or recipient_id = auth.uid());

drop policy if exists "Send own friend request" on public.friend_requests;
create policy "Send own friend request" on public.friend_requests
for insert to authenticated with check (requester_id = auth.uid() and recipient_id <> auth.uid());

drop policy if exists "Recipient responds or requester cancels" on public.friend_requests;
create policy "Recipient responds or requester cancels" on public.friend_requests
for update to authenticated using (recipient_id = auth.uid() or requester_id = auth.uid())
with check (
  (recipient_id = auth.uid() and status in ('accepted','declined','pending'))
  or (requester_id = auth.uid() and status = 'cancelled')
);

drop policy if exists "Friendships visible to members" on public.friendships;
create policy "Friendships visible to members" on public.friendships
for select to authenticated using (user_id = auth.uid() or friend_id = auth.uid());

drop policy if exists "Members add own friendship rows" on public.friendships;
create policy "Members add own friendship rows" on public.friendships
for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "Members remove own friendship rows" on public.friendships;
create policy "Members remove own friendship rows" on public.friendships
for delete to authenticated using (user_id = auth.uid());

drop policy if exists "Members view own blocks" on public.blocks;
create policy "Members view own blocks" on public.blocks
for select to authenticated using (blocker_id = auth.uid());

drop policy if exists "Members create own blocks" on public.blocks;
create policy "Members create own blocks" on public.blocks
for insert to authenticated with check (blocker_id = auth.uid());

drop policy if exists "Members remove own blocks" on public.blocks;
create policy "Members remove own blocks" on public.blocks
for delete to authenticated using (blocker_id = auth.uid());

create index if not exists friend_requests_recipient_status_idx on public.friend_requests(recipient_id, status);
create index if not exists friend_requests_requester_status_idx on public.friend_requests(requester_id, status);
create index if not exists friendships_user_idx on public.friendships(user_id);
create index if not exists friendships_friend_idx on public.friendships(friend_id);

-- Create profile rows automatically for new email/password signups.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    lower(regexp_replace(split_part(coalesce(new.email,'member'), '@', 1), '[^a-zA-Z0-9_]', '', 'g')) || '_' || substr(new.id::text, 1, 5)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();