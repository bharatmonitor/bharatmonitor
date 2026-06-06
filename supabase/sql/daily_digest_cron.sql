-- Daily digest scheduler. Requires pg_cron + pg_net (enable in Dashboard →
-- Database → Extensions). Sends every day at 02:30 UTC = 08:00 IST.
-- Replace <PROJECT_REF> and <ANON_OR_SERVICE_KEY> before running.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'bm-daily-digest',
  '30 2 * * *',                                  -- 08:00 IST daily
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.functions.supabase.co/bm-daily-digest',
    headers := jsonb_build_object(
                 'Content-Type','application/json',
                 'Authorization','Bearer <ANON_OR_SERVICE_KEY>'),
    body    := '{}'::jsonb
  );
  $$
);

-- To change the time:   select cron.alter_job((select jobid from cron.job where jobname='bm-daily-digest'), schedule := '0 3 * * *');
-- To remove:            select cron.unschedule('bm-daily-digest');
-- To see runs:          select * from cron.job_run_details order by start_time desc limit 10;
