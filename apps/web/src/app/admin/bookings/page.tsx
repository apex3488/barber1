"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  adminApi,
  type AdminBarber,
  type AdminBooking,
  type AdminService,
} from "@/lib/adminApi";
import styles from "../admin.module.css";

const statuses = ["confirmed", "completed", "cancelled", "no_show"] as const;

function fmt(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toLocalInput(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminBookingsPage() {
  const [items, setItems] = useState<AdminBooking[]>([]);
  const [services, setServices] = useState<AdminService[]>([]);
  const [barbers, setBarbers] = useState<AdminBarber[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    barberId: "",
    startsAt: "",
    serviceIds: [] as string[],
  });

  useEffect(() => {
    let cancelled = false;
    const query = status ? `?status=${status}` : "";
    Promise.all([
      adminApi.bookings(query),
      adminApi.services(),
      adminApi.barbers(),
    ])
      .then(([bookings, svc, brb]) => {
        if (cancelled) return;
        setItems(bookings.data);
        setServices(svc.data.filter((s) => s.isActive));
        setBarbers(brb.data.filter((b) => b.isActive));
        setForm((f) => ({
          ...f,
          barberId: f.barberId || brb.data[0]?.id || "",
          startsAt: f.startsAt || toLocalInput(),
        }));
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Ошибка загрузки");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [status]);

  async function reload() {
    try {
      const query = status ? `?status=${status}` : "";
      const bookings = await adminApi.bookings(query);
      setItems(bookings.data);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    }
  }

  async function createBooking(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await adminApi.createBooking({
        client: { name: form.name, phone: form.phone },
        barberId: form.barberId,
        startsAt: new Date(form.startsAt).toISOString(),
        serviceIds: form.serviceIds,
      });
      setShowCreate(false);
      setForm((f) => ({
        ...f,
        name: "",
        phone: "",
        serviceIds: [],
        startsAt: toLocalInput(),
      }));
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать");
    }
  }

  async function patch(
    id: string,
    body: { status?: string; startsAt?: string },
  ) {
    setError("");
    try {
      await adminApi.patchBooking(id, body);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось обновить");
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>Записи</h1>
          <p className={styles.muted}>Список, создание, перенос и статусы</p>
        </div>
        <button
          type="button"
          className={styles.btn}
          onClick={() => setShowCreate((v) => !v)}
        >
          {showCreate ? "Скрыть форму" : "Новая запись"}
        </button>
      </div>

      <div className={`${styles.filters} ${styles.panel}`}>
        <label>
          Статус
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Все</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.actions}>
          <button type="button" className={styles.btnGhost} onClick={() => void reload()}>
            Обновить
          </button>
        </div>
      </div>

      {showCreate ? (
        <form className={`${styles.panel} ${styles.form}`} onSubmit={createBooking}>
          <div className={`${styles.row} ${styles.row3}`}>
            <label>
              Имя
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label>
              Телефон
              <input
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </label>
            <label>
              Барбер
              <select
                required
                value={form.barberId}
                onChange={(e) => setForm({ ...form, barberId: e.target.value })}
              >
                {barbers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Дата и время
            <input
              type="datetime-local"
              required
              value={form.startsAt}
              onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
            />
          </label>
          <div className={styles.checks}>
            {services.map((s) => {
              const checked = form.serviceIds.includes(s.id);
              return (
                <label key={s.id} className={styles.check}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setForm({
                        ...form,
                        serviceIds: checked
                          ? form.serviceIds.filter((id) => id !== s.id)
                          : [...form.serviceIds, s.id],
                      })
                    }
                  />
                  {s.name} · {s.price.toLocaleString("ru-RU")}
                </label>
              );
            })}
          </div>
          <button
            className={styles.btn}
            type="submit"
            disabled={form.serviceIds.length === 0}
          >
            Создать
          </button>
        </form>
      ) : null}

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.list}>
        {items.map((item) => (
          <article key={item.id} className={styles.card}>
            <div className={styles.cardTop}>
              <strong>
                {item.client.name} · {item.client.phone}
              </strong>
              <span className={styles.badge}>{item.status}</span>
            </div>
            <div className={styles.muted}>
              {fmt(item.startsAt)} → {fmt(item.endsAt)} · {item.barber.name}
            </div>
            <div>
              {item.services.map((s) => s.name).join(", ")} ·{" "}
              {item.totalPrice.toLocaleString("ru-RU")} сум
            </div>
            <div className={styles.actions}>
              <select
                defaultValue={item.status}
                onChange={(e) => void patch(item.id, { status: e.target.value })}
              >
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => {
                  const next = window.prompt(
                    "Новое время (YYYY-MM-DDTHH:mm)",
                    toLocalInput(new Date(item.startsAt)),
                  );
                  if (!next) return;
                  void patch(item.id, {
                    startsAt: new Date(next).toISOString(),
                  });
                }}
              >
                Перенести
              </button>
              <button
                type="button"
                className={styles.btnDanger}
                onClick={() => void patch(item.id, { status: "cancelled" })}
              >
                Отменить
              </button>
            </div>
          </article>
        ))}
        {items.length === 0 ? (
          <p className={styles.muted}>Записей пока нет</p>
        ) : null}
      </div>
    </div>
  );
}
