import { normalizePhotoAspectRatio } from "@/lib/types";

export async function prepareImageForUpload(file: File) {
  if (!file.type.startsWith("image/")) {
    return { file, aspectRatio: 1 };
  }

  const image = await loadImage(file);
  const aspectRatio = normalizePhotoAspectRatio(image.naturalWidth / image.naturalHeight);
  const canUploadOriginal = ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type);

  if ((file.size < 1_200_000 && canUploadOriginal) || file.type === "image/gif") {
    return { file, aspectRatio };
  }

  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  const context = canvas.getContext("2d");

  if (!context) {
    return { file, aspectRatio };
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.84));

  if (!blob) {
    return { file, aspectRatio };
  }

  return {
    file: new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }),
    aspectRatio
  };
}

export async function compressImage(file: File) {
  return (await prepareImageForUpload(file)).file;
}

export async function readImageAspectRatio(file: File) {
  if (!file.type.startsWith("image/")) {
    return 1;
  }

  const image = await loadImage(file);
  return normalizePhotoAspectRatio(image.naturalWidth / image.naturalHeight);
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read this image. Please use JPG, PNG, WebP, or GIF."));
    };
    image.src = url;
  });
}
