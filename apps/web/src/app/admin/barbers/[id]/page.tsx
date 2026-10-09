"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { adminApi, type AdminBarber } from "@/lib/adminApi";
import styles from "../../admin.module.css";

const weekdays = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

type DayState = {
  enabled: boolean;
  startTime: string;
  endTime: string;
  breakEnabled: boolean;
  breakStart: string;
  breakEnd: string;
};

function defaultDays(): DayState[] {
  return Array.from({ length: 7 }, (_, weekday) => ({
    enabled: weekday >= 1 && weekday <= 6,
    startTime: "10:00",
    endTime: "20:00",
    breakEnabled: weekday >= 1 && weekday <= 6,
    breakStart: "13:00",
    breakEnd: "14:00",
  }));
}

function applySchedule(item: AdminBarber): DayState[] {
  const next = defaultDays();
  const hours = item.workingHours ?? [];
  const breaks = item.breaks ?? [];
  if (hours.length === 0) return next;
  for (let i = 0; i < 7; i += 1) {
    next[i].enabled = false;
    next[i].breakEnabled = false;
  }
  for (const wh of hours) {
    next[wh.weekday] = {
      ...next[wh.weekday],
      enabled: true,
      startTime: wh.startTime.slice(0, 5),
      endTime: wh.endTime.slice(0, 5),
    };
  }
  for (const br of breaks) {
    next[br.weekday] = {
      ...next[br.weekday],
      breakEnabled: true,
      breakStart: br.startTime.slice(0, 5),
      breakEnd: br.endTime.slice(0, 5),
    };
  }
  return next;
}

export default function AdminBarberDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [barber, setBarber] = useState<AdminBarber | null>(null);
  const [days, setDays] = useState<DayState[]>(defaultDays);
  const [bio, setBio] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [tgLink, setTgLink] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    adminApi
      .barbers()
      .then((res) => {
        if (cancelled) return;
        const item = res.data.find((b) => b.id === id) ?? null;
        setBarber(item);
        if (!item) return;
        setName(item.name);
        setBio(item.bio ?? "");
        setDays(applySchedule(item));
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Ошибка");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id, tick]);

  const portfolio = useMemo(() => barber?.portfolioItems ?? [], [barber]);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setError("");
    setOk("");
    try {
      await adminApi.patchBarber(id, { name, bio: bio || null });
      setOk("Профиль сохранён");
      setTick((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  }

  async function saveSchedule(e: FormEvent) {
    e.preventDefault();
    setError("");
    setOk("");
    try {
      const workingHours = days
        .map((d, weekday) =>
          d.enabled
            ? { weekday, startTime: d.startTime, endTime: d.endTime }
            : null,
        )
        .filter(Boolean);
      const breaks = days
        .map((d, weekday) =>
          d.enabled && d.breakEnabled
            ? {
                weekday,
                startTime: d.breakStart,
                endTime: d.breakEnd,
              }
            : null,
        )
        .filter(Boolean);
      await adminApi.saveSchedule(id, { workingHours, breaks });
      setOk("График сохранён");
      setTick((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  }

  if (!barber) {
    return (
      <div className={styles.page}>
        <p className={styles.muted}>{error || "Загрузка…"}</p>
        <Link href="/admin/barbers" className={styles.btnGhost}>
          Назад
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>{barber.name}</h1>
          <p className={styles.muted}>Профиль, фото, график, портфолио</p>
        </div>
        <Link href="/admin/barbers" className={styles.btnGhost}>
          К списку
        </Link>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}
      {ok ? <p className={styles.ok}>{ok}</p> : null}

      <form className={`${styles.panel} ${styles.form}`} onSubmit={saveProfile}>
        <div className={styles.grid2}>
          <label>
            Имя
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Фото
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setError("");
                try {
                  await adminApi.uploadPhoto(id, file);
                  setOk("Фото загружено");
                  setTick((n) => n + 1);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Ошибка фото");
                }
              }}
            />
          </label>
        </div>
        {barber.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.avatar} src={barber.photoUrl} alt="" />
        ) : null}
        <label>
          Био
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} />
        </label>
        <div className={styles.actions}>
          <button className={styles.btn} type="submit">
            Сохранить профиль
          </button>
          <button
            type="button"
            className={styles.btnGhost}
            onClick={async () => {
              try {
                const res = await adminApi.telegramLink(id);
                setTgLink(res.data.deepLink);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Ошибка TG");
              }
            }}
          >
            Telegram-ссылка
          </button>
        </div>
        {tgLink ? (
          <p className={styles.muted}>
            Ссылка для барбера:{" "}
            <a href={tgLink} target="_blank" rel="noreferrer">
              {tgLink}
            </a>
          </p>
        ) : null}
      </form>

      <form className={`${styles.panel} ${styles.form}`} onSubmit={saveSchedule}>
        <h2 className={styles.title} style={{ fontSize: "1.2rem" }}>
          Недельный график и обеды
        </h2>
        <div className={styles.week}>
          {days.map((day, weekday) => (
            <div key={weekday} className={styles.day}>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={day.enabled}
                  onChange={(e) => {
                    const next = [...days];
                    next[weekday] = {
                      ...day,
                      enabled: e.target.checked,
                      breakEnabled: e.target.checked ? day.breakEnabled : false,
                    };
                    setDays(next);
                  }}
                />
                <strong>{weekdays[weekday]}</strong>
              </label>
              {day.enabled ? (
                <div className={`${styles.row} ${styles.row3}`}>
                  <label>
                    С
                    <input
                      type="time"
                      value={day.startTime}
                      onChange={(e) => {
                        const next = [...days];
                        next[weekday] = { ...day, startTime: e.target.value };
                        setDays(next);
                      }}
                    />
                  </label>
                  <label>
                    До
                    <input
                      type="time"
                      value={day.endTime}
                      onChange={(e) => {
                        const next = [...days];
                        next[weekday] = { ...day, endTime: e.target.value };
                        setDays(next);
                      }}
                    />
                  </label>
                  <label className={styles.check}>
                    <input
                      type="checkbox"
                      checked={day.breakEnabled}
                      onChange={(e) => {
                        const next = [...days];
                        next[weekday] = {
                          ...day,
                          breakEnabled: e.target.checked,
                        };
                        setDays(next);
                      }}
                    />
                    Обед
                  </label>
                  {day.breakEnabled ? (
                    <>
                      <label>
                        Обед с
                        <input
                          type="time"
                          value={day.breakStart}
                          onChange={(e) => {
                            const next = [...days];
                            next[weekday] = {
                              ...day,
                              breakStart: e.target.value,
                            };
                            setDays(next);
                          }}
                        />
                      </label>
                      <label>
                        Обед до
                        <input
                          type="time"
                          value={day.breakEnd}
                          onChange={(e) => {
                            const next = [...days];
                            next[weekday] = {
                              ...day,
                              breakEnd: e.target.value,
                            };
                            setDays(next);
                          }}
                        />
                      </label>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
        <button className={styles.btn} type="submit">
          Сохранить график
        </button>
      </form>

      <div className={styles.panel}>
        <h2 className={styles.title} style={{ fontSize: "1.2rem" }}>
          Портфолио
        </h2>
        <label>
          Добавить фото
          <input
            type="file"
            accept="image/*"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                await adminApi.uploadPortfolio(id, file);
                setOk("Фото портфолио добавлено");
                setTick((n) => n + 1);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Ошибка");
              }
            }}
          />
        </label>
        <div className={styles.photos}>
          {portfolio.map((p) => (
            <div key={p.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.imageUrl} alt="" />
              <button
                type="button"
                className={styles.btnDanger}
                style={{ width: "100%", marginTop: 6 }}
                onClick={() =>
                  void adminApi
                    .deletePortfolio(id, p.id)
                    .then(() => setTick((n) => n + 1))
                }
              >
                Удалить
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
