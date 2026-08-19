import type { CropRect } from "@/lib/avatar/face-crop";

export const AVATAR_EXPORT_SIZE = 512;
export const AVATAR_EXPORT_QUALITY = 0.85;
export const AVATAR_MAX_SOURCE_BYTES = 5 * 1024 * 1024;
export const AVATAR_SOURCE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export function isAllowedAvatarFile(file: File): boolean {
  return (
    file.size > 0 &&
    file.size <= AVATAR_MAX_SOURCE_BYTES &&
    AVATAR_SOURCE_TYPES.includes(file.type as (typeof AVATAR_SOURCE_TYPES)[number])
  );
}

export async function cropImageToWebp(image: HTMLImageElement, crop: CropRect): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_EXPORT_SIZE;
  canvas.height = AVATAR_EXPORT_SIZE;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("The photo could not be prepared in this browser.");
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.size,
    crop.size,
    0,
    0,
    AVATAR_EXPORT_SIZE,
    AVATAR_EXPORT_SIZE,
  );
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), "image/webp", AVATAR_EXPORT_QUALITY);
  });
  if (!blob) {
    throw new Error("The photo could not be exported. Try a different image.");
  }
  return blob;
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}
