create extension if not exists pgcrypto;

create table if not exists public.habit_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  daily_goal integer not null default 4 check (daily_goal between 1 and 48),
  set_duration_seconds integer not null default 60 check (set_duration_seconds between 10 and 600),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  target_sets integer not null default 4 check (target_sets between 1 and 48),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, log_date)
);

create table if not exists public.set_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  position integer not null check (position > 0),
  set_name text not null default '',
  day_part text not null default 'morning' check (day_part in ('morning', 'midday', 'night')),
  duration_seconds integer not null check (duration_seconds between 1 and 3600),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, log_date, position),
  foreign key (user_id, log_date)
    references public.daily_logs (user_id, log_date)
    on delete cascade
);

alter table public.habit_profiles
  drop constraint if exists habit_profiles_daily_goal_check,
  add constraint habit_profiles_daily_goal_check check (daily_goal between 1 and 48);

alter table public.daily_logs
  drop constraint if exists daily_logs_target_sets_check,
  add constraint daily_logs_target_sets_check check (target_sets between 1 and 48);

alter table public.set_entries
  add column if not exists set_name text not null default '',
  add column if not exists day_part text not null default 'morning';

alter table public.set_entries
  alter column completed_at drop not null,
  alter column completed_at drop default;

alter table public.set_entries
  drop constraint if exists set_entries_day_part_check,
  add constraint set_entries_day_part_check check (day_part in ('morning', 'midday', 'night'));

create index if not exists daily_logs_user_date_idx
  on public.daily_logs (user_id, log_date desc);

create index if not exists set_entries_user_date_idx
  on public.set_entries (user_id, log_date, position);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists habit_profiles_set_updated_at on public.habit_profiles;
create trigger habit_profiles_set_updated_at
before update on public.habit_profiles
for each row execute function public.set_updated_at();

drop trigger if exists daily_logs_set_updated_at on public.daily_logs;
create trigger daily_logs_set_updated_at
before update on public.daily_logs
for each row execute function public.set_updated_at();

alter table public.habit_profiles enable row level security;
alter table public.daily_logs enable row level security;
alter table public.set_entries enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.habit_profiles to authenticated;
grant select, insert, update, delete on public.daily_logs to authenticated;
grant select, insert, update, delete on public.set_entries to authenticated;

revoke execute on function public.set_updated_at() from public;

drop policy if exists "Users can read their habit profile" on public.habit_profiles;
create policy "Users can read their habit profile"
on public.habit_profiles for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their habit profile" on public.habit_profiles;
create policy "Users can create their habit profile"
on public.habit_profiles for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their habit profile" on public.habit_profiles;
create policy "Users can update their habit profile"
on public.habit_profiles for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can read their daily logs" on public.daily_logs;
create policy "Users can read their daily logs"
on public.daily_logs for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their daily logs" on public.daily_logs;
create policy "Users can create their daily logs"
on public.daily_logs for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their daily logs" on public.daily_logs;
create policy "Users can update their daily logs"
on public.daily_logs for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their daily logs" on public.daily_logs;
create policy "Users can delete their daily logs"
on public.daily_logs for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read their set entries" on public.set_entries;
create policy "Users can read their set entries"
on public.set_entries for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their set entries" on public.set_entries;
create policy "Users can create their set entries"
on public.set_entries for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their set entries" on public.set_entries;
create policy "Users can update their set entries"
on public.set_entries for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their set entries" on public.set_entries;
create policy "Users can delete their set entries"
on public.set_entries for delete
to authenticated
using ((select auth.uid()) = user_id);
