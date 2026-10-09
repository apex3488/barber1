# Edge Function: notifications

## Deploy

```bash
npx supabase login
npx supabase link --project-ref gwfeiesfpxsmiwreirhx
npx supabase secrets set DATABASE_URL="..." TELEGRAM_BOT_TOKEN="..." CRON_SECRET="barber_cron_secret"
npx supabase functions deploy notifications
```

## Cron

Выполни SQL из `supabase/cron.sql` в Supabase SQL Editor.

## Local check (через API)

```bash
curl -X POST http://localhost:3001/internal/cron/notifications \
  -H "x-cron-secret: barber_cron_secret"
```

или:

```bash
npm run notifications:run
```
