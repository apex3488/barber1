import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import { ZodError } from "zod";
import { AppError } from "./lib/errors.js";
import { healthRoutes } from "./routes/health.js";
import { servicesRoutes } from "./routes/services.js";
import { barbersRoutes } from "./routes/barbers.js";
import { availabilityRoutes } from "./routes/availability.js";
import { bookingsRoutes } from "./routes/bookings.js";
import { meRoutes } from "./routes/me.js";
import { telegramRoutes } from "./routes/telegram.js";
import { cronRoutes } from "./routes/cron.js";
import { reviewsRoutes } from "./routes/reviews.js";
import { adminRoutes } from "./routes/admin/index.js";

export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

  const origins = (
    process.env.CORS_ORIGINS ??
    "http://localhost:3000,http://localhost:5173"
  )
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  await app.register(cors, {
    origin: origins,
    credentials: true,
  });
  await app.register(cookie);
  await app.register(rateLimit, {
    global: false,
  });
  await app.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024 },
  });

  await app.register(healthRoutes);
  await app.register(servicesRoutes, { prefix: "/api/v1" });
  await app.register(barbersRoutes, { prefix: "/api/v1" });
  await app.register(availabilityRoutes, { prefix: "/api/v1" });
  await app.register(bookingsRoutes, { prefix: "/api/v1" });
  await app.register(meRoutes, { prefix: "/api/v1" });
  await app.register(reviewsRoutes, { prefix: "/api/v1" });
  await app.register(adminRoutes, { prefix: "/api/v1/admin" });
  await app.register(telegramRoutes);
  await app.register(cronRoutes);

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        code: "VALIDATION_ERROR",
        message: "Некорректные данные",
        issues: error.issues,
      });
    }

    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        code: error.code,
        message: error.message,
      });
    }

    app.log.error(error);
    return reply.status(500).send({
      code: "INTERNAL_ERROR",
      message: "Внутренняя ошибка сервера",
    });
  });

  app.setNotFoundHandler((_request, reply) => {
    return reply.status(404).send({
      code: "NOT_FOUND",
      message: "Маршрут не найден",
    });
  });

  return app;
}
