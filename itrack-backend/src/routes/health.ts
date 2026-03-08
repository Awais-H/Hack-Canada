import type { FastifyPluginAsync } from "fastify";

import { settings } from "../config/settings.js";
import * as backboardService from "../services/backboardService.js";

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", async () => {
    const response: {
      status: string;
      sourcing_mode: string;
      timestamp: string;
      dwell_count?: number;
    } = {
      status: "ok",
      sourcing_mode: settings.PRODUCT_SOURCING_MODE,
      timestamp: new Date().toISOString(),
    };

    const anonDebugDwellCount = backboardService.getDwellCount("anon-debug");
    if (anonDebugDwellCount > 0) {
      response.dwell_count = anonDebugDwellCount;
    }

    return response;
  });
};

export default healthRoutes;
