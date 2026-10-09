import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import {
  clearAdminSessionCookie,
  requireAdmin,
  setAdminSessionCookie,
  verifyPassword,
} from "../../lib/adminAuth.js";
import { badRequest } from "../../lib/errors.js";

export const adminAuthRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    "/login",
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "5 minutes",
        },
      },
    },
    async (request, reply) => {
      const body = z
        .object({
          login: z.string().trim().min(1),
          password: z.string().min(1),
        })
        .parse(request.body);

      const admin = await prisma.adminUser.findUnique({
        where: { login: body.login },
      });
      if (!admin || !(await verifyPassword(admin.passwordHash, body.password))) {
        throw badRequest("Неверный логин или пароль", "INVALID_CREDENTIALS");
      }

      setAdminSessionCookie(reply, admin.id);
      return {
        data: {
          id: admin.id,
          login: admin.login,
        },
      };
    },
  );

  app.post("/logout", async (_request, reply) => {
    clearAdminSessionCookie(reply);
    return { ok: true };
  });

  app.get("/me", async (request) => {
    const admin = await requireAdmin(request);
    return { data: { id: admin.id, login: admin.login } };
  });
};
