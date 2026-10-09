import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireAdmin } from "../../lib/adminAuth.js";
import { notFound } from "../../lib/errors.js";

const bodySchema = z.object({
  name: z.string().trim().min(2),
  description: z.string().trim().optional().nullable(),
  durationMin: z.number().int().positive(),
  price: z.number().int().nonnegative(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const adminServicesRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", async (request) => {
    await requireAdmin(request);
  });

  app.get("/services", async () => {
    const items = await prisma.service.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return { data: items };
  });

  app.post("/services", async (request, reply) => {
    const body = bodySchema.parse(request.body);
    const item = await prisma.service.create({ data: body });
    return reply.status(201).send({ data: item });
  });

  app.patch("/services/:id", async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = bodySchema.partial().parse(request.body);
    try {
      const item = await prisma.service.update({ where: { id }, data: body });
      return { data: item };
    } catch {
      throw notFound("Услуга не найдена");
    }
  });

  app.delete("/services/:id", async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    try {
      await prisma.service.update({
        where: { id },
        data: { isActive: false },
      });
      return { ok: true };
    } catch {
      throw notFound("Услуга не найдена");
    }
  });
};
