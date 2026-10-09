import { formatPrice } from "@/data/mock";
import { fetchServices } from "@/lib/api";
import { Reveal } from "./Reveal";
import styles from "./Services.module.css";

export async function Services() {
  let services: Awaited<ReturnType<typeof fetchServices>> = [];
  let error: string | null = null;

  try {
    services = await fetchServices();
  } catch (err) {
    error = err instanceof Error ? err.message : "Не удалось загрузить услуги";
  }

  return (
    <section className="section" id="services">
      <div className="container">
        <Reveal>
          <div className="section__head">
            <p className="section__eyebrow">Прайс</p>
            <h2 className="section__title">Услуги</h2>
            <p className="section__lead">
              Выберите услугу и запишитесь онлайн — без звонков и ожидания.
            </p>
          </div>
        </Reveal>

        {error && (
          <p className={styles.error}>
            {error}. Проверьте, что API запущен и база заполнена.
          </p>
        )}

        {!error && services.length === 0 && (
          <p className={styles.empty}>Услуги пока не добавлены.</p>
        )}

        {!error && services.length > 0 && (
          <ul className={styles.list}>
            {services.map((service, index) => (
              <Reveal key={service.id} delayMs={index * 60}>
                <li className={styles.item}>
                  <div className={styles.main}>
                    <h3>{service.name}</h3>
                    <p>{service.description}</p>
                  </div>
                  <div className={styles.meta}>
                    <span>{service.durationMin} мин</span>
                    <strong>{formatPrice(service.price)}</strong>
                  </div>
                </li>
              </Reveal>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
