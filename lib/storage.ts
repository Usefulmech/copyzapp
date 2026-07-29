/**
 * CopyZap — Storage Abstraction Layer
 *
 * Automatically selects the right storage backend:
 *  - Local dev  → JSON files on disk  (data/memories.json, data/tokens.json)
 *                  Images              → data/uploads/
 *  - Vercel     → Vercel KV (Redis)   (requires KV_REST_API_URL + KV_REST_API_TOKEN)
 *                  Images              → Vercel Blob (requires BLOB_READ_WRITE_TOKEN)
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";

export const IS_VERCEL = Boolean(process.env.VERCEL);

// ── Shared interfaces ─────────────────────────────────────────────────────────

export interface StoredMemory {
  id: string;
  userId: string;
  title: string;
  body: string | null;
  link: string | null;
  imageUrl: string | null;
  imageType: string | null;
  createdAt: string;
  isPinned: boolean;
  archivedAt: string | null;
}

export interface StoredToken {
  userId: string;
  shareToken: string;
  createdAt: string;
}

// ── Local file paths ──────────────────────────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), "data");
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
const MEMORIES_FILE = path.join(DATA_DIR, "memories.json");
const TOKENS_FILE = path.join(DATA_DIR, "tokens.json");

function ensureLocalDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// In-memory fallback stores for Vercel when environment variables are missing/invalid
let inMemoryMemories: StoredMemory[] = [];
let inMemoryTokens: StoredToken[] = [];

// ── Memories ──────────────────────────────────────────────────────────────────

export async function loadMemories(): Promise<StoredMemory[]> {
  if (IS_VERCEL) {
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
      console.warn("Vercel KV environment variables (KV_REST_API_URL / KV_REST_API_TOKEN) are missing. Falling back to in-memory storage.");
      return inMemoryMemories;
    }
    try {
      const { kv } = await import("@vercel/kv");
      return (await kv.get<StoredMemory[]>("copyzap:memories")) ?? [];
    } catch (err) {
      console.warn("Failed to load memories from Vercel KV, falling back to in-memory storage:", err);
      return inMemoryMemories;
    }
  }
  try {
    if (fs.existsSync(MEMORIES_FILE)) {
      return JSON.parse(fs.readFileSync(MEMORIES_FILE, "utf-8")) as StoredMemory[];
    }
  } catch (err) {
    console.error("Failed to load memories:", err);
  }
  return [];
}

export async function saveMemories(memories: StoredMemory[]): Promise<void> {
  if (IS_VERCEL) {
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
      inMemoryMemories = memories;
      return;
    }
    try {
      const { kv } = await import("@vercel/kv");
      await kv.set("copyzap:memories", memories);
    } catch (err) {
      console.warn("Failed to save memories to Vercel KV, saving to in-memory fallback:", err);
      inMemoryMemories = memories;
    }
    return;
  }
  try {
    ensureLocalDirs();
    fs.writeFileSync(MEMORIES_FILE, JSON.stringify(memories, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save memories:", err);
  }
}

// ── Tokens ────────────────────────────────────────────────────────────────────

function createFreshToken(): StoredToken {
  return {
    userId: "user_" + crypto.randomUUID().slice(0, 8),
    shareToken: "cz-" + crypto.randomUUID().replace(/-/g, ""),
    createdAt: new Date().toISOString(),
  };
}

export async function loadTokens(): Promise<StoredToken[]> {
  if (IS_VERCEL) {
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
      console.warn("Vercel KV environment variables (KV_REST_API_URL / KV_REST_API_TOKEN) are missing. Falling back to in-memory storage.");
      if (inMemoryTokens.length === 0) {
        inMemoryTokens = [createFreshToken()];
      }
      return inMemoryTokens;
    }
    try {
      const { kv } = await import("@vercel/kv");
      const tokens = await kv.get<StoredToken[]>("copyzap:tokens");
      if (!tokens || tokens.length === 0) {
        const fresh = createFreshToken();
        await kv.set("copyzap:tokens", [fresh]);
        return [fresh];
      }
      return tokens;
    } catch (err) {
      console.warn("Failed to load tokens from Vercel KV, falling back to in-memory storage:", err);
      if (inMemoryTokens.length === 0) {
        inMemoryTokens = [createFreshToken()];
      }
      return inMemoryTokens;
    }
  }
  // Local
  try {
    if (fs.existsSync(TOKENS_FILE)) {
      const content = fs.readFileSync(TOKENS_FILE, "utf-8");
      const parsed = JSON.parse(content) as StoredToken[];
      if (parsed && parsed.length > 0) return parsed;
    }
  } catch (err) {
    console.error("Failed to load tokens:", err);
  }
  // Generate fresh default
  const fresh = createFreshToken();
  try {
    ensureLocalDirs();
    fs.writeFileSync(TOKENS_FILE, JSON.stringify([fresh], null, 2), "utf-8");
  } catch {}
  return [fresh];
}

export async function saveTokens(tokens: StoredToken[]): Promise<void> {
  if (IS_VERCEL) {
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
      inMemoryTokens = tokens;
      return;
    }
    try {
      const { kv } = await import("@vercel/kv");
      await kv.set("copyzap:tokens", tokens);
    } catch (err) {
      console.warn("Failed to save tokens to Vercel KV, saving to in-memory fallback:", err);
      inMemoryTokens = tokens;
    }
    return;
  }
  try {
    ensureLocalDirs();
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save tokens:", err);
  }
}

// ── Image / File Upload ───────────────────────────────────────────────────────

export function getExtensionFromMime(mime: string): string {
  const map: Record<string, string> = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/gif": ".gif",
    "image/webp": ".webp",
  };
  return map[mime] ?? ".jpg";
}

/**
 * Upload an image buffer and return the URL where it can be accessed.
 * - Vercel: returns a Vercel Blob CDN URL
 * - Local:  saves to disk, returns /uploads/<filename>
 */
export async function uploadImage(
  buffer: Buffer,
  filename: string,
  mimetype: string
): Promise<string> {
  if (IS_VERCEL) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.warn("Vercel Blob token (BLOB_READ_WRITE_TOKEN) is missing. Falling back to base64 Data URL.");
      const base64 = buffer.toString("base64");
      return `data:${mimetype};base64,${base64}`;
    }
    try {
      const { put } = await import("@vercel/blob");
      const blob = await put(`copyzap-uploads/${filename}`, buffer, {
        access: "public",
        contentType: mimetype,
      });
      return blob.url;
    } catch (err) {
      console.warn("Failed to upload image to Vercel Blob, falling back to base64 Data URL:", err);
      const base64 = buffer.toString("base64");
      return `data:${mimetype};base64,${base64}`;
    }
  }
  ensureLocalDirs();
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
  return `/uploads/${filename}`;
}

/**
 * Delete an image by its stored URL.
 * - Vercel: deletes from Blob storage (CDN URL)
 * - Local:  deletes from disk (/uploads/<filename>)
 */
export async function deleteImage(imageUrl: string): Promise<void> {
  if (IS_VERCEL) {
    if (imageUrl.startsWith("data:")) {
      return; // Base64 data URL has no remote resource to delete
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return;
    }
    try {
      const { del } = await import("@vercel/blob");
      await del(imageUrl);
    } catch (err) {
      console.warn("Blob delete failed:", err);
    }
    return;
  }
  const filename = path.basename(imageUrl);
  const filePath = path.join(UPLOADS_DIR, filename);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.warn("File delete failed:", err);
    }
  }
}
