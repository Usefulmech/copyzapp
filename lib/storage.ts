/**
 * CopyZapp — Storage Abstraction Layer
 *
 * Automatically selects the right storage backend:
 *  - Neon DB    → PostgreSQL (requires DATABASE_URL or NEON_DATABASE_URL)
 *  - Local dev  → JSON files on disk  (data/memories.json, data/tokens.json)
 *                  Images              → data/uploads/
 *  - Vercel     → Vercel KV (Redis)   (requires KV_REST_API_URL + KV_REST_API_TOKEN)
 *                  Images              → Vercel Blob (requires BLOB_READ_WRITE_TOKEN)
 */
import multer from "multer";
import fs from "fs";
import path from "path";
import crypto from "crypto";

export const IS_VERCEL = Boolean(process.env.VERCEL);
const DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

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
  scannedAt?: string;
}

// ── PostgreSQL / Neon Database Setup ──────────────────────────────────────────

let dbPool: any = null;
let dbInitialized = false;

async function getDbPool() {
  if (!DATABASE_URL) return null;
  if (dbPool) return dbPool;

  try {
    const pg = await import("pg");
    const { Pool } = pg.default || pg;
    dbPool = new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes("localhost") || DATABASE_URL.includes("127.0.0.1")
        ? false
        : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
    });

    if (!dbInitialized) {
      await initDbSchema(dbPool);
      dbInitialized = true;
    }
    return dbPool;
  } catch (err) {
    console.error("Failed to initialize PostgreSQL pool:", err);
    return null;
  }
}

async function initDbSchema(pool: any) {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS copyzapp_tokens (
        user_id VARCHAR(64) NOT NULL,
        share_token VARCHAR(128) PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL,
        scanned_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS copyzapp_memories (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        title TEXT NOT NULL,
        body TEXT,
        link TEXT,
        image_url TEXT,
        image_type TEXT,
        created_at TIMESTAMPTZ NOT NULL,
        is_pinned BOOLEAN DEFAULT FALSE,
        archived_at TIMESTAMPTZ
      );

      CREATE INDEX IF NOT EXISTS idx_memories_user_id ON copyzapp_memories(user_id);
      CREATE INDEX IF NOT EXISTS idx_memories_created_at ON copyzapp_memories(created_at);
      CREATE INDEX IF NOT EXISTS idx_tokens_user_id ON copyzapp_tokens(user_id);
    `);
    console.log("CopyZapp Neon DB tables verified/created successfully.");
  } catch (err) {
    console.error("Failed to initialize CopyZapp DB schema:", err);
  }
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

// Process-level memory caches to eliminate read race conditions (LOCAL DEV ONLY).
let cachedMemories: StoredMemory[] | null = null;
let cachedTokens: StoredToken[] | null = null;

// In-memory fallback stores
let inMemoryMemories: StoredMemory[] = [];
let inMemoryTokens: StoredToken[] = [];

/**
 * Helper to perform atomic file writes by writing to a temporary file first,
 * then renaming it.
 */
function safeWriteFileSync(filePath: string, content: string) {
  const tempPath = `${filePath}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(tempPath, content, "utf-8");
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    console.warn("Atomic rename failed, falling back to direct write:", err);
    fs.writeFileSync(filePath, content, "utf-8");
  } finally {
    if (fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch {}
    }
  }
}

// ── Memories ──────────────────────────────────────────────────────────────────

export async function loadMemories(): Promise<StoredMemory[]> {
  // 1. Try Neon DB / PostgreSQL
  const pool = await getDbPool();
  if (pool) {
    try {
      const res = await pool.query(`
        SELECT
          id,
          user_id AS "userId",
          title,
          body,
          link,
          image_url AS "imageUrl",
          image_type AS "imageType",
          created_at AS "createdAt",
          is_pinned AS "isPinned",
          archived_at AS "archivedAt"
        FROM copyzapp_memories
        ORDER BY created_at DESC
      `);
      return res.rows.map((row: any) => ({
        ...row,
        createdAt: new Date(row.createdAt).toISOString(),
        archivedAt: row.archivedAt ? new Date(row.archivedAt).toISOString() : null,
      }));
    } catch (err) {
      console.error("Failed to load memories from Neon DB, falling back:", err);
    }
  }

  // 2. Try Vercel KV
  if (IS_VERCEL) {
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
      return inMemoryMemories;
    }
    try {
      const { kv } = await import("@vercel/kv");
      return (await kv.get<StoredMemory[]>("copyzap:memories")) ?? [];
    } catch (err) {
      console.warn("Failed to load memories from Vercel KV, falling back:", err);
      return inMemoryMemories;
    }
  }

  // 3. Try Local JSON File
  if (!IS_VERCEL && cachedMemories !== null) {
    return cachedMemories;
  }
  try {
    if (fs.existsSync(MEMORIES_FILE)) {
      cachedMemories = JSON.parse(fs.readFileSync(MEMORIES_FILE, "utf-8")) as StoredMemory[];
      return cachedMemories!;
    }
  } catch (err) {
    console.error("Failed to load memories:", err);
  }
  cachedMemories = [];
  return [];
}

export async function saveMemories(memories: StoredMemory[]): Promise<void> {
  if (!IS_VERCEL) cachedMemories = memories;

  // 1. Save to Neon DB / PostgreSQL
  const pool = await getDbPool();
  if (pool) {
    try {
      // Sync memories to Postgres table
      for (const m of memories) {
        await pool.query(
          `
          INSERT INTO copyzapp_memories (
            id, user_id, title, body, link, image_url, image_type, created_at, is_pinned, archived_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            body = EXCLUDED.body,
            link = EXCLUDED.link,
            image_url = EXCLUDED.image_url,
            image_type = EXCLUDED.image_type,
            is_pinned = EXCLUDED.is_pinned,
            archived_at = EXCLUDED.archived_at
        `,
          [
            m.id,
            m.userId,
            m.title,
            m.body,
            m.link,
            m.imageUrl,
            m.imageType,
            m.createdAt,
            m.isPinned,
            m.archivedAt,
          ]
        );
      }

      // Delete items removed from memories list
      if (memories.length > 0) {
        const ids = memories.map((m) => m.id);
        await pool.query(
          `DELETE FROM copyzapp_memories WHERE NOT (id = ANY($1::varchar[]))`,
          [ids]
        );
      } else {
        await pool.query(`DELETE FROM copyzapp_memories`);
      }
      return;
    } catch (err) {
      console.error("Failed to save memories to Neon DB:", err);
    }
  }

  // 2. Save to Vercel KV
  if (IS_VERCEL) {
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
      inMemoryMemories = memories;
      return;
    }
    try {
      const { kv } = await import("@vercel/kv");
      await kv.set("copyzap:memories", memories);
    } catch (err) {
      inMemoryMemories = memories;
    }
    return;
  }

  // 3. Save to Local JSON File
  try {
    ensureLocalDirs();
    safeWriteFileSync(MEMORIES_FILE, JSON.stringify(memories, null, 2));
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
  // 1. Try Neon DB / PostgreSQL
  const pool = await getDbPool();
  if (pool) {
    try {
      const res = await pool.query(`
        SELECT
          user_id AS "userId",
          share_token AS "shareToken",
          created_at AS "createdAt",
          scanned_at AS "scannedAt"
        FROM copyzapp_tokens
        ORDER BY created_at ASC
      `);
      if (res.rows.length > 0) {
        return res.rows.map((row: any) => ({
          ...row,
          createdAt: new Date(row.createdAt).toISOString(),
          scannedAt: row.scannedAt ? new Date(row.scannedAt).toISOString() : undefined,
        }));
      }
      // If table is empty, seed a fresh token
      const fresh = createFreshToken();
      await pool.query(
        `INSERT INTO copyzapp_tokens (user_id, share_token, created_at) VALUES ($1, $2, $3)`,
        [fresh.userId, fresh.shareToken, fresh.createdAt]
      );
      return [fresh];
    } catch (err) {
      console.error("Failed to load tokens from Neon DB:", err);
    }
  }

  // 2. Try Vercel KV
  if (IS_VERCEL) {
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
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
      if (inMemoryTokens.length === 0) {
        inMemoryTokens = [createFreshToken()];
      }
      return inMemoryTokens;
    }
  }

  // 3. Try Local JSON File
  if (!IS_VERCEL && cachedTokens !== null) {
    return cachedTokens;
  }
  try {
    if (fs.existsSync(TOKENS_FILE)) {
      const content = fs.readFileSync(TOKENS_FILE, "utf-8");
      const parsed = JSON.parse(content) as StoredToken[];
      if (parsed && parsed.length > 0) {
        cachedTokens = parsed;
        return parsed;
      }
    }
  } catch (err) {
    console.error("Failed to load tokens:", err);
  }

  const fresh = createFreshToken();
  try {
    ensureLocalDirs();
    safeWriteFileSync(TOKENS_FILE, JSON.stringify([fresh], null, 2));
  } catch {}
  cachedTokens = [fresh];
  return [fresh];
}

export async function saveTokens(tokens: StoredToken[]): Promise<void> {
  if (!IS_VERCEL) cachedTokens = tokens;

  // 1. Save to Neon DB / PostgreSQL
  const pool = await getDbPool();
  if (pool) {
    try {
      for (const t of tokens) {
        await pool.query(
          `
          INSERT INTO copyzapp_tokens (user_id, share_token, created_at, scanned_at)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (share_token) DO UPDATE SET
            user_id = EXCLUDED.user_id,
            scanned_at = EXCLUDED.scanned_at
        `,
          [t.userId, t.shareToken, t.createdAt, t.scannedAt || null]
        );
      }
      return;
    } catch (err) {
      console.error("Failed to save tokens to Neon DB:", err);
    }
  }

  // 2. Save to Vercel KV
  if (IS_VERCEL) {
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
      inMemoryTokens = tokens;
      return;
    }
    try {
      const { kv } = await import("@vercel/kv");
      await kv.set("copyzap:tokens", tokens);
    } catch (err) {
      inMemoryTokens = tokens;
    }
    return;
  }

  // 3. Save to Local JSON File
  try {
    ensureLocalDirs();
    safeWriteFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2));
  } catch (err) {
    console.error("Failed to save tokens:", err);
  }
}

// ── Image / File Upload ───────────────────────────────────────────────────────

export const upload = multer({
  storage: IS_VERCEL
    ? multer.memoryStorage()
    : multer.diskStorage({
        destination: (_req, _file, cb) => {
          ensureLocalDirs();
          cb(null, UPLOADS_DIR);
        },
        filename: (_req, file, cb) => {
          const sanitized = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_");
          cb(null, `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${sanitized}`);
        },
      }),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (_req, _file, cb) => {
    cb(null, true);
  },
});

export function getExtensionFromMime(mime: string): string {
  const map: Record<string, string> = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "application/pdf": ".pdf",
    "text/plain": ".txt",
    "application/zip": ".zip",
    "audio/mpeg": ".mp3",
    "video/mp4": ".mp4",
    "application/json": ".json",
  };
  if (map[mime]) return map[mime];

  const parts = mime.split("/");
  if (parts.length === 2) {
    const sub = parts[1].split("+")[0].split("-");
    const last = sub[sub.length - 1];
    if (last && last.length <= 4) return `.${last}`;
  }
  return ".bin";
}

/**
 * Upload an image and return the URL where it can be accessed.
 * - Vercel: returns a Vercel Blob CDN URL
 * - Local:  returns /uploads/<filename>
 */
export async function uploadImage(
  source: Buffer | string, // Buffer for Vercel, file path for local
  filename: string,
  mimetype: string
): Promise<string> {
  const safeFilename = path.basename(filename).replace(/[^a-zA-Z0-9.\-_]/g, "_") || "upload.bin";

  if (IS_VERCEL) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.warn("Vercel Blob token (BLOB_READ_WRITE_TOKEN) is missing. Falling back to base64 Data URL.");
      const buffer = source instanceof Buffer ? source : await fs.promises.readFile(source);
      const base64 = buffer.toString("base64");
      return `data:${mimetype};base64,${base64}`;
    }
    try {
      const { put } = await import("@vercel/blob");
      const body = source instanceof Buffer ? source : fs.createReadStream(source);
      const blob = await put(`copyzapp-uploads/${safeFilename}`, body, {
        access: "public",
        contentType: mimetype,
      });
      return blob.url;
    } catch (err) {
      console.warn("Failed to upload image to Vercel Blob, falling back to base64 Data URL:", err);
      const buffer = source instanceof Buffer ? source : await fs.promises.readFile(source);
      const base64 = buffer.toString("base64");
      return `data:${mimetype};base64,${base64}`;
    }
  }

  // Local dev: source is a file path
  if (typeof source === "string") {
    return `/uploads/${path.basename(source)}`;
  }

  ensureLocalDirs();
  fs.writeFileSync(path.join(UPLOADS_DIR, safeFilename), source);
  return `/uploads/${safeFilename}`;
}

/**
 * Delete an image by its stored URL.
 * - Vercel: deletes from Blob storage (CDN URL)
 * - Local:  deletes from disk (/uploads/<filename>)
 */
export async function deleteImage(imageUrl: string): Promise<void> {
  if (IS_VERCEL) {
    if (imageUrl.startsWith("data:")) return;
    if (!process.env.BLOB_READ_WRITE_TOKEN) return;
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

