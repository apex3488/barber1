import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireAdmin } from "../../lib/adminAuth.js";
import { badRequest, notFound } from "../../lib/errors.js";
import { uploadPublicImage } from "../../lib/storage.js";
import { createBarberLinkCode } from "../../services/barberLinks.js";

const bodySchema = z.object({
  name: z.string().trim().min(2),
  bio: z.string().trim().optional().nullable(),
  experienceYears: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  photoUrl: z.string().url().optional().nullable(),
});

export const adminBarbersRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", async (request) => {
    await requireAdmin(request);
  });

  app.get("/barbers", async () => {
    const items = await prisma.barber.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        portfolioItems: { orderBy: { sortOrder: "asc" } },
        workingHours: true,
        breaks: true,
      },
    });
    return { data: items };
  });

  app.post("/barbers", async (request, reply) => {
    const body = bodySchema.parse(request.body);
    const item = await prisma.barber.create({
      data: {
        name: body.name,
        bio: body.bio,
        experienceYears: body.experienceYears ?? 0,
        isActive: body.isActive ?? true,
        sortOrder: body.sortOrder ?? 0,
        photoUrl: body.photoUrl,
      },
    });
    return reply.status(201).send({ data: item });
  });

  app.patch("/barbers/:id", async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = bodySchema.partial().parse(request.body);
    try {
      const item = await prisma.barber.update({ where: { id }, data: body });
      return { data: item };
    } catch {
      throw notFound("Барбер не найден");
    }
  });

  app.delete("/barbers/:id", async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    try {
      await prisma.barber.update({ where: { id }, data: { isActive: false } });
      return { ok: true };
    } catch {
      throw notFound("Барбер не найден");
    }
  });

  app.put("/barbers/:id/schedule", async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z
      .object({
        workingHours: z.array(
          z.object({
            weekday: z.number().int().min(0).max(6),
            startTime: z.string().regex(/^\d{2}:\d{2}$/),
            endTime: z.string().regex(/^\d{2}:\d{2}$/),
          }),
        ),
        breaks: z
          .array(
            z.object({
              weekday: z.number().int().min(0).max(6),
              startTime: z.string().regex(/^\d{2}:\d{2}$/),
              endTime: z.string().regex(/^\d{2}:\d{2}$/),
            }),
          )
          .default([]),
      })
      .parse(request.body);

    const barber = await prisma.barber.findUnique({ where: { id } });
    if (!barber) throw notFound("Барбер не найден");

    await prisma.$transaction([
      prisma.workingHours.deleteMany({ where: { barberId: id } }),
      prisma.break.deleteMany({ where: { barberId: id } }),
      prisma.workingHours.createMany({
        data: body.workingHours.map((item) => ({ ...item, barberId: id })),
      }),
      prisma.break.createMany({
        data: body.breaks.map((item) => ({ ...item, barberId: id })),
      }),
    ]);

    const updated = await prisma.barber.findUnique({
      where: { id },
      include: { workingHours: true, breaks: true },
    });
    return { data: updated };
  });

  app.post("/barbers/:id/photo", async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const barber = await prisma.barber.findUnique({ where: { id } });
    if (!barber) throw notFound("Барбер не найден");

    const file = await request.file();
    if (!file) throw badRequest("Файл не передан");
    const buffer = await file.toBuffer();
    if (!file.mimetype.startsWith("image/")) {
      throw badRequest("Нужен файл изображения");
    }

    const url = await uploadPublicImage(
      `barbers/${id}/${Date.now()}-${file.filename}`,
      buffer,
      file.mimetype,
    );
    const updated = await prisma.barber.update({
      where: { id },
      data: { photoUrl: url },
    });
    return { data: updated };
  });

  app.post("/barbers/:id/portfolio", async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const barber = await prisma.barber.findUnique({ where: { id } });
    if (!barber) throw notFound("Барбер не найден");

    const file = await request.file();
    if (!file) throw badRequest("Файл не передан");
    const buffer = await file.toBuffer();
    if (!file.mimetype.startsWith("image/")) {
      throw badRequest("Нужен файл изображения");
    }

    const url = await uploadPublicImage(
      `portfolio/${id}/${Date.now()}-${file.filename}`,
      buffer,
      file.mimetype,
    );
    const maxSort = await prisma.portfolioItem.aggregate({
      where: { barberId: id },
      _max: { sortOrder: true },
    });
    const item = await prisma.portfolioItem.create({
      data: {
        barberId: id,
        imageUrl: url,
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      },
    });
    return { data: item };
  });

  app.delete("/barbers/:barberId/portfolio/:itemId", async (request) => {
    const params = z
      .object({ barberId: z.string().uuid(), itemId: z.string().uuid() })
      .parse(request.params);
    await prisma.portfolioItem.deleteMany({
      where: { id: params.itemId, barberId: params.barberId },
    });
    return { ok: true };
  });

  app.post("/barbers/:id/telegram-link", async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const result = await createBarberLinkCode(id);
    return {
      data: {
        code: result.code,
        deepLink: result.deepLink,
        expiresAt: result.expiresAt.toISOString(),
      },
    };
  });
};
