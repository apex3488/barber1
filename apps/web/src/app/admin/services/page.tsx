"use client";

import { FormEvent, useEffect, useState } from "react";
import { adminApi, type AdminService } from "@/lib/adminApi";
import styles from "../admin.module.css";

const empty = {
  name: "",
  description: "",
  durationMin: 30,
  price: 100000,
  sortOrder: 0,
};

export default function AdminServicesPage() {
  const [items, setItems] = useState<AdminService[]>([]);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    adminApi
      .services()
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
    const body = {
      name: form.name,
      description: form.description || null,
      durationMin: Number(form.durationMin),
      price: Number(form.price),
      sortOrder: Number(form.sortOrder),
    };
    try {
      if (editId) await adminApi.patchService(editId, body);
      else await adminApi.createService(body);
      setForm(empty);
      setEditId(null);
      setTick((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>Услуги</h1>
          <p className={styles.muted}>CRUD услуг барбершопа</p>
        </div>
      </div>

      <form className={`${styles.panel} ${styles.form}`} onSubmit={onSubmit}>
        <div className={`${styles.row} ${styles.row3}`}>
          <label>
            Название
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label>
            Длительность, мин
            <input
              type="number"
              min={5}
              required
              value={form.durationMin}
              onChange={(e) =>
                setForm({ ...form, durationMin: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Цена
            <input
              type="number"
              min={0}
              required
              value={form.price}
              onChange={(e) =>
                setForm({ ...form, price: Number(e.target.value) })
              }
            />
          </label>
        </div>
        <label>
          Описание
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>
        <div className={styles.actions}>
          <button className={styles.btn} type="submit">
            {editId ? "Сохранить" : "Добавить"}
          </button>
          {editId ? (
            <button
              type="button"
              className={styles.btnGhost}
              onClick={() => {
                setEditId(null);
                setForm(empty);
              }}
            >
              Отмена
            </button>
          ) : null}
        </div>
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
              <span>
                {item.durationMin} мин · {item.price.toLocaleString("ru-RU")}
              </span>
            </div>
            {item.description ? (
              <p className={styles.muted}>{item.description}</p>
            ) : null}
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => {
                  setEditId(item.id);
                  setForm({
                    name: item.name,
                    description: item.description ?? "",
                    durationMin: item.durationMin,
                    price: item.price,
                    sortOrder: item.sortOrder,
                  });
                }}
              >
                Изменить
              </button>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() =>
                  void adminApi
                    .patchService(item.id, { isActive: !item.isActive })
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
                    .deleteService(item.id)
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
