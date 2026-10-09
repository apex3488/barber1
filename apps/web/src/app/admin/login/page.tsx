"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { adminApi } from "@/lib/adminApi";
import styles from "../admin.module.css";

export default function AdminLoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await adminApi.login(login, password);
      router.replace("/admin/bookings");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка входа");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.loginPage}>
      <form className={styles.loginBox} onSubmit={onSubmit}>
        <div className={styles.loginBrand}>АТЛАНТ · Admin</div>
        <p className={styles.muted}>Вход для владельца барбершопа</p>
        <label>
          Логин
          <input
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label>
          Пароль
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error ? <p className={styles.error}>{error}</p> : null}
        <button className={styles.btn} type="submit" disabled={loading}>
          {loading ? "Входим…" : "Войти"}
        </button>
      </form>
    </div>
  );
}
