"use client";

import { FormEvent, useEffect, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import styles from "../admin.module.css";

const keys = [
  "timezone",
  "cancel_cutoff_min",
  "slot_step_min",
  "booking_horizon_days",
  "min_notice_min",
  "reminder_day_minutes",
  "reminder_short_minutes",
  "review_delay_min",
  "review_public_min_rating",
] as const;

export default function AdminSettingsPage() {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(keys.map((k) => [k, ""])),
  );
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    adminApi
      .settings()
      .then((res) => {
        setValues((prev) => ({ ...prev, ...res.data }));
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Ошибка");
      });
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setOk("");
    try {
      const body = Object.fromEntries(keys.map((k) => [k, values[k] ?? ""]));
      const res = await adminApi.saveSettings(body);
      setValues((prev) => ({ ...prev, ...res.data }));
      setOk("Настройки сохранены");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>Настройки</h1>
          <p className={styles.muted}>Параметры салона и записи</p>
        </div>
      </div>

      <form className={`${styles.panel} ${styles.form}`} onSubmit={onSubmit}>
        <div className={styles.grid2}>
          {keys.map((key) => (
            <label key={key}>
              {key}
              <input
                value={values[key] ?? ""}
                onChange={(e) =>
                  setValues({ ...values, [key]: e.target.value })
                }
              />
            </label>
          ))}
        </div>
        {error ? <p className={styles.error}>{error}</p> : null}
        {ok ? <p className={styles.ok}>{ok}</p> : null}
        <button className={styles.btn} type="submit">
          Сохранить
        </button>
      </form>
    </div>
  );
}
