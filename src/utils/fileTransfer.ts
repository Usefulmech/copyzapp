export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
export const MAX_FILE_SIZE_LABEL = "25 MB";
// Lower compression threshold to 150 KB so more images are optimized
const COMPRESSION_SIZE_THRESHOLD_BYTES = 150 * 1024;
// Limit max dimension to 1200px for lightning-fast uploads and canvas encoding
const MAX_DIMENSION = 1200;

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Unable to read image file"));
    };
    img.src = objectUrl;
  });
}

export async function prepareUploadFile(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= COMPRESSION_SIZE_THRESHOLD_BYTES) {
    return file;
  }

  // GIFs and SVGs should not be compressed to preserve animations/vectors
  if (file.type === "image/gif" || file.type === "image/svg+xml") {
    return file;
  }

  try {
    const img = await loadImageFromFile(file);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return file;

    let { width, height } = img;
    const ratio = Math.min(1, MAX_DIMENSION / Math.max(width, height));
    width = Math.max(1, Math.round(width * ratio));
    height = Math.max(1, Math.round(height * ratio));

    canvas.width = width;
    canvas.height = height;
    context.drawImage(img, 0, 0, width, height);

    // Modern WebP format offers 30-50% smaller sizes than JPEG at identical quality
    const mimeType = "image/webp";
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, mimeType, 0.75); // 75% quality is the sweet spot
    });

    if (!blob || blob.size >= file.size) return file;

    const actualType = blob.type;
    const extension = actualType === "image/webp" ? ".webp" : actualType === "image/png" ? ".png" : ".jpg";
    const optimizedName = file.name.replace(/\.[^.]+$/, extension);
    return new File([blob], optimizedName, {
      type: actualType,
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

/**
 * Converts a file/blob to a base64 data URL on the client side.
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}
