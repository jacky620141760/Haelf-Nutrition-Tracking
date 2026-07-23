-- Haelf Nutrition — Supabase schema (Auth + Postgres + RLS)
-- Run in Supabase SQL Editor after creating a project.
-- Enable Email/Password in Authentication → Providers.
-- For local testing you may disable "Confirm email" in Auth settings.

create extension if not exists "pgcrypto";

-- Shared helper: soft-deletable row owned by auth.uid()
-- cloud id is uuid primary key; local_id is optional device integer for debugging

create table if not exists public.food_catalog (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id integer,
  name text not null,
  basis text not null check (basis in ('PER_100_G','PER_SERVING')),
  source_kcal double precision not null,
  source_protein_g double precision not null,
  source_fat_g double precision not null,
  source_carbs_g double precision not null,
  is_favorite boolean not null default false,
  last_used_at timestamptz,
  barcode text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists food_catalog_user_updated on public.food_catalog(user_id, updated_at);

create table if not exists public.food_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id integer,
  name text not null,
  meal_type text not null check (meal_type in ('breakfast','lunch','dinner','snack')),
  basis text not null check (basis in ('PER_100_G','PER_SERVING')),
  source_kcal double precision not null,
  source_protein_g double precision not null,
  source_fat_g double precision not null,
  source_carbs_g double precision not null,
  quantity double precision not null,
  snap_kcal double precision not null,
  snap_protein_g double precision not null,
  snap_fat_g double precision not null,
  snap_carbs_g double precision not null,
  source text not null check (source in ('manual','cache','off','ai')),
  catalog_cloud_id uuid,
  barcode text,
  log_group_id text,
  utc_timestamp timestamptz not null,
  local_date date not null,
  tz_iana text not null,
  tz_offset_minutes integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists food_entries_user_updated on public.food_entries(user_id, updated_at);
create index if not exists food_entries_user_date on public.food_entries(user_id, local_date);

create table if not exists public.daily_goal_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id integer,
  effective_date date not null,
  kcal double precision not null,
  protein_g double precision not null,
  fat_g double precision not null,
  carbs_g double precision not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, effective_date)
);
create index if not exists goals_user_updated on public.daily_goal_versions(user_id, updated_at);

create table if not exists public.weight_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id integer,
  kg double precision not null,
  utc_timestamp timestamptz not null,
  local_date date not null,
  tz_iana text not null,
  tz_offset_minutes integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists weight_user_updated on public.weight_entries(user_id, updated_at);

create table if not exists public.water_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id integer,
  ml double precision not null check (ml > 0),
  utc_timestamp timestamptz not null,
  local_date date not null,
  tz_iana text not null,
  tz_offset_minutes integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.water_goal_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id integer,
  effective_date date not null,
  ml double precision not null check (ml > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, effective_date)
);

create table if not exists public.exercise_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id integer,
  name text not null,
  duration_minutes double precision not null check (duration_minutes > 0),
  burned_kcal double precision not null check (burned_kcal >= 0),
  source text not null check (source in ('manual')),
  utc_timestamp timestamptz not null,
  local_date date not null,
  tz_iana text not null,
  tz_offset_minutes integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.daily_step_totals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  steps integer not null check (steps >= 0),
  source text not null check (source in ('pedometer','manual')),
  synced_at timestamptz not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, local_date)
);

create table if not exists public.daily_diary_status (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  completed_at timestamptz not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, local_date)
);

create table if not exists public.app_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  locale text not null default 'en',
  water_unit text not null default 'ml' check (water_unit in ('ml','cup','oz')),
  week_start integer not null default 1 check (week_start in (0,1)),
  step_mode text not null default 'pedometer' check (step_mode in ('pedometer','manual')),
  exercise_calories_enabled boolean not null default true,
  sex text check (sex is null or sex in ('male','female')),
  age_years double precision,
  height_cm double precision,
  activity_level text check (
    activity_level is null
    or activity_level in ('sedentary','light','moderate','active','very_active')
  ),
  current_weight_kg double precision,
  target_weight_kg double precision,
  plan_weeks double precision,
  tdee_mode text not null default 'auto' check (tdee_mode in ('auto','manual')),
  tdee_kcal double precision,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Existing projects: add body-plan columns if missing
alter table public.app_preferences add column if not exists sex text;
alter table public.app_preferences add column if not exists age_years double precision;
alter table public.app_preferences add column if not exists height_cm double precision;
alter table public.app_preferences add column if not exists activity_level text;
alter table public.app_preferences add column if not exists current_weight_kg double precision;
alter table public.app_preferences add column if not exists target_weight_kg double precision;
alter table public.app_preferences add column if not exists plan_weeks double precision;
alter table public.app_preferences add column if not exists tdee_mode text default 'auto';
alter table public.app_preferences add column if not exists tdee_kcal double precision;

create table if not exists public.saved_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id integer,
  name text not null,
  photo_uri text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.saved_meal_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_id uuid not null references public.saved_meals(id) on delete cascade,
  local_id integer,
  sort_order integer not null,
  name text not null,
  basis text not null check (basis in ('PER_100_G','PER_SERVING')),
  source_kcal double precision not null,
  source_protein_g double precision not null,
  source_fat_g double precision not null,
  source_carbs_g double precision not null,
  default_quantity double precision not null,
  catalog_cloud_id uuid,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id integer,
  name text not null,
  total_servings double precision not null check (total_servings > 0),
  photo_uri text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  local_id integer,
  sort_order integer not null,
  name text not null,
  basis text not null check (basis in ('PER_100_G','PER_SERVING')),
  source_kcal double precision not null,
  source_protein_g double precision not null,
  source_fat_g double precision not null,
  source_carbs_g double precision not null,
  quantity double precision not null,
  catalog_cloud_id uuid,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- RLS
alter table public.food_catalog enable row level security;
alter table public.food_entries enable row level security;
alter table public.daily_goal_versions enable row level security;
alter table public.weight_entries enable row level security;
alter table public.water_entries enable row level security;
alter table public.water_goal_versions enable row level security;
alter table public.exercise_entries enable row level security;
alter table public.daily_step_totals enable row level security;
alter table public.daily_diary_status enable row level security;
alter table public.app_preferences enable row level security;
alter table public.saved_meals enable row level security;
alter table public.saved_meal_items enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;

create or replace function public.is_owner(uid uuid)
returns boolean language sql stable as $$
  select uid = auth.uid();
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'food_catalog','food_entries','daily_goal_versions','weight_entries',
    'water_entries','water_goal_versions','exercise_entries','daily_step_totals',
    'daily_diary_status','app_preferences','saved_meals','saved_meal_items',
    'recipes','recipe_ingredients'
  ]
  loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format('drop policy if exists %I_insert on public.%I', t, t);
    execute format('drop policy if exists %I_update on public.%I', t, t);
    execute format('drop policy if exists %I_delete on public.%I', t, t);
    execute format('create policy %I_select on public.%I for select using (user_id = auth.uid())', t, t);
    execute format('create policy %I_insert on public.%I for insert with check (user_id = auth.uid())', t, t);
    execute format('create policy %I_update on public.%I for update using (user_id = auth.uid())', t, t);
    execute format('create policy %I_delete on public.%I for delete using (user_id = auth.uid())', t, t);
  end loop;
end $$;
