"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { shop } from "@/data/mock";
import styles from "./Header.module.css";

const links = [
  { href: "#services", label: "Услуги" },
  { href: "#barbers", label: "Барберы" },
  { href: "#reviews", label: "Отзывы" },
  { href: "#contacts", label: "Контакты" },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={`${styles.header} ${scrolled ? styles.scrolled : ""} ${
        open ? styles.open : ""
      }`}
    >
      <div className={`container ${styles.inner}`}>
        <a href="#top" className={styles.brand} aria-label={shop.name}>
          {shop.name}
        </a>

        <nav className={styles.nav} aria-label="Основная навигация">
          {links.map((link) => (
            <a key={link.href} href={link.href} onClick={() => setOpen(false)}>
              {link.label}
            </a>
          ))}
        </nav>

        <div className={styles.actions}>
          <Link href="/book" className={`btn btn--primary ${styles.cta}`}>
            Записаться
          </Link>
          <button
            type="button"
            className={styles.burger}
            aria-label={open ? "Закрыть меню" : "Открыть меню"}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            <span />
            <span />
          </button>
        </div>
      </div>

      <div className={styles.mobile} hidden={!open}>
        <nav aria-label="Мобильная навигация">
          {links.map((link) => (
            <a key={link.href} href={link.href} onClick={() => setOpen(false)}>
              {link.label}
            </a>
          ))}
          <Link
            href="/book"
            className="btn btn--primary"
            onClick={() => setOpen(false)}
          >
            Записаться
          </Link>
        </nav>
      </div>
    </header>
  );
}
