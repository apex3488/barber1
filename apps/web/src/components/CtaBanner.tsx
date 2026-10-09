import Link from "next/link";
import { Reveal } from "./Reveal";
import styles from "./CtaBanner.module.css";

export function CtaBanner() {
  return (
    <section className={styles.cta} aria-labelledby="cta-title">
      <div className={`container ${styles.inner}`}>
        <Reveal>
          <p className={styles.eyebrow}>Онлайн-запись</p>
          <h2 id="cta-title" className={styles.title}>
            Готовы к новой стрижке?
          </h2>
          <p className={styles.lead}>
            Выберите услугу, мастера и удобное время — займёт пару минут.
          </p>
          <Link href="/book" className="btn btn--primary">
            Записаться
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
