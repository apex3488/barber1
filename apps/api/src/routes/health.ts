import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/prisma.js";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", async () => {
    let database: "up" | "down" = "down";

    try {
      await prisma.$queryRaw`SELECT 1`;
      database = "up";
    } catch {
      database = "down";
    }

    return {
      status: database === "up" ? "ok" : "degraded",
      database,
      time: new Date().toISOString(),
    };
  });
};
