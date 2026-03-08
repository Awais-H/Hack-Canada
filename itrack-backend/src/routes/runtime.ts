import type { FastifyPluginAsync } from "fastify";

import { settings } from "../config/settings.js";

const runtimeRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/client-config", async () => {
    const cloudName =
      settings.CLOUDINARY_ENABLED && settings.CLOUDINARY_CLOUD_NAME
        ? settings.CLOUDINARY_CLOUD_NAME
        : "";
    const uploadPreset = settings.CLOUDINARY_UPLOAD_PRESET?.trim() ?? "";

    return {
      cloudinary_cloud_name: cloudName,
      cloudinary_upload_preset: uploadPreset,
      cloudinary_direct_upload_enabled:
        settings.CLOUDINARY_ENABLED && Boolean(cloudName) && Boolean(uploadPreset),
    };
  });
};

export default runtimeRoutes;
