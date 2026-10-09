export type Service = {
  id: string;
  name: string;
  description: string;
  durationMin: number;
  price: number;
};

export type Barber = {
  id: string;
  name: string;
  photoUrl: string;
  bio: string;
  experienceYears: number;
};

export type Review = {
  id: string;
  author: string;
  rating: number;
  comment: string;
};

export const shop = {
  name: "АТЛАНТ",
  tagline: "Мужская стрижка с характером",
  description:
    "Барбершоп в центре Ташкента. Точная техника, спокойная атмосфера и запись без очередей.",
  phone: "+998 90 123 45 67",
  phoneHref: "tel:+998901234567",
  address: "Ташкент, ул. Амира Темура, 15",
  hours: "Ежедневно 10:00–21:00",
  mapEmbedUrl:
    "https://www.openstreetmap.org/export/embed.html?bbox=69.275%2C41.305%2C69.295%2C41.320&layer=mapnik&marker=41.3115%2C69.285",
  heroImage:
    "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=2400&q=80",
};

export const services: Service[] = [
  {
    id: "svc-1",
    name: "Классическая стрижка",
    description: "Форма, текстура и чистый контур под ваш стиль.",
    durationMin: 45,
    price: 120000,
  },
  {
    id: "svc-2",
    name: "Стрижка + борода",
    description: "Полный образ: стрижка, моделирование и уход за бородой.",
    durationMin: 75,
    price: 180000,
  },
  {
    id: "svc-3",
    name: "Оформление бороды",
    description: "Линии, объём и финиш с маслами.",
    durationMin: 30,
    price: 90000,
  },
  {
    id: "svc-4",
    name: "Королевское бритьё",
    description: "Горячее полотенце, опасная бритва и точный финиш.",
    durationMin: 40,
    price: 140000,
  },
  {
    id: "svc-5",
    name: "Детская стрижка",
    description: "Аккуратная стрижка для мальчиков до 12 лет.",
    durationMin: 30,
    price: 80000,
  },
];

export const barbers: Barber[] = [
  {
    id: "brb-1",
    name: "Азиз Каримов",
    photoUrl:
      "https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=900&q=80",
    bio: "Специалист по классике и fade. Любит чистые линии и спокойный ритм работы.",
    experienceYears: 8,
  },
  {
    id: "brb-2",
    name: "Жасур Рахимов",
    photoUrl:
      "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=900&q=80",
    bio: "Бороды, текстурные стрижки и современный мужской стиль.",
    experienceYears: 6,
  },
  {
    id: "brb-3",
    name: "Тимур Алиев",
    photoUrl:
      "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=900&q=80",
    bio: "Точность, скорость и внимание к деталям. Работает с любым типом волос.",
    experienceYears: 5,
  },
];

export const reviews: Review[] = [
  {
    id: "rev-1",
    author: "Игорь",
    rating: 5,
    comment:
      "Записался онлайн за две минуты. Стрижка ровная, атмосфера спокойная — вернусь.",
  },
  {
    id: "rev-2",
    author: "Санжар",
    rating: 5,
    comment:
      "Азиз отлично попал в форму. Никакой суеты, всё чётко и по делу.",
  },
  {
    id: "rev-3",
    author: "Дмитрий",
    rating: 5,
    comment:
      "Бороду сделали идеально. Удобно, что можно выбрать время без звонков.",
  },
];

export const MOCK_TIME_SLOTS = ["10:00", "11:00", "12:00", "14:00", "15:00"] as const;

export const ANY_BARBER_ID = "any";

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("ru-RU").format(price) + " сум";
}

export function formatDateLabel(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "short",
    day: "numeric",
    month: "long",
  }).format(date);
}
