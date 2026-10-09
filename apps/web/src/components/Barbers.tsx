import Image from "next/image";
import { fetchBarbers } from "@/lib/api";
import { Reveal } from "./Reveal";
import styles from "./Barbers.module.css";

export async function Barbers() {
  let barbers: Awaited<ReturnType<typeof fetchBarbers>> = [];
  let error: string | null = null;

  try {
    barbers = await fetchBarbers();
  } catch (err) {
    error = err instanceof Error ? err.message : "Не удалось загрузить барберов";
  }

  return (
    <section className={`section ${styles.section}`} id="barbers">
      <div className="container">
        <Reveal>
          <div className="section__head">
            <p className="section__eyebrow">Команда</p>
            <h2 className="section__title">Барберы</h2>
            <p className="section__lead">
              Мастера, с которыми можно записаться напрямую или выбрать любого
              свободного.
            </p>
          </div>
        </Reveal>

        {error && (
          <p className={styles.error}>
            {error}. Проверьте, что API запущен и база заполнена.
          </p>
        )}

        {!error && barbers.length === 0 && (
          <p className={styles.empty}>Барберы пока не добавлены.</p>
        )}

        {!error && barbers.length > 0 && (
          <div className={styles.grid}>
            {barbers.map((barber, index) => (
              <Reveal key={barber.id} delayMs={index * 80}>
                <article className={styles.person}>
                  <div className={styles.photo}>
                    {barber.photoUrl ? (
                      <Image
                        src={barber.photoUrl}
                        alt={barber.name}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                      />
                    ) : null}
                  </div>
                  <div className={styles.body}>
                    <h3>{barber.name}</h3>
                    <p className={styles.exp}>
                      Опыт {barber.experienceYears} лет
                    </p>
                    <p className={styles.bio}>{barber.bio}</p>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
