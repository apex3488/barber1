"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { formatDateLabel, formatPrice, shop } from "@/data/mock";
import {
  ApiError,
  cancelBooking,
  fetchAvailability,
  fetchBooking,
  rescheduleBooking,
  tashkentToIso,
  type ApiBooking,
} from "@/lib/api";
import styles from "./BookingFlow.module.css";

function splitTashkent(iso: string) {
  const date = new Date(iso);
  const shifted = new Date(date.getTime() + 5 * 60 * 60 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  const hh = String(shifted.getUTCHours()).padStart(2, "0");
  const mm = String(shifted.getUTCMinutes()).padStart(2, "0");
  return { date: `${y}-${m}-${d}`, time: `${hh}:${mm}` };
}

export function ManageBooking({ token }: { token: string }) {
  const [booking, setBooking] = useState<ApiBooking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<"view" | "reschedule">("view");
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  const local = useMemo(
    () => (booking ? splitTashkent(booking.startsAt) : null),
    [booking],
  );

  function reload() {
    setError(null);
    fetchBooking(token)
      .then(setBooking)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Не удалось загрузить"),
      );
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (mode !== "reschedule" || !booking || !date) return;
    const serviceIds = booking.services
      .map((item) => item.serviceId)
      .filter((id): id is string => Boolean(id));
    if (serviceIds.length === 0) return;

    setSlotsLoading(true);
    fetchAvailability({
      serviceIds,
      barberId: booking.barber.id,
      date,
    })
      .then(setSlots)
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [mode, booking, date]);

  function onCancel() {
    startTransition(async () => {
      try {
        const next = await cancelBooking(token);
        setBooking(next);
        setMessage("Запись отменена");
        setMode("view");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось отменить");
      }
    });
  }

  function onReschedule(time: string) {
    startTransition(async () => {
      try {
        const next = await rescheduleBooking(token, {
          startsAt: tashkentToIso(date, time),
        });
        setBooking(next);
        setMessage("Запись перенесена");
        setMode("view");
      } catch (err) {
        if (err instanceof ApiError && err.code === "SLOT_TAKEN") {
          setError("Этот слот уже занят. Выберите другое время.");
          return;
        }
        setError(err instanceof Error ? err.message : "Не удалось перенести");
      }
    });
  }

  return (
    <div className={styles.shell}>
      <header className={styles.top}>
        <Link href="/" className={styles.backHome}>
          ← На главную
        </Link>
        <p className={styles.brand}>{shop.name}</p>
      </header>

      <div className={styles.layout}>
        <section className={styles.main}>
          <div className={styles.step}>
            <h1>Управление записью</h1>
            <p className={styles.lead}>
              Отмена и перенос доступны не позже чем за 30 минут до визита.
            </p>

            {error && (
              <div className={`${styles.state} ${styles.state_error}`}>
                <strong>Ошибка</strong>
                <p>{error}</p>
              </div>
            )}
            {message && (
              <div className={`${styles.state} ${styles.state_neutral}`}>
                <strong>{message}</strong>
              </div>
            )}

            {!booking && !error && (
              <div className={`${styles.state} ${styles.state_loading}`}>
                <span className={styles.spinner} />
                <strong>Загружаем запись…</strong>
              </div>
            )}

            {booking && mode === "view" && local && (
              <>
                <dl className={styles.summary} style={{ border: 0, padding: 0 }}>
                  <div>
                    <dt>Статус</dt>
                    <dd>{booking.status}</dd>
                  </div>
                  <div>
                    <dt>Услуга</dt>
                    <dd>{booking.services.map((s) => s.name).join(", ")}</dd>
                  </div>
                  <div>
                    <dt>Барбер</dt>
                    <dd>{booking.barber.name}</dd>
                  </div>
                  <div>
                    <dt>Когда</dt>
                    <dd>
                      {formatDateLabel(local.date)} · {local.time}
                    </dd>
                  </div>
                  <div>
                    <dt>Цена</dt>
                    <dd>{formatPrice(booking.totalPrice)}</dd>
                  </div>
                </dl>

                {booking.status === "confirmed" && (
                  <div className={styles.successActions}>
                    <button
                      type="button"
                      className="btn btn--primary"
                      disabled={pending}
                      onClick={() => {
                        setMode("reschedule");
                        setDate(local.date);
                        setMessage(null);
                        setError(null);
                      }}
                    >
                      Перенести
                    </button>
                    <button
                      type="button"
                      className="btn btn--ink"
                      disabled={pending}
                      onClick={onCancel}
                    >
                      Отменить
                    </button>
                  </div>
                )}
              </>
            )}

            {booking && mode === "reschedule" && (
              <>
                <label className={styles.field}>
                  <span>Новая дата (YYYY-MM-DD)</span>
                  <input
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                  />
                </label>

                {slotsLoading && (
                  <div className={`${styles.state} ${styles.state_loading}`}>
                    <span className={styles.spinner} />
                    <strong>Загружаем слоты…</strong>
                  </div>
                )}

                {!slotsLoading && (
                  <div className={styles.timeGrid}>
                    {slots.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        className={styles.timeBtn}
                        disabled={pending}
                        onClick={() => onReschedule(slot)}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  className="btn btn--ink"
                  style={{ marginTop: "1rem" }}
                  onClick={() => setMode("view")}
                >
                  Назад
                </button>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
