"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { adminApi, type AdminAnalytics } from "@/lib/adminApi";
import styles from "../admin.module.css";
import dash from "./dashboard.module.css";

const weekdays = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const hours = Array.from({ length: 14 }, (_, i) => i + 8); // 08–21

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function todayIso() {
  return isoDaysAgo(0);
}

function money(n: number) {
  return `${n.toLocaleString("ru-RU")} сум`;
}

export default function AdminDashboardPage() {
  const [from, setFrom] = useState(() => isoDaysAgo(29));
  const [to, setTo] = useState(() => todayIso());
  const [applied, setApplied] = useState({ from: isoDaysAgo(29), to: todayIso() });
  const [data, setData] = useState<AdminAnalytics | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    adminApi
      .analytics(applied.from, applied.to)
      .then((res) => {
        if (!cancelled) {
          setData(res.data);
          setError("");
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Ошибка");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [applied]);

  const maxHeat = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, ...data.heatmap.map((c) => c.count));
  }, [data]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setApplied({ from, to: to < from ? from : to });
  }

  const summary = data?.summary;

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>Аналитика</h1>
          <p className={styles.muted}>Показатели за выбранный период</p>
        </div>
      </div>

      <form className={`${styles.panel} ${styles.filters}`} onSubmit={onSubmit}>
        <label>
          С
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            required
          />
        </label>
        <label>
          По
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            required
          />
        </label>
        <div className={styles.actions}>
          <button className={styles.btn} type="submit">
            Показать
          </button>
          <button
            type="button"
            className={styles.btnGhost}
            onClick={() => {
              const next = { from: isoDaysAgo(6), to: todayIso() };
              setFrom(next.from);
              setTo(next.to);
              setApplied(next);
            }}
          >
            7 дней
          </button>
          <button
            type="button"
            className={styles.btnGhost}
            onClick={() => {
              const next = { from: isoDaysAgo(29), to: todayIso() };
              setFrom(next.from);
              setTo(next.to);
              setApplied(next);
            }}
          >
            30 дней
          </button>
        </div>
      </form>

      {error ? <p className={styles.error}>{error}</p> : null}

      {summary ? (
        <>
          <div className={dash.kpis}>
            <div className={dash.kpi}>
              <span className={styles.muted}>Выручка (completed)</span>
              <strong>{money(summary.revenue)}</strong>
            </div>
            <div className={dash.kpi}>
              <span className={styles.muted}>Записи</span>
              <strong>{summary.bookings}</strong>
              <small className={styles.muted}>
                done {summary.completed} · conf {summary.confirmed}
              </small>
            </div>
            <div className={dash.kpi}>
              <span className={styles.muted}>Отмены</span>
              <strong>
                {summary.cancelled} ({summary.cancelRate}%)
              </strong>
            </div>
            <div className={dash.kpi}>
              <span className={styles.muted}>Неявки</span>
              <strong>
                {summary.noShow} ({summary.noShowRate}%)
              </strong>
            </div>
            <div className={dash.kpi}>
              <span className={styles.muted}>Возвращаемость</span>
              <strong>{summary.retentionRate}%</strong>
              <small className={styles.muted}>
                {summary.returningClients}/{summary.uniqueClients} клиентов
              </small>
            </div>
          </div>

          <div className={dash.split}>
            <section className={styles.panel}>
              <h2 className={dash.sectionTitle}>Популярные услуги</h2>
              <div className={styles.list}>
                {(data?.popularServices ?? []).slice(0, 8).map((s) => (
                  <div key={`${s.serviceId ?? s.name}`} className={dash.row}>
                    <span>{s.name}</span>
                    <span className={styles.muted}>
                      {s.count} · {money(s.revenue)}
                    </span>
                  </div>
                ))}
                {(data?.popularServices.length ?? 0) === 0 ? (
                  <p className={styles.muted}>Нет данных</p>
                ) : null}
              </div>
            </section>

            <section className={styles.panel}>
              <h2 className={dash.sectionTitle}>Загрузка барберов</h2>
              <div className={styles.list}>
                {(data?.barberLoad ?? []).map((b) => (
                  <div key={b.barberId} className={dash.row}>
                    <div>
                      <strong>{b.name}</strong>
                      <div className={styles.muted}>
                        {b.minutes} мин / {b.capacityMin} мин ·{" "}
                        {b.utilizationPct}%
                      </div>
                    </div>
                    <span className={styles.muted}>
                      {b.bookings} зап. · {money(b.revenue)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className={styles.panel}>
            <h2 className={dash.sectionTitle}>Heatmap · день × час</h2>
            <p className={styles.muted}>Только confirmed и completed, Asia/Tashkent</p>
            <div className={dash.heatWrap}>
              <div className={dash.heat}>
                <div className={dash.heatCorner} />
                {hours.map((h) => (
                  <div key={h} className={dash.heatHour}>
                    {String(h).padStart(2, "0")}
                  </div>
                ))}
                {weekdays.map((label, weekday) => (
                  <div key={label} className={dash.heatDayRow}>
                    <div className={dash.heatDay}>{label}</div>
                    {hours.map((hour) => {
                      const cell = data?.heatmap.find(
                        (c) => c.weekday === weekday && c.hour === hour,
                      );
                      const count = cell?.count ?? 0;
                      const alpha = count === 0 ? 0 : 0.12 + (count / maxHeat) * 0.78;
                      return (
                        <div
                          key={`${weekday}-${hour}`}
                          className={dash.heatCell}
                          title={`${label} ${hour}:00 — ${count}`}
                          style={{
                            background: `rgba(196, 122, 44, ${alpha})`,
                          }}
                        >
                          {count || ""}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      ) : (
        <p className={styles.muted}>Загрузка…</p>
      )}
    </div>
  );
}
