import { useEffect, useMemo, useState } from "react";
import {
  ApiError,
  authTelegram,
  cancelBooking,
  createBooking,
  fetchAvailabilityDays,
  fetchBarbers,
  fetchMyBookings,
  fetchServices,
  fetchSlots,
  formatPrice,
  formatWhen,
  rescheduleBooking,
  tashkentToIso,
  type Barber,
  type Booking,
  type Service,
} from "./api";
import {
  applyThemeToDocument,
  getThemeVars,
  haptic,
  initTelegram,
} from "./telegram";

type Tab = "book" | "mine";
type Step = "service" | "barber" | "date" | "time" | "contacts" | "done";

const ANY = "any";

export default function App() {
  const [tab, setTab] = useState<Tab>("book");
  const [step, setStep] = useState<Step>("service");
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [barberId, setBarberId] = useState<string | null>(null);
  const [days, setDays] = useState<string[]>([]);
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [time, setTime] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rescheduleToken, setRescheduleToken] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleSlots, setRescheduleSlots] = useState<string[]>([]);

  const selectedService = useMemo(
    () => services.find((s) => s.id === serviceId) ?? null,
    [services, serviceId],
  );

  useEffect(() => {
    initTelegram();
    applyThemeToDocument(getThemeVars());
    authTelegram().catch(() => {
      // без токена бота в prod упадёт — в dev работает через dev:initData
    });
    Promise.all([fetchServices(), fetchBarbers()])
      .then(([s, b]) => {
        setServices(s);
        setBarbers(b);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Ошибка"));
  }, []);

  useEffect(() => {
    if (tab !== "mine") return;
    setLoading(true);
    fetchMyBookings()
      .then(setBookings)
      .catch((err) => setError(err instanceof Error ? err.message : "Ошибка"))
      .finally(() => setLoading(false));
  }, [tab]);

  useEffect(() => {
    if (step !== "date" || !serviceId || !barberId) return;
    setLoading(true);
    setError(null);
    fetchAvailabilityDays([serviceId], barberId)
      .then(setDays)
      .catch((err) => setError(err instanceof Error ? err.message : "Ошибка"))
      .finally(() => setLoading(false));
  }, [step, serviceId, barberId]);

  useEffect(() => {
    if (step !== "time" || !serviceId || !barberId || !date) return;
    setLoading(true);
    setError(null);
    fetchSlots([serviceId], barberId, date)
      .then(setSlots)
      .catch((err) => setError(err instanceof Error ? err.message : "Ошибка"))
      .finally(() => setLoading(false));
  }, [step, serviceId, barberId, date]);

  useEffect(() => {
    if (!rescheduleToken || !rescheduleDate) return;
    const booking = bookings.find((b) => b.manageToken === rescheduleToken);
    if (!booking) return;
    const serviceIds = booking.services
      .map((s) => s.serviceId)
      .filter((id): id is string => Boolean(id));
    if (!serviceIds.length) return;
    fetchSlots(serviceIds, booking.barber.id, rescheduleDate)
      .then(setRescheduleSlots)
      .catch(() => setRescheduleSlots([]));
  }, [rescheduleToken, rescheduleDate, bookings]);

  async function submitBooking() {
    if (!serviceId || !barberId || !date || !time) return;
    setLoading(true);
    setError(null);
    try {
      await authTelegram(phone || undefined);
      const booking = await createBooking({
        serviceIds: [serviceId],
        barberId,
        startsAt: tashkentToIso(date, time),
        client: { name: name.trim() || "Клиент", phone: phone.trim() },
      });
      setToken(booking.manageToken);
      setStep("done");
      haptic("success");
    } catch (err) {
      haptic("error");
      if (err instanceof ApiError && err.code === "SLOT_TAKEN") {
        setError("Слот уже занят. Выберите другое время.");
      } else {
        setError(err instanceof Error ? err.message : "Не удалось записаться");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <header className="top">
        <div className="brand">АТЛАНТ</div>
      </header>

      <div className="tabs">
        <button
          type="button"
          className={`tab ${tab === "book" ? "active" : ""}`}
          onClick={() => setTab("book")}
        >
          Запись
        </button>
        <button
          type="button"
          className={`tab ${tab === "mine" ? "active" : ""}`}
          onClick={() => setTab("mine")}
        >
          Мои записи
        </button>
      </div>

      {error && <div className="state error">{error}</div>}

      {tab === "book" && (
        <>
          {step !== "service" && step !== "done" && (
            <button
              type="button"
              className="back"
              onClick={() => {
                const order: Step[] = [
                  "service",
                  "barber",
                  "date",
                  "time",
                  "contacts",
                  "done",
                ];
                const i = order.indexOf(step);
                setStep(order[Math.max(0, i - 1)]);
              }}
            >
              ← Назад
            </button>
          )}

          {step === "service" && (
            <>
              <h1>Услуга</h1>
              <p className="lead">Выберите, что сделать</p>
              <div className="list">
                {services.map((service) => (
                  <button
                    key={service.id}
                    type="button"
                    className={`card ${serviceId === service.id ? "active" : ""}`}
                    onClick={() => {
                      setServiceId(service.id);
                      setBarberId(null);
                      setDate(null);
                      setTime(null);
                      setStep("barber");
                      haptic();
                    }}
                  >
                    <strong>{service.name}</strong>
                    <span>
                      {service.durationMin} мин · {formatPrice(service.price)}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === "barber" && (
            <>
              <h1>Барбер</h1>
              <p className="lead">Или любой свободный</p>
              <div className="list">
                <button
                  type="button"
                  className={`card ${barberId === ANY ? "active" : ""}`}
                  onClick={() => {
                    setBarberId(ANY);
                    setDate(null);
                    setTime(null);
                    setStep("date");
                    haptic();
                  }}
                >
                  <strong>Любой свободный</strong>
                  <span>Подберём доступного мастера</span>
                </button>
                {barbers.map((barber) => (
                  <button
                    key={barber.id}
                    type="button"
                    className={`card ${barberId === barber.id ? "active" : ""}`}
                    onClick={() => {
                      setBarberId(barber.id);
                      setDate(null);
                      setTime(null);
                      setStep("date");
                      haptic();
                    }}
                  >
                    <strong>{barber.name}</strong>
                    <span>Опыт {barber.experienceYears} лет</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === "date" && (
            <>
              <h1>Дата</h1>
              <p className="lead">Только дни со свободными слотами</p>
              {loading && <div className="state">Загружаем даты…</div>}
              {!loading && days.length === 0 && (
                <div className="state">Нет свободных дней</div>
              )}
              <div className="list">
                {days.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`card ${date === d ? "active" : ""}`}
                    onClick={() => {
                      setDate(d);
                      setTime(null);
                      setStep("time");
                      haptic();
                    }}
                  >
                    <strong>{d}</strong>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === "time" && (
            <>
              <h1>Время</h1>
              <p className="lead">{date}</p>
              {loading && <div className="state">Загружаем слоты…</div>}
              {!loading && slots.length === 0 && (
                <div className="state">Нет свободного времени</div>
              )}
              <div className="grid">
                {slots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    className={`chip ${time === slot ? "active" : ""}`}
                    onClick={() => {
                      setTime(slot);
                      setStep("contacts");
                      haptic();
                    }}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === "contacts" && (
            <>
              <h1>Контакты</h1>
              <p className="lead">
                {selectedService?.name} · {date} {time}
              </p>
              <label className="field">
                <span>Имя</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Иван"
                />
              </label>
              <label className="field">
                <span>Телефон</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+998901234567"
                />
              </label>
              <button
                type="button"
                className="btn"
                disabled={loading || phone.trim().length < 9}
                onClick={submitBooking}
              >
                {loading ? "Создаём…" : "Подтвердить"}
              </button>
            </>
          )}

          {step === "done" && (
            <>
              <h1>Готово</h1>
              <p className="lead">Запись создана через Telegram Mini App</p>
              <div className="state">
                {date} {time}
                {token ? ` · код ${token.slice(0, 8)}…` : ""}
              </div>
              <div className="row" style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setTab("mine");
                    setStep("service");
                  }}
                >
                  Мои записи
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => {
                    setServiceId(null);
                    setBarberId(null);
                    setDate(null);
                    setTime(null);
                    setToken(null);
                    setStep("service");
                  }}
                >
                  Новая запись
                </button>
              </div>
            </>
          )}
        </>
      )}

      {tab === "mine" && (
        <>
          <h1>Мои записи</h1>
          {loading && <div className="state">Загружаем…</div>}
          {!loading && bookings.length === 0 && (
            <div className="state">Пока нет записей</div>
          )}
          <div className="list">
            {bookings.map((booking) => (
              <div key={booking.id} className="card">
                <strong>{formatWhen(booking.startsAt)}</strong>
                <p>
                  {booking.services.map((s) => s.name).join(", ")} ·{" "}
                  {booking.barber.name}
                </p>
                <p>
                  {booking.status} · {formatPrice(booking.totalPrice)}
                </p>
                {booking.status === "confirmed" && (
                  <div className="row" style={{ marginTop: 10 }}>
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() => {
                        setRescheduleToken(booking.manageToken);
                        setRescheduleDate(booking.startsAt.slice(0, 10));
                        setError(null);
                      }}
                    >
                      Перенести
                    </button>
                    <button
                      type="button"
                      className="btn danger"
                      onClick={async () => {
                        try {
                          await cancelBooking(booking.manageToken);
                          setBookings(await fetchMyBookings());
                          haptic("success");
                        } catch (err) {
                          haptic("error");
                          setError(
                            err instanceof Error ? err.message : "Ошибка отмены",
                          );
                        }
                      }}
                    >
                      Отменить
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {rescheduleToken && (
            <div style={{ marginTop: 16 }}>
              <h1>Перенос</h1>
              <label className="field">
                <span>Дата</span>
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                />
              </label>
              <div className="grid">
                {rescheduleSlots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    className="chip"
                    onClick={async () => {
                      try {
                        await rescheduleBooking(
                          rescheduleToken,
                          tashkentToIso(rescheduleDate, slot),
                        );
                        setRescheduleToken(null);
                        setBookings(await fetchMyBookings());
                        haptic("success");
                      } catch (err) {
                        haptic("error");
                        if (err instanceof ApiError && err.code === "SLOT_TAKEN") {
                          setError("Слот уже занят");
                        } else {
                          setError(
                            err instanceof Error ? err.message : "Ошибка переноса",
                          );
                        }
                      }
                    }}
                  >
                    {slot}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="btn secondary"
                style={{ marginTop: 10 }}
                onClick={() => setRescheduleToken(null)}
              >
                Закрыть
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
