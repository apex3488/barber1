"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  adminApi,
  type AdminBarber,
  type AdminTimeOff,
} from "@/lib/adminApi";
import styles from "../admin.module.css";

const types = ["day_off", "vacation", "sick", "shop_closed", "other"] as const;

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminTimeOffPage() {
  const [items, setItems] = useState<AdminTimeOff[]>([]);
  const [barbers, setBarbers] = useState<AdminBarber[]>([]);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const [form, setForm] = useState({
    barberId: "",
    startsAt: "",
    endsAt: "",
    type: "day_off",
    note: "",
  });

  useEffect(() => {
    let cancelled = false;
    Promise.all([adminApi.timeOff(), adminApi.barbers()])
      .then(([timeOff, brb]) => {
        if (cancelled) return;
        setItems(timeOff.data);
        setBarbers(brb.data);
        setForm((f) => {
          if (f.startsAt) return f;
          const start = new Date();
          const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
          return {
            ...f,
            startsAt: toLocalInput(start),
            endsAt: toLocalInput(end),
          };
        });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Ошибка");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await adminApi.createTimeOff({
        barberId: form.barberId || null,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
        type: form.type,
        note: form.note || null,
      });
      setTick((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать");
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>Исключения</h1>
          <p className={styles.muted}>Выходные, отпуска, закрытие салона</p>
        </div>
      </div>

      <form className={`${styles.panel} ${styles.form}`} onSubmit={onSubmit}>
        <div className={styles.grid2}>
          <label>
            Барбер (пусто = весь салон)
            <select
              value={form.barberId}
              onChange={(e) => setForm({ ...form, barberId: e.target.value })}
            >
              <option value="">Весь салон</option>
              {barbers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Тип
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              {types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            С
            <input
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
              required
            />
          </label>
          <label>
            До
            <input
              type="datetime-local"
              value={form.endsAt}
              onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
              required
            />
          </label>
        </div>
        <label>
          Заметка
          <input
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
        </label>
        <button className={styles.btn} type="submit">
          Добавить
        </button>
      </form>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.list}>
        {items.map((item) => (
          <article key={item.id} className={styles.card}>
            <div className={styles.cardTop}>
              <strong>{item.type}</strong>
              <span className={styles.badge}>
                {item.barber?.name ?? "Салон"}
              </span>
            </div>
            <div className={styles.muted}>
              {new Date(item.startsAt).toLocaleString("ru-RU")} —{" "}
              {new Date(item.endsAt).toLocaleString("ru-RU")}
            </div>
            {item.note ? <p>{item.note}</p> : null}
            <button
              type="button"
              className={styles.btnDanger}
              onClick={() =>
                void adminApi
                  .deleteTimeOff(item.id)
                  .then(() => setTick((n) => n + 1))
              }
            >
              Удалить
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
