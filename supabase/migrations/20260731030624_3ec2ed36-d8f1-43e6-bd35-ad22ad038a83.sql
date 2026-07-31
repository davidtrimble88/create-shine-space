select cron.unschedule('send-teaching-schedule-daily') where exists (select 1 from cron.job where jobname='send-teaching-schedule-daily');
select cron.unschedule('check-cert-expirations-daily') where exists (select 1 from cron.job where jobname='check-cert-expirations-daily');

select cron.schedule(
  'send-teaching-schedule-daily',
  '0 14 * * *',
  $cron$
  select net.http_post(
    url := 'https://tdoyunayplyrmdixhvmn.supabase.co/functions/v1/send-teaching-schedule',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'email_queue_service_role_key')
    ),
    body := '{}'::jsonb
  );
  $cron$
);

select cron.schedule(
  'check-cert-expirations-daily',
  '0 16 * * *',
  $cron$
  select net.http_post(
    url := 'https://tdoyunayplyrmdixhvmn.supabase.co/functions/v1/check-cert-expirations',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'email_queue_service_role_key')
    ),
    body := '{}'::jsonb
  );
  $cron$
);