export function formatBookingWhen(startsAt: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Tashkent",
    weekday: "short",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(startsAt);
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("ru-RU").format(price) + " сум";
}
