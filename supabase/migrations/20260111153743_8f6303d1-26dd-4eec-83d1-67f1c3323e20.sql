-- Enable pg_cron and pg_net extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant usage to postgres user
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Create cron job to generate weekly reports every Monday at 7h BRT (10h UTC)
SELECT cron.schedule(
  'generate-weekly-report-monday',
  '0 10 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://rsdcrihncidwuyuzokbw.supabase.co/functions/v1/generate-weekly-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzZGNyaWhuY2lkd3V5dXpva2J3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MTA1NjIsImV4cCI6MjA4MDk4NjU2Mn0.yRIt60BZK5ZNZvZJUc50v0h2KzbNAAC7IW3_P3L4Z0A'
    ),
    body := '{"trigger": "scheduled"}'::jsonb
  ) AS request_id;
  $$
);