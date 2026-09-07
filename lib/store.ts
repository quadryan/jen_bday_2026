import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { normalizePhotoAspectRatio } from "./types";
import type { FrameFit, PublicWish, WishRecord } from "./types";

type DemoState = {
  reveal: boolean;
  wishes: WishRecord[];
};

type SupabaseWishRow = {
  id: string;
  name: string;
  message: string;
  memory: string | null;
  song: string | null;
  image_url: string | null;
  image_path: string | null;
  frame_fit: FrameFit | null;
  photo_aspect_ratio: number | null;
  edit_token: string;
  position_x: number | null;
  position_y: number | null;
  rotation: number | null;
  created_at: string;
  updated_at: string | null;
};

type WishMutation = {
  name: string;
  message: string;
  memory: string;
  song: string;
  frameFit: FrameFit;
  photoAspectRatio: number;
  imageFile: File | null;
};

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "wish-photos";
const globalForDemo = globalThis as unknown as { __jenBirthdayDemo?: DemoState };
const SUPPORTED_UPLOAD_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export function isDemoMode() {
  return !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export function adminPasscodeConfigured() {
  return Boolean(process.env.ADMIN_PASSCODE) || process.env.NODE_ENV === "development";
}

export function isAdminRequest(request: Request) {
  const expected = process.env.ADMIN_PASSCODE || (process.env.NODE_ENV === "development" ? "jen23" : "");
  const supplied = request.headers.get("x-admin-passcode") || "";

  if (!expected || !supplied) {
    return false;
  }

  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);

  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

export function publicWish(record: WishRecord, hidden: boolean): PublicWish {
  const base = {
    id: record.id,
    frameFit: record.frameFit,
    photoAspectRatio: record.photoAspectRatio,
    positionX: record.positionX,
    positionY: record.positionY,
    rotation: record.rotation,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    hidden
  };

  if (hidden) {
    return {
      ...base,
      name: record.name
    };
  }

  return {
    ...base,
    name: record.name,
    message: record.message,
    memory: record.memory,
    song: record.song,
    imageUrl: record.imageUrl
  };
}

export async function listWishes(options?: { includeHiddenContent?: boolean }) {
  const reveal = await getRevealEnabled();
  const records = await readAllWishes();
  const showContent = Boolean(options?.includeHiddenContent || reveal);

  return {
    wishes: records.map((record) => publicWish(record, !showContent)),
    reveal,
    demoMode: isDemoMode()
  };
}

export async function createWishFromForm(formData: FormData) {
  const mutation = parseWishMutation(formData);
  const editToken = randomToken();
  const now = new Date().toISOString();
  const id = randomUUID();
  const fileData = await storeImage(id, mutation.imageFile);

  const record: WishRecord = {
    id,
    name: mutation.name,
    message: mutation.message,
    memory: mutation.memory,
    song: mutation.song,
    imageUrl: fileData.imageUrl,
    imagePath: fileData.imagePath,
    frameFit: mutation.frameFit,
    photoAspectRatio: mutation.photoAspectRatio,
    editToken,
    positionX: randomBetween(12, 88),
    positionY: randomBetween(12, 88),
    rotation: randomBetween(-7, 7),
    createdAt: now,
    updatedAt: now
  };

  if (isDemoMode()) {
    demoState().wishes.unshift(record);
  } else {
    const supabase = getSupabase();
    const { error } = await supabase.from("wishes").insert({
      id: record.id,
      name: record.name,
      message: record.message,
      memory: record.memory || null,
      song: record.song || null,
      image_url: record.imageUrl || null,
      image_path: record.imagePath || null,
      frame_fit: record.frameFit,
      photo_aspect_ratio: record.photoAspectRatio,
      edit_token: record.editToken,
      position_x: record.positionX,
      position_y: record.positionY,
      rotation: record.rotation
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  const wish = await withSignedImage(record);
  return { wish: publicWish(wish, false), editToken };
}

export async function updateWishFromForm(id: string, formData: FormData, options: { admin?: boolean; editToken?: string }) {
  const existing = await findWish(id);

  if (!existing) {
    throw httpError("Wish not found.", 404);
  }

  if (!options.admin && existing.editToken !== options.editToken) {
    throw httpError("This wish can only be edited from the original submission session.", 403);
  }

  const mutation = parseWishMutation(formData, existing);
  const fileData = mutation.imageFile ? await storeImage(existing.id, mutation.imageFile) : null;
  const updated: WishRecord = {
    ...existing,
    name: mutation.name,
    message: mutation.message,
    memory: mutation.memory,
    song: mutation.song,
    frameFit: mutation.frameFit,
    photoAspectRatio: mutation.photoAspectRatio,
    imageUrl: fileData?.imageUrl ?? existing.imageUrl,
    imagePath: fileData?.imagePath ?? existing.imagePath,
    updatedAt: new Date().toISOString()
  };

  if (isDemoMode()) {
    const state = demoState();
    state.wishes = state.wishes.map((wish) => (wish.id === id ? updated : wish));
  } else {
    const supabase = getSupabase();
    const { error } = await supabase
      .from("wishes")
      .update({
        name: updated.name,
        message: updated.message,
        memory: updated.memory || null,
        song: updated.song || null,
        image_url: updated.imageUrl || null,
        image_path: updated.imagePath || null,
        frame_fit: updated.frameFit,
        photo_aspect_ratio: updated.photoAspectRatio,
        updated_at: updated.updatedAt
      })
      .eq("id", id);

    if (error) {
      throw new Error(error.message);
    }
  }

  const wish = await withSignedImage(updated);
  return { wish: publicWish(wish, false) };
}

export async function deleteWish(id: string) {
  const existing = await findWish(id);

  if (!existing) {
    return;
  }

  if (isDemoMode()) {
    const state = demoState();
    state.wishes = state.wishes.filter((wish) => wish.id !== id);
    return;
  }

  const supabase = getSupabase();

  if (existing.imagePath) {
    await supabase.storage.from(BUCKET).remove([existing.imagePath]);
  }

  const { error } = await supabase.from("wishes").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getRevealEnabled() {
  if (isDemoMode()) {
    return demoState().reveal;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.from("site_settings").select("value").eq("key", "reveal_enabled").maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.value === true;
}

export async function setRevealEnabled(reveal: boolean) {
  if (isDemoMode()) {
    demoState().reveal = reveal;
    return reveal;
  }

  const supabase = getSupabase();
  const { error } = await supabase.from("site_settings").upsert({
    key: "reveal_enabled",
    value: reveal,
    updated_at: new Date().toISOString()
  });

  if (error) {
    throw new Error(error.message);
  }

  return reveal;
}

async function readAllWishes() {
  if (isDemoMode()) {
    return demoState().wishes;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("wishes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return Promise.all((data || []).map((row) => withSignedImage(mapRow(row))));
}

async function findWish(id: string) {
  if (isDemoMode()) {
    return demoState().wishes.find((wish) => wish.id === id) ?? null;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.from("wishes").select("*").eq("id", id).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? withSignedImage(mapRow(data)) : null;
}

function getSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase is not configured.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

async function storeImage(id: string, imageFile: File | null) {
  if (!imageFile || imageFile.size === 0) {
    return { imageUrl: "", imagePath: undefined };
  }

  if (!imageFile.type.startsWith("image/")) {
    throw httpError("Please upload an image file.", 400);
  }

  if (!SUPPORTED_UPLOAD_TYPES.has(imageFile.type)) {
    throw httpError("Please use JPG, PNG, WebP, or GIF.", 400);
  }

  if (imageFile.size > 8 * 1024 * 1024) {
    throw httpError("Please keep the compressed image under 8 MB.", 400);
  }

  const bytes = Buffer.from(await imageFile.arrayBuffer());

  if (isDemoMode()) {
    return {
      imageUrl: `data:${imageFile.type};base64,${bytes.toString("base64")}`,
      imagePath: undefined
    };
  }

  const supabase = getSupabase();
  const extension = extensionFor(imageFile.type);
  const imagePath = `${id}/${Date.now()}-${randomToken(6)}.${extension}`;
  const { error } = await supabase.storage.from(BUCKET).upload(imagePath, bytes, {
    contentType: imageFile.type,
    upsert: false
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    imageUrl: "",
    imagePath
  };
}

async function withSignedImage(record: WishRecord): Promise<WishRecord> {
  if (isDemoMode() || !record.imagePath) {
    return record;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(record.imagePath, 60 * 60 * 12);

  if (error) {
    return record;
  }

  return {
    ...record,
    imageUrl: data.signedUrl
  };
}

function parseWishMutation(formData: FormData, fallback?: WishRecord): WishMutation {
  const name = cleanLine(formData.get("name"), 80) || fallback?.name || "";
  const message = cleanBlock(formData.get("message"), 700) || fallback?.message || "";
  const memory = cleanBlock(formData.get("memory"), 420) || "";
  const song = cleanLine(formData.get("song"), 120) || "";
  const frameFitValue = formData.get("frameFit");
  const frameFit = frameFitValue === "cover" || frameFitValue === "contain" ? frameFitValue : fallback?.frameFit || "contain";
  const photoAspectRatio = normalizePhotoAspectRatio(formData.get("photoAspectRatio") ?? fallback?.photoAspectRatio);
  const imageFile = formData.get("image");

  if (!name) {
    throw httpError("Please add your name.", 400);
  }

  if (!message || message.length < 4) {
    throw httpError("Please add a birthday wish.", 400);
  }

  return {
    name,
    message,
    memory,
    song,
    frameFit,
    photoAspectRatio,
    imageFile: imageFile instanceof File && imageFile.size > 0 ? imageFile : null
  };
}

function mapRow(row: SupabaseWishRow): WishRecord {
  return {
    id: row.id,
    name: row.name,
    message: row.message,
    memory: row.memory ?? "",
    song: row.song ?? "",
    imageUrl: row.image_url ?? "",
    imagePath: row.image_path ?? undefined,
    frameFit: row.frame_fit === "cover" ? "cover" : "contain",
    photoAspectRatio: normalizePhotoAspectRatio(row.photo_aspect_ratio),
    editToken: row.edit_token,
    positionX: row.position_x ?? 50,
    positionY: row.position_y ?? 50,
    rotation: row.rotation ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at
  };
}

function demoState() {
  if (!globalForDemo.__jenBirthdayDemo) {
    globalForDemo.__jenBirthdayDemo = {
      reveal: false,
      wishes: []
    };
  }

  globalForDemo.__jenBirthdayDemo.wishes = globalForDemo.__jenBirthdayDemo.wishes.filter((wish) => !wish.id.startsWith("demo-"));

  return globalForDemo.__jenBirthdayDemo;
}

function cleanLine(value: FormDataEntryValue | null, max: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/\s+/g, " ").slice(0, max);
}

function cleanBlock(value: FormDataEntryValue | null, max: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .slice(0, max);
}

function randomToken(size = 18) {
  return randomBytes(size).toString("base64url");
}

function randomBetween(min: number, max: number) {
  return Number((Math.random() * (max - min) + min).toFixed(2));
}

function extensionFor(type: string) {
  if (type.includes("png")) {
    return "png";
  }

  if (type.includes("webp")) {
    return "webp";
  }

  if (type.includes("gif")) {
    return "gif";
  }

  return "jpg";
}

export function httpError(message: string, status: number) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

export function errorStatus(error: unknown) {
  return typeof error === "object" && error !== null && "status" in error
    ? Number((error as { status?: number }).status) || 500
    : 500;
}
