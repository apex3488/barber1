/**
 * Integration race test:
 * два параллельных POST /bookings на один слот → ровно один 201 и один 409.
 *
 * Запуск: npm run test:race -w @barber/api
 * Требует работающий API и заполненную БД.
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), "../../.env") });

const API = process.env.API_URL ?? "http://localhost:3001";

async function main() {
  const servicesRes = await fetch(`${API}/api/v1/services`);
  const servicesJson = (await servicesRes.json()) as {
    data: Array<{ id: string; durationMin: number }>;
  };
  const serviceId = servicesJson.data[0]?.id;
  if (!serviceId) throw new Error("Нет услуг");

  const barbersRes = await fetch(`${API}/api/v1/barbers`);
  const barbersJson = (await barbersRes.json()) as {
    data: Array<{ id: string }>;
  };
  const barberId = barbersJson.data[0]?.id;
  if (!barberId) throw new Error("Нет барберов");

  // ищем дату со слотами в горизонте
  const daysRes = await fetch(
    `${API}/api/v1/availability/days?serviceIds=${serviceId}&barberId=${barberId}`,
  );
  const daysJson = (await daysRes.json()) as { data: { days: string[] } };
  const date = daysJson.data.days[0];
  if (!date) throw new Error("Нет доступных дней");

  const slotsRes = await fetch(
    `${API}/api/v1/availability?serviceIds=${serviceId}&barberId=${barberId}&date=${date}`,
  );
  const slotsJson = (await slotsRes.json()) as {
    data: { slots: string[] };
  };
  const time = slotsJson.data.slots[0];
  if (!time) throw new Error("Нет слотов");

  const startsAt = new Date(`${date}T${time}:00+05:00`).toISOString();
  const body = {
    serviceIds: [serviceId],
    barberId,
    startsAt,
    client: { name: "Race Test", phone: `+99890${Date.now().toString().slice(-7)}` },
  };

  const body2 = {
    ...body,
    client: { name: "Race Test 2", phone: `+99891${Date.now().toString().slice(-7)}` },
  };

  const [a, b] = await Promise.all([
    fetch(`${API}/api/v1/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    fetch(`${API}/api/v1/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body2),
    }),
  ]);

  const statuses = [a.status, b.status].sort();
  console.log("statuses:", statuses);

  if (statuses[0] === 201 && statuses[1] === 409) {
    console.log("PASS: ровно один 201 и один 409");
    process.exit(0);
  }

  console.error("FAIL: ожидались статусы 201 и 409");
  console.error(await a.text());
  console.error(await b.text());
  process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
