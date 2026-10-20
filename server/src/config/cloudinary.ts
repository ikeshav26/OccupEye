import { v2 as cloudinary } from "cloudinary";
import { env } from "./env.js";

if (env.isCloudinaryConfigured()) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export interface UploadResult {
  url: string;
  publicId: string;
}

export async function uploadSnapshot(base64Image: string): Promise<UploadResult | null> {
  if (!env.isCloudinaryConfigured()) {
    console.warn("[Cloudinary] Credentials not fully configured in .env. Skipping snapshot upload.");
    return null;
  }

  try {
    const formattedData = base64Image.startsWith("data:")
      ? base64Image
      : `data:image/jpeg;base64,${base64Image}`;

    const result = await cloudinary.uploader.upload(formattedData, {
      folder: "occueye/snapshots",
      resource_type: "image",
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
    };
  } catch (error) {
    console.error("[Cloudinary] Upload failed:", error);
    return null;
  }
}

export async function deleteSnapshot(publicId: string): Promise<boolean> {
  if (!env.isCloudinaryConfigured()) {
    return false;
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result.result === "ok";
  } catch (error) {
    console.error(`[Cloudinary] Failed to delete publicId '${publicId}':`, error);
    return false;
  }
}

export default cloudinary;
