import { v2 as cloudinary } from "cloudinary";

import { settings } from "../config/settings.js";

cloudinary.config({
  cloud_name: settings.CLOUDINARY_CLOUD_NAME,
  api_key: settings.CLOUDINARY_API_KEY,
  api_secret: settings.CLOUDINARY_API_SECRET,
  secure: true,
});

export const transformProductImage = async (imageUrl: string): Promise<string> => {
  if (!settings.CLOUDINARY_ENABLED) {
    console.log("[Cloudinary] Disabled — returning raw URL");
    return imageUrl;
  }

  let publicId: string | undefined;

  try {
    const uploadResult = await cloudinary.uploader.upload(imageUrl, {
      folder: "itrack/products",
      overwrite: false,
    });
    publicId = uploadResult.public_id;

    const transformedUrl = cloudinary.url(publicId, {
      resource_type: "image",
      transformation: [
        { width: 288, height: 224, crop: "fit" },
        { effect: "sharpen" },
        { effect: "improve", value: "outdoor:50" },
        { quality: "auto:best", fetch_format: "auto" },
      ],
    });

    return transformedUrl;
  } catch {
    // Fall through to fallback path.
  }

  try {
    if (!publicId) {
      const uploadResult = await cloudinary.uploader.upload(imageUrl, {
        folder: "itrack/products",
        overwrite: false,
      });
      publicId = uploadResult.public_id;
    }

    const fallbackUrl = cloudinary.url(publicId, {
      resource_type: "image",
      transformation: [
        { width: 288, height: 224, crop: "fit" },
        { effect: "sharpen" },
        { effect: "improve", value: "outdoor:50" },
        { quality: "auto:best", fetch_format: "auto" },
      ],
    });

    return fallbackUrl;
  } catch (error) {
    console.error("[Cloudinary] Fallback also failed", error);
    return imageUrl;
  }
};

export const uploadScreenshotForLens = async (screenshotB64: string): Promise<string | null> => {
  if (!settings.CLOUDINARY_ENABLED) {
    console.log("[Cloudinary] Disabled - cannot upload screenshot for Lens");
    return null;
  }

  try {
    const dataUri = `data:image/jpeg;base64,${screenshotB64}`;
    const uploadResult = await cloudinary.uploader.upload(dataUri, {
      folder: "itrack/lens-inputs",
      resource_type: "image",
      overwrite: false,
    });

    if (typeof uploadResult.secure_url === "string" && uploadResult.secure_url.length > 0) {
      return uploadResult.secure_url;
    }

    console.warn("[Cloudinary] Screenshot uploaded but secure_url missing for Lens");
    return null;
  } catch (error) {
    console.warn("[Cloudinary] Screenshot upload for Lens failed", error);
    return null;
  }
};
