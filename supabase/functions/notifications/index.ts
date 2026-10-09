/**
 * Supabase Edge Function: notifications
 * Вызывается Cron каждые 5 минут.
 *
 * Secrets (supabase secrets set ...):
 * - DATABASE_URL
 * - TELEGRAM_BOT_TOKEN
 * - CRON_SECRET (опционально, доп. проверка заголовка x-cron-secret)
 */
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

type BookingRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  manage_token: string;
  total_price: number;
  client_name: string;
  client_chat: string | null;
  barber_name: string;
  services: string;
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function sendTelegram(token: string, chatId: string, text: string, replyMarkup?: unknown) {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
  };
  if (replyMarkup) body.reply_markup = replyMarkup;

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Telegram error: ${err}`);
  }
}

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Tashkent",
    weekday: "short",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatPrice(price: number) {
  return new Intl.NumberFormat("ru-RU").format(price) + " сум";
}

async function getSetting(sql: ReturnType<typeof postgres>, key: string, fallback: number) {
  const rows = await sql<{ value: string }[]>`
    select value from settings where key = ${key} limit 1
  `;
  const n = Number(rows[0]?.value);
  return Number.isFinite(n) ? n : fallback;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret) {
    const header = req.headers.get("x-cron-secret");
    if (header !== cronSecret) {
      return json({ code: "UNAUTHORIZED" }, 401);
    }
  }

  const databaseUrl = Deno.env.get("DATABASE_URL") ?? Deno.env.get("SUPABASE_DB_URL");
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!databaseUrl || !botToken) {
    return json(
      { code: "MISSING_ENV", message: "DATABASE_URL and TELEGRAM_BOT_TOKEN required" },
      500,
    );
  }

  const sql = postgres(databaseUrl, { prepare: false, max: 1 });
  const summary = {
    reminderDay: 0,
    reminder30m: 0,
    autoCompleted: 0,
    reviewRequested: 0,
    errors: [] as string[],
  };

  try {
    const dayMinutes = await getSetting(sql, "reminder_day_minutes", 1440);
    const shortMinutes = await getSetting(sql, "reminder_short_minutes", 30);
    const reviewDelay = await getSetting(sql, "review_delay_min", 60);

    // --- Day reminder (идемпотентно: только если timestamp ещё null) ---
    const dayRows = await sql<BookingRow[]>`
      select
        b.id,
        b.starts_at,
        b.ends_at,
        b.manage_token,
        b.total_price,
        c.name as client_name,
        c.telegram_chat_id as client_chat,
        br.name as barber_name,
        coalesce(
          (select string_agg(bs.name, ', ') from booking_services bs where bs.booking_id = b.id),
          ''
        ) as services
      from bookings b
      join clients c on c.id = b.client_id
      join barbers br on br.id = b.barber_id
      where b.status = 'confirmed'
        and b.reminder_day_sent_at is null
        and b.starts_at > now()
        and b.starts_at <= now() + make_interval(mins => ${dayMinutes})
        and b.starts_at > now() + make_interval(mins => ${dayMinutes - 60})
    `;

    for (const row of dayRows) {
      try {
        if (row.client_chat) {
          await sendTelegram(
            botToken,
            row.client_chat,
            [
              "<b>Напоминание о записи</b>",
              `Завтра / скоро: ${formatWhen(row.starts_at)}`,
              `Услуга: ${row.services}`,
              `Барбер: ${row.barber_name}`,
              `Цена: ${formatPrice(row.total_price)}`,
            ].join("\n"),
          );
        }
        const updated = await sql`
          update bookings
          set reminder_day_sent_at = now()
          where id = ${row.id}::uuid and reminder_day_sent_at is null
        `;
        if (updated.count > 0) summary.reminderDay += 1;
      } catch (e) {
        summary.errors.push(`day:${row.id}:${String(e)}`);
      }
    }

    // --- 30m reminder ---
    const shortRows = await sql<BookingRow[]>`
      select
        b.id,
        b.starts_at,
        b.ends_at,
        b.manage_token,
        b.total_price,
        c.name as client_name,
        c.telegram_chat_id as client_chat,
        br.name as barber_name,
        coalesce(
          (select string_agg(bs.name, ', ') from booking_services bs where bs.booking_id = b.id),
          ''
        ) as services
      from bookings b
      join clients c on c.id = b.client_id
      join barbers br on br.id = b.barber_id
      where b.status = 'confirmed'
        and b.reminder_30m_sent_at is null
        and b.starts_at > now()
        and b.starts_at <= now() + make_interval(mins => ${shortMinutes})
    `;

    for (const row of shortRows) {
      try {
        if (row.client_chat) {
          await sendTelegram(
            botToken,
            row.client_chat,
            [
              "<b>Через 30 минут запись</b>",
              `Когда: ${formatWhen(row.starts_at)}`,
              `Услуга: ${row.services}`,
              `Барбер: ${row.barber_name}`,
            ].join("\n"),
          );
        }
        const updated = await sql`
          update bookings
          set reminder_30m_sent_at = now()
          where id = ${row.id}::uuid and reminder_30m_sent_at is null
        `;
        if (updated.count > 0) summary.reminder30m += 1;
      } catch (e) {
        summary.errors.push(`30m:${row.id}:${String(e)}`);
      }
    }

    // --- Auto-complete ---
    const completed = await sql`
      update bookings
      set status = 'completed', auto_completed_at = now()
      where status = 'confirmed'
        and ends_at < now()
        and auto_completed_at is null
      returning id
    `;
    summary.autoCompleted = completed.length;

    // --- Review request ---
    const reviewRows = await sql<BookingRow[]>`
      select
        b.id,
        b.starts_at,
        b.ends_at,
        b.manage_token,
        b.total_price,
        c.name as client_name,
        c.telegram_chat_id as client_chat,
        br.name as barber_name,
        coalesce(
          (select string_agg(bs.name, ', ') from booking_services bs where bs.booking_id = b.id),
          ''
        ) as services
      from bookings b
      join clients c on c.id = b.client_id
      join barbers br on br.id = b.barber_id
      where b.status = 'completed'
        and b.review_requested_at is null
        and b.ends_at <= now() - make_interval(mins => ${reviewDelay})
        and not exists (select 1 from reviews r where r.booking_id = b.id)
    `;

    for (const row of reviewRows) {
      try {
        if (row.client_chat) {
          await sendTelegram(
            botToken,
            row.client_chat,
            [
              "<b>Как прошёл визит?</b>",
              `Барбер: ${row.barber_name}`,
              `Услуга: ${row.services}`,
              "Оцените от 1 до 5:",
            ].join("\n"),
            {
              inline_keyboard: [[
                { text: "1", callback_data: `review:${row.id}:1` },
                { text: "2", callback_data: `review:${row.id}:2` },
                { text: "3", callback_data: `review:${row.id}:3` },
                { text: "4", callback_data: `review:${row.id}:4` },
                { text: "5", callback_data: `review:${row.id}:5` },
              ]],
            },
          );
        }
        const updated = await sql`
          update bookings
          set review_requested_at = now()
          where id = ${row.id}::uuid and review_requested_at is null
        `;
        if (updated.count > 0) summary.reviewRequested += 1;
      } catch (e) {
        summary.errors.push(`review:${row.id}:${String(e)}`);
      }
    }

    return json({ ok: true, summary });
  } catch (error) {
    return json({ ok: false, error: String(error) }, 500);
  } finally {
    await sql.end({ timeout: 5 });
  }
});
