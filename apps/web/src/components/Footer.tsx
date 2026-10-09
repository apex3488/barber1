import { shop } from "@/data/mock";
import styles from "./Footer.module.css";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <div>
          <p className={styles.brand}>{shop.name}</p>
          <p className={styles.copy}>
            © {year} Барбершоп {shop.name}. Учебный проект.
          </p>
        </div>
        <div className={styles.links}>
          <a href={shop.phoneHref}>{shop.phone}</a>
          <a href="#services">Услуги</a>
          <a href="#contacts">Контакты</a>
        </div>
      </div>
    </footer>
  );
}
