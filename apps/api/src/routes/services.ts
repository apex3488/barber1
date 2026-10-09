import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/prisma.js";

export const servicesRoutes: FastifyPluginAsync = async (app) => {
  app.get("/services", async () => {
    const items = await prisma.service.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        durationMin: true,
        price: true,
        sortOrder: true,
      },
    });

    return { data: items };
  });
};
