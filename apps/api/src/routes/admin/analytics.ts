import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../../lib/adminAuth.js";
import {
  getAnalyticsOverview,
  resolvePeriod,
} from "../../services/analytics.js";

export const adminAnalyticsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", async (request) => {
    await requireAdmin(request);
  });

  async function overview(request: { query: unknown }) {
    const query = z
      .object({
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .parse(request.query);
    const period = resolvePeriod(query);
    const data = await getAnalyticsOverview(period);
    return { data };
  }

  app.get("/analytics", overview);
  app.get("/analytics/overview", overview);

  app.get("/analytics/revenue", async (request) => {
    const { data } = await overview(request);
    return {
      data: {
        period: data.period,
        revenue: data.summary.revenue,
        completed: data.summary.completed,
        bookings: data.summary.bookings,
      },
    };
  });

  app.get("/analytics/services", async (request) => {
    const { data } = await overview(request);
    return {
      data: {
        period: data.period,
        services: data.popularServices,
      },
    };
  });

  app.get("/analytics/load", async (request) => {
    const { data } = await overview(request);
    return {
      data: {
        period: data.period,
        barbers: data.barberLoad,
      },
    };
  });

  app.get("/analytics/heatmap", async (request) => {
    const { data } = await overview(request);
    return {
      data: {
        period: data.period,
        cells: data.heatmap,
      },
    };
  });

  app.get("/analytics/cancellations", async (request) => {
    const { data } = await overview(request);
    return {
      data: {
        period: data.period,
        cancelled: data.summary.cancelled,
        noShow: data.summary.noShow,
        cancelRate: data.summary.cancelRate,
        noShowRate: data.summary.noShowRate,
        bookings: data.summary.bookings,
      },
    };
  });

  app.get("/analytics/retention", async (request) => {
    const { data } = await overview(request);
    return {
      data: {
        period: data.period,
        uniqueClients: data.summary.uniqueClients,
        returningClients: data.summary.returningClients,
        retentionRate: data.summary.retentionRate,
      },
    };
  });
};
