import type { FastifyPluginAsync } from "fastify";
import { adminAuthRoutes } from "./auth.js";
import { adminBookingsRoutes } from "./bookings.js";
import { adminServicesRoutes } from "./services.js";
import { adminBarbersRoutes } from "./barbers.js";
import { adminTimeOffRoutes } from "./timeOff.js";
import { adminSettingsRoutes } from "./settings.js";
import { adminReviewsRoutes } from "./reviews.js";
import { adminAnalyticsRoutes } from "./analytics.js";

export const adminRoutes: FastifyPluginAsync = async (app) => {
  await app.register(adminAuthRoutes);
  await app.register(adminBookingsRoutes);
  await app.register(adminServicesRoutes);
  await app.register(adminBarbersRoutes);
  await app.register(adminTimeOffRoutes);
  await app.register(adminSettingsRoutes);
  await app.register(adminReviewsRoutes);
  await app.register(adminAnalyticsRoutes);
};
