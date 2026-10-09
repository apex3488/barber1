import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { notFound } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { createBarberLinkCode } from "../services/barberLinks.js";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

export const barbersRoutes: FastifyPluginAsync = async (app) => {
  app.get("/barbers", async () => {
    const items = await prisma.barber.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        photoUrl: true,
        bio: true,
        experienceYears: true,
        sortOrder: true,
      },
    });

    return { data: items };
  });

  app.get("/barbers/:id", async (request) => {
    const { id } = paramsSchema.parse(request.params);

    const barber = await prisma.barber.findFirst({
      where: { id, isActive: true },
      select: {
        id: true,
        name: true,
        photoUrl: true,
        bio: true,
        experienceYears: true,
        sortOrder: true,
        services: {
          where: { isEnabled: true, service: { isActive: true } },
          select: {
            durationMin: true,
            price: true,
            service: {
              select: {
                id: true,
                name: true,
                description: true,
                durationMin: true,
                price: true,
              },
            },
          },
        },
        portfolioItems: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            imageUrl: true,
            sortOrder: true,
          },
        },
      },
    });

    if (!barber) {
      throw notFound("Барбер не найден");
    }

    return {
      data: {
        id: barber.id,
        name: barber.name,
        photoUrl: barber.photoUrl,
        bio: barber.bio,
        experienceYears: barber.experienceYears,
        sortOrder: barber.sortOrder,
        portfolio: barber.portfolioItems,
        services: barber.services.map((item) => ({
          id: item.service.id,
          name: item.service.name,
          description: item.service.description,
          durationMin: item.durationMin ?? item.service.durationMin,
          price: item.price ?? item.service.price,
        })),
      },
    };
  });

  app.post("/barbers/:id/telegram-link", async (request) => {
    const { id } = paramsSchema.parse(request.params);
    const result = await createBarberLinkCode(id);
    return {
      data: {
        code: result.code,
        deepLink: result.deepLink,
        expiresAt: result.expiresAt.toISOString(),
        barberId: result.barber.id,
        barberName: result.barber.name,
      },
    };
  });
};
