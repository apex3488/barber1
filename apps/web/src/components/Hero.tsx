import Image from "next/image";
import Link from "next/link";
import { shop } from "@/data/mock";
import styles from "./Hero.module.css";

export function Hero() {
  return (
    <section className={styles.hero} id="top" aria-label="Главный экран">
      <div className={styles.media}>
        <Image
          src={shop.heroImage}
          alt="Интерьер барбершопа Атлант"
          fill
          priority
          sizes="100vw"
          className={styles.image}
        />
        <div className={styles.veil} />
      </div>

      <div className={`container ${styles.content}`}>
        <p className={styles.brand}>{shop.name}</p>
        <h1 className={styles.title}>{shop.tagline}</h1>
        <p className={styles.lead}>{shop.description}</p>
        <div className={styles.actions}>
          <Link href="/book" className="btn btn--primary">
            Записаться
          </Link>
          <a href="#services" className="btn btn--ghost">
            Смотреть услуги
          </a>
        </div>
      </div>
    </section>
  );
}
