-- Part 2 of the auth lockdown: replace the permissive "Allow all" policy
-- on every table with four owner-scoped policies (select/insert/update/
-- delete), and lock table-level grants down to `authenticated` only.
--
-- Run this after 20260804010000_add_user_id_columns.sql has been applied
-- and user_id is backfilled + not null on every table below.

-- years
drop policy if exists "Allow all" on public.years;
create policy "Select own years" on public.years for select to authenticated using (auth.uid() = user_id);
create policy "Insert own years" on public.years for insert to authenticated with check (auth.uid() = user_id);
create policy "Update own years" on public.years for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own years" on public.years for delete to authenticated using (auth.uid() = user_id);
revoke all on public.years from anon;
grant select, insert, update, delete on public.years to authenticated;

-- modules
drop policy if exists "Allow all" on public.modules;
create policy "Select own modules" on public.modules for select to authenticated using (auth.uid() = user_id);
create policy "Insert own modules" on public.modules for insert to authenticated with check (auth.uid() = user_id);
create policy "Update own modules" on public.modules for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own modules" on public.modules for delete to authenticated using (auth.uid() = user_id);
revoke all on public.modules from anon;
grant select, insert, update, delete on public.modules to authenticated;

-- tasks
drop policy if exists "Allow all" on public.tasks;
create policy "Select own tasks" on public.tasks for select to authenticated using (auth.uid() = user_id);
create policy "Insert own tasks" on public.tasks for insert to authenticated with check (auth.uid() = user_id);
create policy "Update own tasks" on public.tasks for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own tasks" on public.tasks for delete to authenticated using (auth.uid() = user_id);
revoke all on public.tasks from anon;
grant select, insert, update, delete on public.tasks to authenticated;

-- topics
drop policy if exists "Allow all" on public.topics;
create policy "Select own topics" on public.topics for select to authenticated using (auth.uid() = user_id);
create policy "Insert own topics" on public.topics for insert to authenticated with check (auth.uid() = user_id);
create policy "Update own topics" on public.topics for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own topics" on public.topics for delete to authenticated using (auth.uid() = user_id);
revoke all on public.topics from anon;
grant select, insert, update, delete on public.topics to authenticated;

-- prompts
drop policy if exists "Allow all" on public.prompts;
create policy "Select own prompts" on public.prompts for select to authenticated using (auth.uid() = user_id);
create policy "Insert own prompts" on public.prompts for insert to authenticated with check (auth.uid() = user_id);
create policy "Update own prompts" on public.prompts for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own prompts" on public.prompts for delete to authenticated using (auth.uid() = user_id);
revoke all on public.prompts from anon;
grant select, insert, update, delete on public.prompts to authenticated;

-- perplexity_links
drop policy if exists "Allow all" on public.perplexity_links;
create policy "Select own perplexity_links" on public.perplexity_links for select to authenticated using (auth.uid() = user_id);
create policy "Insert own perplexity_links" on public.perplexity_links for insert to authenticated with check (auth.uid() = user_id);
create policy "Update own perplexity_links" on public.perplexity_links for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own perplexity_links" on public.perplexity_links for delete to authenticated using (auth.uid() = user_id);
revoke all on public.perplexity_links from anon;
grant select, insert, update, delete on public.perplexity_links to authenticated;

-- task_research_links
drop policy if exists "Allow all" on public.task_research_links;
create policy "Select own task_research_links" on public.task_research_links for select to authenticated using (auth.uid() = user_id);
create policy "Insert own task_research_links" on public.task_research_links for insert to authenticated with check (auth.uid() = user_id);
create policy "Update own task_research_links" on public.task_research_links for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own task_research_links" on public.task_research_links for delete to authenticated using (auth.uid() = user_id);
revoke all on public.task_research_links from anon;
grant select, insert, update, delete on public.task_research_links to authenticated;

-- habits
drop policy if exists "Allow all" on public.habits;
create policy "Select own habits" on public.habits for select to authenticated using (auth.uid() = user_id);
create policy "Insert own habits" on public.habits for insert to authenticated with check (auth.uid() = user_id);
create policy "Update own habits" on public.habits for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own habits" on public.habits for delete to authenticated using (auth.uid() = user_id);
revoke all on public.habits from anon;
grant select, insert, update, delete on public.habits to authenticated;

-- habit_logs
drop policy if exists "Allow all" on public.habit_logs;
create policy "Select own habit_logs" on public.habit_logs for select to authenticated using (auth.uid() = user_id);
create policy "Insert own habit_logs" on public.habit_logs for insert to authenticated with check (auth.uid() = user_id);
create policy "Update own habit_logs" on public.habit_logs for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own habit_logs" on public.habit_logs for delete to authenticated using (auth.uid() = user_id);
revoke all on public.habit_logs from anon;
grant select, insert, update, delete on public.habit_logs to authenticated;

-- rugby_sessions
drop policy if exists "Allow all" on public.rugby_sessions;
create policy "Select own rugby_sessions" on public.rugby_sessions for select to authenticated using (auth.uid() = user_id);
create policy "Insert own rugby_sessions" on public.rugby_sessions for insert to authenticated with check (auth.uid() = user_id);
create policy "Update own rugby_sessions" on public.rugby_sessions for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own rugby_sessions" on public.rugby_sessions for delete to authenticated using (auth.uid() = user_id);
revoke all on public.rugby_sessions from anon;
grant select, insert, update, delete on public.rugby_sessions to authenticated;

-- time_logs
drop policy if exists "Allow all" on public.time_logs;
create policy "Select own time_logs" on public.time_logs for select to authenticated using (auth.uid() = user_id);
create policy "Insert own time_logs" on public.time_logs for insert to authenticated with check (auth.uid() = user_id);
create policy "Update own time_logs" on public.time_logs for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own time_logs" on public.time_logs for delete to authenticated using (auth.uid() = user_id);
revoke all on public.time_logs from anon;
grant select, insert, update, delete on public.time_logs to authenticated;

-- transactions
drop policy if exists "Allow all" on public.transactions;
create policy "Select own transactions" on public.transactions for select to authenticated using (auth.uid() = user_id);
create policy "Insert own transactions" on public.transactions for insert to authenticated with check (auth.uid() = user_id);
create policy "Update own transactions" on public.transactions for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own transactions" on public.transactions for delete to authenticated using (auth.uid() = user_id);
revoke all on public.transactions from anon;
grant select, insert, update, delete on public.transactions to authenticated;
