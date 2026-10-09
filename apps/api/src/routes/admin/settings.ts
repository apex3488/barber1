import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireAdmin } from "../../lib/adminAuth.js";

export const adminSettingsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", async (request) => {
    await requireAdmin(request);
  });

  app.get("/settings", async () => {
    const items = await prisma.setting.findMany({ orderBy: { key: "asc" } });
    return { data: Object.fromEntries(items.map((i) => [i.key, i.value])) };
  });

  app.put("/settings", async (request) => {
    const body = z.record(z.string(), z.string()).parse(request.body);
    await prisma.$transaction(
      Object.entries(body).map(([key, value]) =>
        prisma.setting.upsert({
          where: { key },
          create: { key, value },
          update: { value },
        }),
      ),
    );
    const items = await prisma.setting.findMany();
    return { data: Object.fromEntries(items.map((i) => [i.key, i.value])) };
  });
};
