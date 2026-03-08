import type { FastifyPluginAsync } from "fastify";

import type { ProfileResponse } from "../models/schemas.js";
import * as backboardService from "../services/backboardService.js";

const profileRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { userId: string } }>("/:userId", async (request) => {
    const { userId } = request.params;
    const profile = await backboardService.getProfile(userId);
    const dwellEventCount = backboardService.getDwellCount(userId);

    const response: ProfileResponse = {
      user_id: userId,
      profile,
      dwell_event_count: dwellEventCount,
    };

    return response;
  });

  fastify.delete<{ Params: { userId: string } }>("/:userId", async (request) => {
    const { userId } = request.params;
    backboardService.clearProfile(userId);
    return { deleted: true, user_id: userId };
  });
};

export default profileRoutes;
