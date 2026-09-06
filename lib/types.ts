export type FrameFit = "cover" | "contain";

export const DEFAULT_PHOTO_ASPECT_RATIO = 1;
export const MIN_PHOTO_ASPECT_RATIO = 0.62;
export const MAX_PHOTO_ASPECT_RATIO = 1.9;

export function normalizePhotoAspectRatio(value: unknown) {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return DEFAULT_PHOTO_ASPECT_RATIO;
  }

  const clamped = Math.min(MAX_PHOTO_ASPECT_RATIO, Math.max(MIN_PHOTO_ASPECT_RATIO, numeric));
  return Math.round(clamped * 1000) / 1000;
}

export type WishRecord = {
  id: string;
  name: string;
  message: string;
  memory: string;
  song: string;
  imageUrl: string;
  imagePath?: string;
  frameFit: FrameFit;
  photoAspectRatio: number;
  editToken: string;
  positionX: number;
  positionY: number;
  rotation: number;
  createdAt: string;
  updatedAt: string;
};

export type PublicWish = {
  id: string;
  name?: string;
  message?: string;
  memory?: string;
  song?: string;
  imageUrl?: string;
  frameFit: FrameFit;
  photoAspectRatio: number;
  positionX: number;
  positionY: number;
  rotation: number;
  createdAt: string;
  updatedAt: string;
  hidden: boolean;
};

export type WishListResponse = {
  wishes: PublicWish[];
  reveal: boolean;
  demoMode: boolean;
};
