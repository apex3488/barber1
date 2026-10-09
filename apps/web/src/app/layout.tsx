import type { Metadata } from "next";
import { Literata, Manrope, Unbounded } from "next/font/google";
import { shop } from "@/data/mock";
import "./globals.css";

const display = Unbounded({
  variable: "--font-display",
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600", "700", "800"],
});

const body = Literata({
  variable: "--font-body",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
});

const ui = Manrope({
  variable: "--font-ui",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: `${shop.name} — барбершоп в Ташкенте`,
  description: shop.description,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${display.variable} ${body.variable} ${ui.variable}`}>
      <body>{children}</body>
    </html>
  );
}
