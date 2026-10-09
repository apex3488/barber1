"use client";

import { useEffect, useState } from "react";
import { adminApi, type AdminReview } from "@/lib/adminApi";
import styles from "../admin.module.css";

export default function AdminReviewsPage() {
  const [items, setItems] = useState<AdminReview[]>([]);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    adminApi
      .reviews()
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

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>Отзывы</h1>
          <p className={styles.muted}>Публикация и скрытие отзывов</p>
        </div>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.list}>
        {items.map((item) => (
          <article key={item.id} className={styles.card}>
            <div className={styles.cardTop}>
              <strong>
                {item.rating}/5 · {item.client.name}
              </strong>
              <span className={styles.badge}>
                {item.isPublic ? "public" : "hidden"}
              </span>
            </div>
            <div className={styles.muted}>
              {item.barber.name} ·{" "}
              {new Date(item.createdAt).toLocaleString("ru-RU")}
            </div>
            {item.comment ? <p>{item.comment}</p> : null}
            <button
              type="button"
              className={styles.btnGhost}
              onClick={() =>
                void adminApi
                  .patchReview(item.id, !item.isPublic)
                  .then(() => setTick((n) => n + 1))
              }
            >
              {item.isPublic ? "Скрыть" : "Опубликовать"}
            </button>
          </article>
        ))}
        {items.length === 0 ? (
          <p className={styles.muted}>Отзывов пока нет</p>
        ) : null}
      </div>
    </div>
  );
}
