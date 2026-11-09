-- Playtest bots (docs/BOT_PLAN.md): bot-private state, one row per game.
-- Apply in the Supabase dashboard's SQL editor. Safe to re-run.
-- Like board_states, access is anonymous (the app uses no auth); rows go away with their game.

create table if not exists public.bot_states (
  code text primary key references public.games(code) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.bot_states enable row level security;

drop policy if exists "bot_states anon select" on public.bot_states;
create policy "bot_states anon select" on public.bot_states for select to anon using (true);

drop policy if exists "bot_states anon insert" on public.bot_states;
create policy "bot_states anon insert" on public.bot_states for insert to anon with check (true);

drop policy if exists "bot_states anon update" on public.bot_states;
create policy "bot_states anon update" on public.bot_states for update to anon using (true) with check (true);

drop policy if exists "bot_states anon delete" on public.bot_states;
create policy "bot_states anon delete" on public.bot_states for delete to anon using (true);

-- Realtime, so board screens see narration as bots play.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bot_states'
  ) then
    alter publication supabase_realtime add table public.bot_states;
  end if;
end $$;
