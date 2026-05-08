alter table public.scan_logs
  add column if not exists scanner_id text,
  add column if not exists scanner_name text;

create index if not exists scan_logs_scanner_id_idx
  on public.scan_logs (scanner_id);

create index if not exists scan_logs_scan_time_idx
  on public.scan_logs (scan_time desc);

alter table public.scan_logs enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'scan_logs'
      and policyname = 'scan_logs_select_all'
  ) then
    create policy scan_logs_select_all
      on public.scan_logs
      for select
      to anon
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'scan_logs'
      and policyname = 'scan_logs_insert_all'
  ) then
    create policy scan_logs_insert_all
      on public.scan_logs
      for insert
      to anon
      with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'scan_logs'
      and policyname = 'scan_logs_delete_all'
  ) then
    create policy scan_logs_delete_all
      on public.scan_logs
      for delete
      to anon
      using (true);
  end if;
end $$;

create table if not exists public.scanner_sessions (
  scanner_id text primary key,
  scanner_name text not null,
  scanner_label text null,
  login_at timestamp with time zone not null default now(),
  last_seen_at timestamp with time zone not null default now(),
  is_active boolean not null default true
);

alter table public.scanner_sessions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'scanner_sessions'
      and policyname = 'scanner_sessions_select_all'
  ) then
    create policy scanner_sessions_select_all
      on public.scanner_sessions
      for select
      to anon
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'scanner_sessions'
      and policyname = 'scanner_sessions_insert_all'
  ) then
    create policy scanner_sessions_insert_all
      on public.scanner_sessions
      for insert
      to anon
      with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'scanner_sessions'
      and policyname = 'scanner_sessions_update_all'
  ) then
    create policy scanner_sessions_update_all
      on public.scanner_sessions
      for update
      to anon
      using (true)
      with check (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'scan_logs'
  ) then
    alter publication supabase_realtime add table public.scan_logs;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'scanner_sessions'
  ) then
    alter publication supabase_realtime add table public.scanner_sessions;
  end if;
end $$;
