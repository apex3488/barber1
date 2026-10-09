"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { adminApi, type AdminBarber } from "@/lib/adminApi";
import styles from "../admin.module.css";

const empty = {
  name: "",
  bio: "",
  experienceYears: 1,
  sortOrder: 0,
};

export default function AdminBarbersPage() {
  const [items, setItems] = useState<AdminBarber[]>([]);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    adminApi
      .barbers()
      .then((res) => {
        if (!cancelled) setItems(res.data);
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
      await adminApi.createBarber({
        name: form.name,
        bio: form.bio || null,
        experienceYears: Number(form.experienceYears),
        sortOrder: Number(form.sortOrder),
      });
      setForm(empty);
      setTick((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать");
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>Барберы</h1>
          <p className={styles.muted}>Список, фото, график и портфолио</p>
        </div>
      </div>

      <form className={`${styles.panel} ${styles.form}`} onSubmit={onSubmit}>
        <div className={styles.grid2}>
          <label>
            Имя
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label>
            Опыт, лет
            <input
              type="number"
              min={0}
              value={form.experienceYears}
              onChange={(e) =>
                setForm({ ...form, experienceYears: Number(e.target.value) })
              }
            />
          </label>
        </div>
        <label>
          Био
          <textarea
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
          />
        </label>
        <button className={styles.btn} type="submit">
          Добавить барбера
        </button>
      </form>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.list}>
        {items.map((item) => (
          <article key={item.id} className={styles.card}>
            <div className={styles.cardTop}>
              <strong>
                {item.name}{" "}
                {!item.isActive ? (
                  <span className={styles.badge}>off</span>
                ) : null}
              </strong>
              <span className={styles.muted}>
                {item.experienceYears} лет · график{" "}
                {item.workingHours?.length ?? 0} дн.
              </span>
            </div>
            {item.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className={styles.avatar} src={item.photoUrl} alt="" />
            ) : null}
            <div className={styles.actions}>
              <Link className={styles.btn} href={`/admin/barbers/${item.id}`}>
                Открыть
              </Link>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() =>
                  void adminApi
                    .patchBarber(item.id, { isActive: !item.isActive })
                    .then(() => setTick((n) => n + 1))
                }
              >
                {item.isActive ? "Выключить" : "Включить"}
              </button>
              <button
                type="button"
                className={styles.btnDanger}
                onClick={() =>
                  void adminApi
                    .deleteBarber(item.id)
                    .then(() => setTick((n) => n + 1))
                }
              >
                Удалить
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
