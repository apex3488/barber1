"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import styles from "./AdminShell.module.css";

const links = [
  { href: "/admin/dashboard", label: "Аналитика" },
  { href: "/admin/bookings", label: "Записи" },
  { href: "/admin/services", label: "Услуги" },
  { href: "/admin/barbers", label: "Барберы" },
  { href: "/admin/time-off", label: "Исключения" },
  { href: "/admin/reviews", label: "Отзывы" },
  { href: "/admin/settings", label: "Настройки" },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/admin/login";
  const [sessionOk, setSessionOk] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isLogin) return;
    let cancelled = false;
    adminApi
      .me()
      .then(() => {
        if (!cancelled) setSessionOk(true);
      })
      .catch(() => {
        if (!cancelled) router.replace("/admin/login");
      });
    return () => {
      cancelled = true;
    };
  }, [isLogin, router, pathname]);

  if (isLogin) return <>{children}</>;
  if (!sessionOk) return <div className={styles.loading}>Проверяем сессию…</div>;

  return (
    <div className={styles.shell}>
      <aside className={`${styles.nav} ${open ? styles.open : ""}`}>
        <div className={styles.brand}>АТЛАНТ · Admin</div>
        <nav>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={pathname.startsWith(link.href) ? styles.active : ""}
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <button
          type="button"
          className={styles.logout}
          onClick={async () => {
            await adminApi.logout();
            router.replace("/admin/login");
          }}
        >
          Выйти
        </button>
      </aside>
      <div className={styles.main}>
        <header className={styles.top}>
          <button
            type="button"
            className={styles.menu}
            onClick={() => setOpen((v) => !v)}
          >
            Меню
          </button>
          <span>Панель управления</span>
        </header>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
