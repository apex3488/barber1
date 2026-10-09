-- Настройка Supabase Cron → Edge Function notifications
-- Выполнить в SQL Editor после деплоя функции.
-- Замените PROJECT_REF и SERVICE_ROLE_KEY.

-- Расширения (обычно уже есть на Supabase)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Секрет для дополнительной проверки (должен совпадать с CRON_SECRET функции)
-- Храните в Vault / secrets, не коммитьте реальные ключи.

select cron.unschedule('barber-notifications-every-5-min')
where exists (
  select 1 from cron.job where jobname = 'barber-notifications-every-5-min'
);

select cron.schedule(
  'barber-notifications-every-5-min',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://gwfeiesfpxsmiwreirhx.supabase.co/functions/v1/notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'x-cron-secret', current_setting('app.settings.cron_secret', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Если current_setting недоступен, используйте явный вариант (только в SQL Editor, не в git):
--
-- select cron.schedule(
--   'barber-notifications-every-5-min',
--   '*/5 * * * *',
--   $$
--   select net.http_post(
--     url := 'https://gwfeiesfpxsmiwreirhx.supabase.co/functions/v1/notifications',
--     headers := '{"Content-Type":"application/json","Authorization":"Bearer YOUR_SERVICE_ROLE_KEY","x-cron-secret":"YOUR_CRON_SECRET"}'::jsonb,
--     body := '{}'::jsonb
--   );
--   $$
-- );
