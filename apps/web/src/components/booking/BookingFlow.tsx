"use client";

import {
  useEffect,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { ANY_BARBER_ID, formatDateLabel, formatPrice, shop } from "@/data/mock";
import {
  ApiError,
  createBooking,
  fetchAvailability,
  fetchAvailabilityDays,
  fetchBarbers,
  fetchServices,
  tashkentToIso,
  type ApiBarber,
  type ApiService,
} from "@/lib/api";
import {
  createInitialDraft,
  isValidName,
  isValidPhone,
  normalizePhone,
  STEP_LABELS,
  STEP_ORDER,
  type BookingDraft,
  type BookingStep,
  type SlotsState,
} from "@/lib/booking";
import styles from "./BookingFlow.module.css";

type CatalogState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; services: ApiService[]; barbers: ApiBarber[] };

type DaysState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; days: string[] }
  | { status: "empty" }
  | { status: "error"; message: string };

export function BookingFlow() {
  const [step, setStep] = useState<BookingStep>("service");
  const [draft, setDraft] = useState<BookingDraft>(createInitialDraft);
  const [catalog, setCatalog] = useState<CatalogState>({ status: "loading" });
  const [days, setDays] = useState<DaysState>({ status: "idle" });
  const [slots, setSlots] = useState<SlotsState>({ status: "idle" });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; phone?: string }>(
    {},
  );
  const [isSubmitting, startSubmit] = useTransition();
  const [manageToken, setManageToken] = useState<string | null>(null);
  const [botUsername, setBotUsername] = useState<string | null>(null);

  const services = catalog.status === "ready" ? catalog.services : [];
  const barbers = catalog.status === "ready" ? catalog.barbers : [];

  const selectedService = services.find((item) => item.id === draft.serviceId);
  const selectedBarber =
    draft.barberId === ANY_BARBER_ID
      ? null
      : barbers.find((item) => item.id === draft.barberId);

  const progressSteps = STEP_ORDER.filter((item) => item !== "done");
  const currentIndex = progressSteps.indexOf(
    step === "done" ? "contacts" : step,
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchServices(), fetchBarbers()])
      .then(([nextServices, nextBarbers]) => {
        if (cancelled) return;
        setCatalog({
          status: "ready",
          services: nextServices,
          barbers: nextBarbers,
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setCatalog({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Не удалось загрузить данные для записи",
        });
      });

    fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/api/v1/telegram/bot`,
    )
      .then((res) => res.json())
      .then((json: { data?: { username?: string | null } }) => {
        if (!cancelled) setBotUsername(json.data?.username ?? null);
      })
      .catch(() => {
        // optional
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (step !== "date" || !draft.serviceId || !draft.barberId) return;
    let cancelled = false;
    setDays({ status: "loading" });

    fetchAvailabilityDays({
      serviceIds: [draft.serviceId],
      barberId: draft.barberId,
    })
      .then((items) => {
        if (cancelled) return;
        if (items.length === 0) setDays({ status: "empty" });
        else setDays({ status: "ready", days: items });
      })
      .catch((error) => {
        if (cancelled) return;
        setDays({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Не удалось загрузить даты",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [step, draft.serviceId, draft.barberId]);

  useEffect(() => {
    if (step !== "time" || !draft.serviceId || !draft.barberId || !draft.date) {
      return;
    }

    let cancelled = false;
    setSlots({ status: "loading" });

    fetchAvailability({
      serviceIds: [draft.serviceId],
      barberId: draft.barberId,
      date: draft.date,
    })
      .then((items) => {
        if (cancelled) return;
        if (items.length === 0) setSlots({ status: "empty" });
        else setSlots({ status: "ready", slots: items });
      })
      .catch((error) => {
        if (cancelled) return;
        setSlots({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Не удалось загрузить свободное время",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [step, draft.serviceId, draft.barberId, draft.date]);

  function updateDraft(patch: Partial<BookingDraft>) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  function goTo(next: BookingStep) {
    setSubmitError(null);
    setStep(next);
  }

  function goBack() {
    if (step === "service") return;
    const index = STEP_ORDER.indexOf(step);
    goTo(STEP_ORDER[Math.max(0, index - 1)]);
  }

  function reloadCatalog() {
    setCatalog({ status: "loading" });
    Promise.all([fetchServices(), fetchBarbers()])
      .then(([nextServices, nextBarbers]) => {
        setCatalog({
          status: "ready",
          services: nextServices,
          barbers: nextBarbers,
        });
      })
      .catch((error) => {
        setCatalog({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Не удалось загрузить данные для записи",
        });
      });
  }

  function handleSubmitContacts() {
    const nextErrors: { name?: string; phone?: string } = {};
    if (!isValidName(draft.name)) {
      nextErrors.name = "Введите имя — минимум 2 символа";
    }
    if (!isValidPhone(draft.phone)) {
      nextErrors.phone = "Введите телефон в формате +998...";
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    if (!draft.serviceId || !draft.barberId || !draft.date || !draft.time) {
      setSubmitError("Заполните все шаги записи");
      return;
    }

    setSubmitError(null);
    startSubmit(async () => {
      try {
        const booking = await createBooking({
          serviceIds: [draft.serviceId!],
          barberId: draft.barberId!,
          startsAt: tashkentToIso(draft.date!, draft.time!),
          client: {
            name: draft.name.trim(),
            phone: draft.phone,
          },
        });
        setManageToken(booking.manageToken);
        goTo("done");
      } catch (error) {
        if (error instanceof ApiError && error.code === "SLOT_TAKEN") {
          setSubmitError("Этот слот уже занят. Выберите другое время.");
          return;
        }
        setSubmitError(
          error instanceof Error
            ? error.message
            : "Не удалось создать запись. Попробуйте ещё раз.",
        );
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

      {step !== "done" && (
        <ol className={styles.progress} aria-label="Шаги записи">
          {progressSteps.map((item, index) => (
            <li
              key={item}
              className={`${styles.progressItem} ${
                index <= currentIndex ? styles.progressActive : ""
              }`}
            >
              <span>{index + 1}</span>
              <em>{STEP_LABELS[item]}</em>
            </li>
          ))}
        </ol>
      )}

      <div className={styles.layout}>
        <section className={styles.main} aria-live="polite">
          {catalog.status === "loading" && (
            <StateBox
              title="Загружаем услуги и барберов…"
              text="Подключаемся к API."
              tone="loading"
            />
          )}

          {catalog.status === "error" && (
            <StateBox
              title="Не удалось загрузить каталог"
              text={catalog.message}
              tone="error"
              actionLabel="Повторить"
              onAction={reloadCatalog}
            />
          )}

          {catalog.status === "ready" && step === "service" && (
            <StepFrame
              title="Выберите услугу"
              lead="Один шаг — и перейдёте к выбору мастера."
            >
              <ul className={styles.choiceList}>
                {services.map((service) => {
                  const active = draft.serviceId === service.id;
                  return (
                    <li key={service.id}>
                      <button
                        type="button"
                        className={`${styles.choice} ${active ? styles.choiceActive : ""}`}
                        onClick={() => {
                          updateDraft({
                            serviceId: service.id,
                            time: null,
                            date: null,
                          });
                          goTo("barber");
                        }}
                      >
                        <span className={styles.choiceTitle}>{service.name}</span>
                        <span className={styles.choiceMeta}>
                          {service.durationMin} мин · {formatPrice(service.price)}
                        </span>
                        <span className={styles.choiceDesc}>
                          {service.description}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </StepFrame>
          )}

          {catalog.status === "ready" && step === "barber" && (
            <StepFrame
              title="Выберите барбера"
              lead="Можно указать мастера или взять любого свободного."
              onBack={goBack}
            >
              <ul className={styles.barberGrid}>
                <li>
                  <button
                    type="button"
                    className={`${styles.barberCard} ${
                      draft.barberId === ANY_BARBER_ID ? styles.choiceActive : ""
                    }`}
                    onClick={() => {
                      updateDraft({
                        barberId: ANY_BARBER_ID,
                        time: null,
                        date: null,
                      });
                      goTo("date");
                    }}
                  >
                    <div className={styles.anyAvatar} aria-hidden="true">
                      ★
                    </div>
                    <div>
                      <strong>Любой свободный</strong>
                      <p>Подберём первого доступного мастера</p>
                    </div>
                  </button>
                </li>
                {barbers.map((barber) => (
                  <li key={barber.id}>
                    <button
                      type="button"
                      className={`${styles.barberCard} ${
                        draft.barberId === barber.id ? styles.choiceActive : ""
                      }`}
                      onClick={() => {
                        updateDraft({
                          barberId: barber.id,
                          time: null,
                          date: null,
                        });
                        goTo("date");
                      }}
                    >
                      <div className={styles.barberPhoto}>
                        {barber.photoUrl ? (
                          <Image
                            src={barber.photoUrl}
                            alt={barber.name}
                            fill
                            sizes="80px"
                          />
                        ) : null}
                      </div>
                      <div>
                        <strong>{barber.name}</strong>
                        <p>Опыт {barber.experienceYears} лет</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </StepFrame>
          )}

          {catalog.status === "ready" && step === "date" && (
            <StepFrame
              title="Выберите дату"
              lead="Показываем только дни со свободными слотами."
              onBack={goBack}
            >
              {days.status === "loading" && (
                <StateBox
                  title="Ищем свободные дни…"
                  text="Считаем доступность по расписанию."
                  tone="loading"
                />
              )}
              {days.status === "empty" && (
                <StateBox
                  title="Нет свободных дней"
                  text="Попробуйте другого барбера или услугу."
                  actionLabel="К барберам"
                  onAction={() => goTo("barber")}
                />
              )}
              {days.status === "error" && (
                <StateBox
                  title="Ошибка"
                  text={days.message}
                  tone="error"
                  actionLabel="Повторить"
                  onAction={() => goTo("date")}
                />
              )}
              {days.status === "ready" && (
                <div className={styles.dateGrid}>
                  {days.days.map((iso) => {
                    const active = draft.date === iso;
                    return (
                      <button
                        key={iso}
                        type="button"
                        className={`${styles.dateBtn} ${active ? styles.choiceActive : ""}`}
                        onClick={() => {
                          updateDraft({ date: iso, time: null });
                          goTo("time");
                        }}
                      >
                        {formatDateLabel(iso)}
                      </button>
                    );
                  })}
                </div>
              )}
            </StepFrame>
          )}

          {catalog.status === "ready" && step === "time" && (
            <StepFrame
              title="Выберите время"
              lead={
                draft.date
                  ? `Свободные слоты на ${formatDateLabel(draft.date)}`
                  : "Сначала выберите дату"
              }
              onBack={goBack}
            >
              {slots.status === "loading" && (
                <StateBox
                  title="Загружаем слоты…"
                  text="Учитываем график, обеды и занятость."
                  tone="loading"
                />
              )}
              {slots.status === "empty" && (
                <StateBox
                  title="Нет свободного времени"
                  text="На эту дату слотов нет. Выберите другой день."
                  actionLabel="Выбрать другую дату"
                  onAction={() => goTo("date")}
                />
              )}
              {slots.status === "error" && (
                <StateBox
                  title="Ошибка загрузки"
                  text={slots.message}
                  tone="error"
                  actionLabel="Повторить"
                  onAction={() => goTo("time")}
                />
              )}
              {slots.status === "ready" && (
                <div className={styles.timeGrid}>
                  {slots.slots.map((slot) => {
                    const active = draft.time === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        className={`${styles.timeBtn} ${active ? styles.choiceActive : ""}`}
                        onClick={() => {
                          updateDraft({ time: slot });
                          goTo("contacts");
                        }}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
              )}
            </StepFrame>
          )}

          {catalog.status === "ready" && step === "contacts" && (
            <StepFrame
              title="Контакты"
              lead="Как к вам обращаться и куда написать подтверждение."
              onBack={goBack}
            >
              <form
                className={styles.form}
                onSubmit={(event) => {
                  event.preventDefault();
                  handleSubmitContacts();
                }}
              >
                <label className={styles.field}>
                  <span>Имя</span>
                  <input
                    type="text"
                    name="name"
                    autoComplete="name"
                    placeholder="Иван"
                    value={draft.name}
                    onChange={(event) =>
                      updateDraft({ name: event.target.value })
                    }
                  />
                  {fieldErrors.name && (
                    <em className={styles.fieldError}>{fieldErrors.name}</em>
                  )}
                </label>

                <label className={styles.field}>
                  <span>Телефон</span>
                  <input
                    type="tel"
                    name="phone"
                    autoComplete="tel"
                    placeholder="+998 90 123 45 67"
                    value={draft.phone}
                    onChange={(event) =>
                      updateDraft({
                        phone: normalizePhone(event.target.value),
                      })
                    }
                  />
                  {fieldErrors.phone && (
                    <em className={styles.fieldError}>{fieldErrors.phone}</em>
                  )}
                </label>

                {submitError && (
                  <StateBox title="Не получилось" text={submitError} tone="error" />
                )}

                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Создаём запись…" : "Подтвердить запись"}
                </button>
              </form>
            </StepFrame>
          )}

          {catalog.status === "ready" && step === "done" && (
            <StepFrame
              title="Запись подтверждена"
              lead="Запись сохранена в базе. Можно открыть страницу управления."
            >
              <div className={styles.success}>
                <p>
                  {draft.name}, ждём вас{" "}
                  {draft.date ? formatDateLabel(draft.date) : ""} в {draft.time}.
                </p>
                {manageToken && botUsername && (
                  <p className={styles.token}>
                    Привязать Telegram:{" "}
                    <a
                      href={`https://t.me/${botUsername}?start=b_${manageToken}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      открыть бота
                    </a>
                  </p>
                )}
                <div className={styles.successActions}>
                  {manageToken && (
                    <Link
                      href={`/booking/${manageToken}`}
                      className="btn btn--primary"
                    >
                      Управление записью
                    </Link>
                  )}
                  <Link href="/" className="btn btn--ink">
                    На главную
                  </Link>
                </div>
              </div>
            </StepFrame>
          )}
        </section>

        <aside className={styles.summary} aria-label="Сводка записи">
          <h2>Ваша запись</h2>
          <dl>
            <div>
              <dt>Услуга</dt>
              <dd>{selectedService?.name ?? "—"}</dd>
            </div>
            <div>
              <dt>Барбер</dt>
              <dd>
                {draft.barberId === ANY_BARBER_ID
                  ? "Любой свободный"
                  : (selectedBarber?.name ?? "—")}
              </dd>
            </div>
            <div>
              <dt>Дата</dt>
              <dd>{draft.date ? formatDateLabel(draft.date) : "—"}</dd>
            </div>
            <div>
              <dt>Время</dt>
              <dd>{draft.time ?? "—"}</dd>
            </div>
            <div>
              <dt>Длительность</dt>
              <dd>
                {selectedService ? `${selectedService.durationMin} мин` : "—"}
              </dd>
            </div>
            <div>
              <dt>Цена</dt>
              <dd>
                {selectedService ? formatPrice(selectedService.price) : "—"}
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
}

function StepFrame({
  title,
  lead,
  onBack,
  children,
}: {
  title: string;
  lead: string;
  onBack?: () => void;
  children: ReactNode;
}) {
  return (
    <div className={styles.step}>
      {onBack && (
        <button type="button" className={styles.stepBack} onClick={onBack}>
          ← Назад
        </button>
      )}
      <h1>{title}</h1>
      <p className={styles.lead}>{lead}</p>
      {children}
    </div>
  );
}

function StateBox({
  title,
  text,
  tone = "neutral",
  actionLabel,
  onAction,
}: {
  title: string;
  text: string;
  tone?: "neutral" | "loading" | "error";
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className={`${styles.state} ${styles[`state_${tone}`]}`}>
      {tone === "loading" && <span className={styles.spinner} aria-hidden="true" />}
      <strong>{title}</strong>
      <p>{text}</p>
      {actionLabel && onAction && (
        <button type="button" className="btn btn--ink" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
