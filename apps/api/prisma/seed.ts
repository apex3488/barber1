import { config } from "dotenv";
import { resolve } from "node:path";
import { PrismaClient, TimeOffType } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { hash } from "argon2";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), "../../.env") });

const prisma = new PrismaClient();

const WEEKDAYS = [1, 2, 3, 4, 5, 6]; // Пн–Сб

async function main() {
  await prisma.review.deleteMany();
  await prisma.bookingService.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.client.deleteMany();
  await prisma.timeOff.deleteMany();
  await prisma.break.deleteMany();
  await prisma.workingHours.deleteMany();
  await prisma.barberService.deleteMany();
  await prisma.portfolioItem.deleteMany();
  await prisma.service.deleteMany();
  await prisma.barber.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.adminUser.deleteMany();

  const services = await Promise.all([
    prisma.service.create({
      data: {
        name: "Классическая стрижка",
        description: "Форма, текстура и чистый контур под ваш стиль.",
        durationMin: 45,
        price: 120000,
        sortOrder: 1,
      },
    }),
    prisma.service.create({
      data: {
        name: "Стрижка + борода",
        description: "Полный образ: стрижка, моделирование и уход за бородой.",
        durationMin: 75,
        price: 180000,
        sortOrder: 2,
      },
    }),
    prisma.service.create({
      data: {
        name: "Оформление бороды",
        description: "Линии, объём и финиш с маслами.",
        durationMin: 30,
        price: 90000,
        sortOrder: 3,
      },
    }),
    prisma.service.create({
      data: {
        name: "Королевское бритьё",
        description: "Горячее полотенце, опасная бритва и точный финиш.",
        durationMin: 40,
        price: 140000,
        sortOrder: 4,
      },
    }),
    prisma.service.create({
      data: {
        name: "Детская стрижка",
        description: "Аккуратная стрижка для мальчиков до 12 лет.",
        durationMin: 30,
        price: 80000,
        sortOrder: 5,
      },
    }),
  ]);

  const barbers = await Promise.all([
    prisma.barber.create({
      data: {
        name: "Азиз Каримов",
        photoUrl:
          "https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=900&q=80",
        bio: "Специалист по классике и fade. Любит чистые линии и спокойный ритм работы.",
        experienceYears: 8,
        sortOrder: 1,
      },
    }),
    prisma.barber.create({
      data: {
        name: "Жасур Рахимов",
        photoUrl:
          "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=900&q=80",
        bio: "Бороды, текстурные стрижки и современный мужской стиль.",
        experienceYears: 6,
        sortOrder: 2,
      },
    }),
    prisma.barber.create({
      data: {
        name: "Тимур Алиев",
        photoUrl:
          "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=900&q=80",
        bio: "Точность, скорость и внимание к деталям. Работает с любым типом волос.",
        experienceYears: 5,
        sortOrder: 3,
      },
    }),
  ]);

  for (const barber of barbers) {
    await prisma.barberService.createMany({
      data: services.map((service) => ({
        barberId: barber.id,
        serviceId: service.id,
        isEnabled: true,
      })),
    });

    await prisma.workingHours.createMany({
      data: WEEKDAYS.map((weekday) => ({
        barberId: barber.id,
        weekday,
        startTime: "10:00",
        endTime: "21:00",
      })),
    });

    await prisma.break.createMany({
      data: WEEKDAYS.map((weekday) => ({
        barberId: barber.id,
        weekday,
        startTime: "13:00",
        endTime: "14:00",
      })),
    });
  }

  await prisma.timeOff.create({
    data: {
      barberId: null,
      startsAt: new Date("2026-12-31T00:00:00+05:00"),
      endsAt: new Date("2027-01-01T23:59:59+05:00"),
      type: TimeOffType.shop_closed,
      note: "Новогодние выходные",
    },
  });

  const settings: Array<{ key: string; value: string }> = [
    { key: "cancel_cutoff_min", value: "30" },
    { key: "slot_step_min", value: "15" },
    { key: "booking_horizon_days", value: "30" },
    { key: "min_notice_min", value: "30" },
    { key: "reminder_day_minutes", value: "1440" },
    { key: "reminder_short_minutes", value: "30" },
    { key: "review_delay_min", value: "60" },
    { key: "timezone", value: "Asia/Tashkent" },
    { key: "review_public_min_rating", value: "4" },
  ];

  await prisma.setting.createMany({ data: settings });

  const passwordHash = await hash("admin123");
  await prisma.adminUser.create({
    data: {
      login: "admin",
      passwordHash,
    },
  });
  console.log("Admin created: login=admin password=admin123");

  const publicReviews = [
    {
      name: "Игорь",
      phone: "+998901111111",
      rating: 5,
      comment:
        "Записался онлайн за две минуты. Стрижка ровная, атмосфера спокойная — вернусь.",
    },
    {
      name: "Санжар",
      phone: "+998902222222",
      rating: 5,
      comment: "Азиз отлично попал в форму. Никакой суеты, всё чётко и по делу.",
    },
    {
      name: "Дмитрий",
      phone: "+998903333333",
      rating: 5,
      comment:
        "Бороду сделали идеально. Удобно, что можно выбрать время без звонков.",
    },
  ];

  for (const [index, item] of publicReviews.entries()) {
    const client = await prisma.client.create({
      data: { name: item.name, phone: item.phone },
    });
    const barber = barbers[index % barbers.length];
    const service = services[0];
    const startsAt = new Date();
    startsAt.setDate(startsAt.getDate() - (index + 3));
    startsAt.setHours(11, 0, 0, 0);
    const endsAt = new Date(startsAt.getTime() + service.durationMin * 60_000);

    const booking = await prisma.booking.create({
      data: {
        clientId: client.id,
        barberId: barber.id,
        startsAt,
        endsAt,
        totalPrice: service.price,
        totalDurationMin: service.durationMin,
        status: "completed",
        source: "web",
        manageToken: randomBytes(16).toString("hex"),
        services: {
          create: {
            serviceId: service.id,
            name: service.name,
            durationMin: service.durationMin,
            price: service.price,
          },
        },
      },
    });

    await prisma.review.create({
      data: {
        bookingId: booking.id,
        barberId: barber.id,
        clientId: client.id,
        rating: item.rating,
        comment: item.comment,
        isPublic: true,
      },
    });
  }

  console.log("Seed completed:");
  console.log(`- services: ${services.length}`);
  console.log(`- barbers: ${barbers.length}`);
  console.log(`- settings: ${settings.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
