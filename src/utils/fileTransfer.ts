export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
export const MAX_FILE_SIZE_LABEL = "25 MB";
const COMPRESSION_SIZE_THRESHOLD_BYTES = 800 * 1024;
const MAX_DIMENSION = 1600;

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

    const mimeType = file.type === "image/png" ? "image/webp" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, mimeType, 0.82);
    });

    if (!blob || blob.size >= file.size) return file;

    const extension = mimeType === "image/webp" ? ".webp" : ".jpg";
    const optimizedName = file.name.replace(/\.[^.]+$/, extension);
    return new File([blob], optimizedName, {
      type: mimeType,
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}
