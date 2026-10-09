import type { Metadata } from "next";
import { BookingFlow } from "@/components/booking/BookingFlow";
import { shop } from "@/data/mock";

export const metadata: Metadata = {
  title: `Запись — ${shop.name}`,
  description: "Онлайн-запись в барбершоп: услуга, мастер, дата и время.",
};

export default function BookPage() {
  return (
    <main>
      <BookingFlow />
    </main>
  );
}
