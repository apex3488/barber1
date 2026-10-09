import WebApp from "@twa-dev/sdk";

export type ThemeVars = {
  bg: string;
  text: string;
  hint: string;
  button: string;
  buttonText: string;
  secondary: string;
  sectionBg: string;
  destructive: string;
};

export function initTelegram() {
  try {
    WebApp.ready();
    WebApp.expand();
  } catch {
    // вне Telegram — ок для локальной разработки
  }
}

export function getInitData(): string {
  const real = WebApp.initData;
  if (real) return real;

  // Локальный dev без Telegram
  if (import.meta.env.DEV) {
    return "dev:1001:Абдулла";
  }
  return "";
}

export function getThemeVars(): ThemeVars {
  const t = WebApp.themeParams;
  return {
    bg: t.bg_color || "#0f1210",
    text: t.text_color || "#f2eee4",
    hint: t.hint_color || "#9aa39b",
    button: t.button_color || "#c47a2c",
    buttonText: t.button_text_color || "#111111",
    secondary: t.secondary_bg_color || "#1a201c",
    sectionBg: t.section_bg_color || t.secondary_bg_color || "#1a201c",
    destructive: t.destructive_text_color || "#ff6b6b",
  };
}

export function applyThemeToDocument(theme: ThemeVars) {
  const root = document.documentElement;
  root.style.setProperty("--tg-bg", theme.bg);
  root.style.setProperty("--tg-text", theme.text);
  root.style.setProperty("--tg-hint", theme.hint);
  root.style.setProperty("--tg-button", theme.button);
  root.style.setProperty("--tg-button-text", theme.buttonText);
  root.style.setProperty("--tg-secondary", theme.secondary);
  root.style.setProperty("--tg-section", theme.sectionBg);
  root.style.setProperty("--tg-danger", theme.destructive);
  document.body.style.background = theme.bg;
  document.body.style.color = theme.text;
}

export function haptic(type: "light" | "success" | "error" = "light") {
  try {
    if (type === "success") WebApp.HapticFeedback.notificationOccurred("success");
    else if (type === "error") WebApp.HapticFeedback.notificationOccurred("error");
    else WebApp.HapticFeedback.impactOccurred("light");
  } catch {
    // ignore
  }
}

export { WebApp };
