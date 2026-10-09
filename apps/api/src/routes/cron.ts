import type { FastifyPluginAsync } from "fastify";
import { runNotificationsJob } from "../jobs/notifications.js";

export const cronRoutes: FastifyPluginAsync = async (app) => {
  app.post("/internal/cron/notifications", async (request, reply) => {
    const secret = process.env.CRON_SECRET;
    const header = request.headers["x-cron-secret"];
    if (!secret || header !== secret) {
      return reply.status(401).send({
        code: "UNAUTHORIZED",
        message: "Неверный CRON_SECRET",
      });
    }

    const summary = await runNotificationsJob();
    return { ok: true, summary };
  });
};
