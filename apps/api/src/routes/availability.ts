import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { badRequest } from "../lib/errors.js";
import {
  getAvailableDays,
  getSlotsForDay,
} from "../services/availability.js";

const querySchema = z.object({
  serviceIds: z.string().min(1),
  barberId: z.string().min(1),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

function parseServiceIds(raw: string) {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export const availabilityRoutes: FastifyPluginAsync = async (app) => {
  app.get("/availability", async (request) => {
    const query = querySchema.parse(request.query);
    if (!query.date) {
      throw badRequest("Параметр date обязателен");
    }

    const data = await getSlotsForDay({
      serviceIds: parseServiceIds(query.serviceIds),
      barberId: query.barberId,
      date: query.date,
    });

    return { data };
  });

  app.get("/availability/days", async (request) => {
    const query = querySchema.omit({ date: true }).parse(request.query);
    const data = await getAvailableDays({
      serviceIds: parseServiceIds(query.serviceIds),
      barberId: query.barberId,
    });
    return { data };
  });
};
