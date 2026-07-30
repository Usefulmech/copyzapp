/**
 * CopyZapp Express App
 *
 * This module exports the configured Express application.
 * It is shared between:
 *   - server.ts   (local dev: adds Vite HMR + app.listen)
 *   - api/[...path].ts (Vercel: exports as serverless handler)
 */

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import crypto from "crypto";
import os from "os";
import {
  IS_VERCEL,
  UPLOADS_DIR,
  StoredMemory,
  StoredToken,
  loadMemories,
  saveMemories,
  loadTokens,
  saveTokens,
  uploadImage,
  deleteImage,
  getExtensionFromMime,
  upload,
} from "./storage.js";

const PORT = parseInt(process.env.PORT ?? "3000", 10);

// Augment express request type
declare global {
  namespace Express {
    interface Request {
      tokenRecord?: StoredToken;
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function validateShareToken(providedToken: string): Promise<StoredToken | null> {
  if (!providedToken) return null;
  const tokens = await loadTokens();
  const providedTokenBuffer = Buffer.from(providedToken);
  for (const t of tokens) {
    if (t.shareToken.length !== providedToken.length) {
      continue;
    }
    const storedTokenBuffer = Buffer.from(t.shareToken);
    if (crypto.timingSafeEqual(providedTokenBuffer, storedTokenBuffer)) {
      return t;
    }
  }
  return null;
}

function extractUrl(text?: string | null): string | null {
  if (!text) return null;
  const matches = text.match(/(https?:\/\/[^\s]+)/gi);
  return matches ? matches[0] : null;
}

export async function performCleanup(): Promise<number> {
  const memories = await loadMemories();
  const now = Date.now();
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  const valid: StoredMemory[] = [];
  const toDelete: string[] = [];
  for (const m of memories) {
    if ((now - new Date(m.createdAt).getTime()) > TWENTY_FOUR_HOURS && !m.isPinned) {
      if (m.imageUrl) toDelete.push(m.imageUrl);
    } else {
      valid.push(m);
    }
  }
  await saveMemories(valid);
  for (const url of toDelete) {
    await deleteImage(url).catch(() => {});
  }
  return memories.length - valid.length;
}

// ── Express App Factory ───────────────────────────────────────────────────────

export function createApp() {
  const app = express();

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // CORS
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
  });

  // Serve uploaded images statically (local dev only — Vercel Blob uses CDN URLs)
  if (!IS_VERCEL) {
    app.use("/uploads", express.static(UPLOADS_DIR));
  }

  // Rate limiter (30 req/min per IP)
  const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
  const rateLimiter = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const now = Date.now();
    const record = rateLimitMap.get(ip);
    if (!record || now > record.resetTime) {
      rateLimitMap.set(ip, { count: 1, resetTime: now + 60_000 });
      return next();
    }
    if (record.count >= 30) {
      return res.status(429).json({ error: "Too Many Requests (30 shares/min limit)" });
    }
    record.count++;
    next();
  };

  // Auth middleware
  const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    let token = authHeader ? authHeader.replace("Bearer ", "").trim() : (req.query.token as string);
    if(!token) {
        const bodyToken = req.body.token as string;
        if(bodyToken) token = bodyToken;
    }

    if (!token) {
      const tokens = await loadTokens();
      token = tokens[0]?.shareToken ?? "";
    }
    const tokenRecord = await validateShareToken(token);
    if (!tokenRecord) return res.status(401).json({ error: "Unauthorized: Invalid or missing token" });
    req.tokenRecord = tokenRecord;
    next();
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // API Routes
  // ─────────────────────────────────────────────────────────────────────────────

  // Health check
  app.get("/api/health", async (_req, res) => {
    try {
      const memories = await loadMemories();
      res.json({ status: "ok", memoriesCount: memories.length });
    } catch (err) {
      res.status(500).json({ status: "error", error: String(err) });
    }
  });

  // Share Receiver (Android PWA Share Target)
  app.post(
    "/api/share-receiver/:shareToken",
    rateLimiter,
    upload.single("image"),
    async (req, res) => {
      try {
        const tokenRecord = await validateShareToken(req.params.shareToken);
        if (!tokenRecord) return res.status(404).json({ error: "Invalid share token" });

        const { title, text, url } = req.body;
        const file = req.file;

        let imageUrl: string | null = null;
        let imageType: string | null = null;

        if (file) {
          const source = IS_VERCEL ? file.buffer : file.path;
          imageUrl = await uploadImage(source, file.filename, file.mimetype);
          imageType = file.mimetype;
        }

        const memoryTitle = title || (text ? text.slice(0, 40) + "..." : "Shared Snippet");
        const newMemory: StoredMemory = {
          id: crypto.randomUUID(),
          userId: tokenRecord.userId,
          title: String(memoryTitle).trim(),
          body: text ? String(text).trim() : null,
          link: (url || extractUrl(text)) ?? null,
          imageUrl,
          imageType,
          createdAt: new Date().toISOString(),
          isPinned: false,
          archivedAt: null,
        };

        const memories = await loadMemories();
        memories.unshift(newMemory);

        // On Vercel, prune expired memories inline (no setInterval available)
        if (IS_VERCEL) {
          const now = Date.now();
          const TH = 24 * 60 * 60 * 1000;
          await saveMemories(memories.filter(m =>
            (now - new Date(m.createdAt).getTime()) <= TH || m.isPinned
          ));
        } else {
          await saveMemories(memories);
        }

        if (req.accepts("json")) return res.status(200).json({ success: true, memory: newMemory });
        res.status(204).end();
      } catch (err) {
        console.error("Share receiver error:", err);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  );

  // Get Memories (polling)
  app.get("/api/memories", requireAuth, async (req, res) => {
    try {
      const now = Date.now();
      const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
      const sinceParam = req.query.since ? new Date(req.query.since as string).getTime() : 0;
      const memories = await loadMemories();

      const userMemories = memories.filter(m => {
        if (m.userId !== req.tokenRecord!.userId) return false;
        const createdMs = new Date(m.createdAt).getTime();
        const isUnexpired = (now - createdMs) <= TWENTY_FOUR_HOURS || m.isPinned;
        const isNewerThanSince = createdMs > sinceParam;
        return isUnexpired && isNewerThanSince;
      });

      res.json({ snippets: userMemories, serverTime: new Date().toISOString() });
    } catch (err) {
      console.error("Get memories error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Direct POST memory (Dashboard Quick Add / Paste)
  app.post("/api/memories", upload.single("image"), requireAuth, async (req, res) => {
    try {
      const { title, text, url, base64Image } = req.body;
      const file = req.file;

      let imageUrl: string | null = null;
      let imageType: string | null = null;

      if (file) {
        const source = IS_VERCEL ? file.buffer : file.path;
        imageUrl = await uploadImage(source, file.filename, file.mimetype);
        imageType = file.mimetype;
      } else if (base64Image && base64Image.startsWith("data:")) {
        try {
          const matches = (base64Image as string).match(/^data:([a-zA-Z0-9+\/.\-_]+);base64,(.+)$/);
          if (matches) {
            imageType = matches[1];
            const buffer = Buffer.from(matches[2], "base64");
            const ext = getExtensionFromMime(imageType);
            const filename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-file${ext}`;
            imageUrl = await uploadImage(buffer, filename, imageType);
          }
        } catch (err) {
          console.error("Error processing base64 image:", err);
        }
      }

      const memoryTitle = title || (text ? text.slice(0, 40) + "..." : "Dashboard Snippet");
      const newMemory: StoredMemory = {
        id: crypto.randomUUID(),
        userId: req.tokenRecord!.userId,
        title: String(memoryTitle).trim(),
        body: text ? String(text).trim() : null,
        link: (url || extractUrl(text)) ?? null,
        imageUrl,
        imageType,
        createdAt: new Date().toISOString(),
        isPinned: false,
        archivedAt: null,
      };

      const memories = await loadMemories();
      memories.unshift(newMemory);
      await saveMemories(memories);
      res.status(201).json(newMemory);
    } catch (err) {
      console.error("POST memories error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Toggle pin
  app.patch("/api/memories/:id/pin", requireAuth, async (req, res) => {
    try {
      const memories = await loadMemories();
      const memory = memories.find(m => m.id === req.params.id);
      if (!memory) return res.status(404).json({ error: "Snippet not found" });
      
      // Basic authorization: can this user modify this snippet?
      if (memory.userId !== req.tokenRecord!.userId) {
          return res.status(403).json({ error: "Forbidden" });
      }

      memory.isPinned = !memory.isPinned;
      await saveMemories(memories);
      res.json(memory);
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete memory
  app.delete("/api/memories/:id", requireAuth, async (req, res) => {
    try {
      const memories = await loadMemories();
      const idx = memories.findIndex(m => m.id === req.params.id);
      if (idx === -1) return res.status(404).json({ error: "Memory not found" });
      
      const memory = memories[idx];
      if (memory.userId !== req.tokenRecord!.userId) {
          return res.status(403).json({ error: "Forbidden" });
      }

      const [deleted] = memories.splice(idx, 1);
      await saveMemories(memories);
      if (deleted.imageUrl) await deleteImage(deleted.imageUrl).catch(() => {});
      res.json({ success: true, deletedId: req.params.id });
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get active token (supports client-specific tokens for multi-tenancy)
  app.get("/api/tokens/active", async (req, res) => {
    try {
      const clientToken = req.query.token as string;
      let tokens = await loadTokens();

      if (clientToken) {
        const existing = tokens.find(t => t.shareToken === clientToken);
        if (existing) {
          const host = process.env.APP_URL ?? `http://localhost:${PORT}`;
          return res.json({
            userId: existing.userId,
            shareToken: existing.shareToken,
            shareUrl: `${host}/api/share-receiver/${existing.shareToken}`,
            manifestUrl: `${host}/api/manifest/${existing.shareToken}`,
          });
        }
      }

      // If no valid client token was provided, generate a new isolated token!
      const newToken: StoredToken = {
        userId: "user_" + crypto.randomUUID().slice(0, 8),
        shareToken: "cz-" + crypto.randomUUID().replace(/-/g, ""),
        createdAt: new Date().toISOString(),
      };
      tokens.push(newToken);
      await saveTokens(tokens);

      const host = process.env.APP_URL ?? `http://localhost:${PORT}`;
      res.json({
        userId: newToken.userId,
        shareToken: newToken.shareToken,
        shareUrl: `${host}/api/share-receiver/${newToken.shareToken}`,
        manifestUrl: `${host}/api/manifest/${newToken.shareToken}`,
      });
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Rotate specific token
  app.post("/api/tokens/rotate", requireAuth, async (req, res) => {
    try {
      const currentToken = req.tokenRecord!.shareToken;

      let tokens = await loadTokens();
      const existingIdx = tokens.findIndex(t => t.shareToken === currentToken);

      const newToken: StoredToken = {
        userId: req.tokenRecord!.userId,
        shareToken: "cz-" + crypto.randomUUID().replace(/-/g, ""),
        createdAt: new Date().toISOString(),
      };

      if (existingIdx !== -1) {
        tokens[existingIdx] = newToken;
      } else {
        tokens.push(newToken);
      }
      await saveTokens(tokens);

      const host = process.env.APP_URL ?? `http://localhost:${PORT}`;
      res.json({
        userId: newToken.userId,
        shareToken: newToken.shareToken,
        shareUrl: `${host}/api/share-receiver/${newToken.shareToken}`,
        manifestUrl: `${host}/api/manifest/${newToken.shareToken}`,
      });
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Dynamic PWA Manifest (embeds per-user share_target URL)
  app.get("/api/manifest/:shareToken", async (req, res) => {
    const { shareToken } = req.params;
    const host = process.env.APP_URL ?? `http://localhost:${PORT}`;
    const manifest = {
      name: "CopyZapp",
      short_name: "CopyZapp",
      description: "Local-first ephemeral bridge between your phone and PC",
      start_url: "/?mode=pwa",
      display: "standalone",
      background_color: "#0B0B0C",
      theme_color: "#0B0B0C",
      icons: [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
      ],
      share_target: {
        action: `${host}/api/share-receiver/${shareToken}`,
        method: "POST",
        enctype: "multipart/form-data",
        params: {
          title: "title",
          text: "text",
          url: "url",
          files: [{ name: "image", accept: ["*/*"] }],
        },
      },
    };
    res.setHeader("Content-Type", "application/json");
    res.json(manifest);
  });

  // Network info (for multi-mode QR pairing)
  app.get("/api/network-info", async (req, res) => {
    try {
      const tokens = await loadTokens();
      const shareToken = tokens[0]?.shareToken ?? "";
      const cloudUrl = process.env.APP_URL ?? null;

      type AdapterType = "wifi" | "hotspot" | "ethernet" | "localhost";
      interface DetectedAddress {
        name: string;
        interfaceName: string;
        ip: string;
        type: AdapterType;
        shareUrl: string;
      }

      const addresses: DetectedAddress[] = [];
      const ifaces = os.networkInterfaces();

      for (const [ifaceName, ifaceList] of Object.entries(ifaces)) {
        if (!ifaceList) continue;
        for (const iface of ifaceList) {
          if (iface.internal || iface.family !== "IPv4") continue;
          const ip = iface.address;
          let type: AdapterType = "ethernet";
          let displayName = ifaceName;

          const isHotspotRange = ip.startsWith("192.168.137.");
          const isHotspotName = /local area connection\s*\*|wi-fi direct|microsoft hosted/i.test(ifaceName);

          if (isHotspotRange || isHotspotName) {
            type = "hotspot";
            displayName = "Hotspot (PC as Host)";
          } else if (/wi-fi|wlan|wireless|airport/i.test(ifaceName)) {
            type = "wifi";
            displayName = "Wi-Fi";
          } else if (/ethernet|eth|lan|realtek|intel.*ethernet/i.test(ifaceName)) {
            type = "ethernet";
            displayName = "Ethernet";
          }

          addresses.push({
            name: displayName,
            interfaceName: ifaceName,
            ip,
            type,
            shareUrl: `http://${ip}:${PORT}/api/share-receiver/${shareToken}`,
          });
        }
      }

      res.json({
        cloudUrl,
        serverPort: PORT,
        addresses,
        localhostUrl: `http://localhost:${PORT}/api/share-receiver/${shareToken}`,
      });
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Mark token as scanned (called by phone when scanning QR)
  app.post("/api/tokens/mark-scanned", async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) return res.status(400).json({ error: "Token is required" });
      const tokens = await loadTokens();
      const record = tokens.find(t => t.shareToken === token);
      if (!record) return res.status(404).json({ error: "Token not found" });
      record.scannedAt = new Date().toISOString();
      await saveTokens(tokens);
      res.json({ success: true, scannedAt: record.scannedAt });
    } catch (err) {
      console.error("Mark scanned error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get QR scan status (polled by PC displaying QR)
  app.get("/api/tokens/qr-status", async (req, res) => {
    try {
      const token = req.query.token as string;
      if (!token) return res.status(400).json({ error: "Token is required" });
      const tokens = await loadTokens();
      const record = tokens.find(t => t.shareToken === token);
      if (!record) return res.status(404).json({ error: "Token not found" });
      res.json({ scannedAt: record.scannedAt || null });
    } catch (err) {
      console.error("QR status error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Manual cleanup trigger
  app.post("/api/cleanup", async (_req, res) => {
    try {
      const deleted = await performCleanup();
      res.json({ deleted });
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Link preview helper
  app.get("/api/link-preview", async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) return res.status(400).json({ error: "Missing url parameter" });
    try {
      const parsed = new URL(targetUrl);
      res.json({
        title: parsed.hostname,
        domain: parsed.hostname,
        favicon: `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=64`,
        url: targetUrl,
      });
    } catch {
      res.status(400).json({ error: "Invalid URL" });
    }
  });

  // AI Chat Assistant endpoint
  app.post("/api/ai/chat", requireAuth, async (req, res) => {
    try {
      const { prompt, memoryIds } = req.body;
      if (!prompt) return res.status(400).json({ error: "Prompt is required" });

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
        return res.status(400).json({
          error: "Gemini API key is not configured. Please add GEMINI_API_KEY to your environment variables."
        });
      }

      // Load matching memories
      const allMemories = await loadMemories();
      const selectedMemories = allMemories.filter(
        (m) => m.userId === req.tokenRecord!.userId && memoryIds?.includes(m.id)
      );

      // Construct Gemini request parts
      const parts: any[] = [];
      let contextText = "Selected Snippets context:\n";

      for (const m of selectedMemories) {
        contextText += `---\nSnippet Title: ${m.title}\nDate Shared: ${m.createdAt}\n`;
        if (m.body) contextText += `Content: ${m.body}\n`;
        if (m.link) contextText += `Link/URL: ${m.link}\n`;

        // If snippet has an image, fetch and append as inlineData
        if (m.imageUrl) {
          try {
            let buffer: Buffer;
            if (m.imageUrl.startsWith("/uploads")) {
              const { default: fs } = await import("fs");
              const { default: path } = await import("path");
              const filename = path.basename(m.imageUrl);
              buffer = fs.readFileSync(path.join(UPLOADS_DIR, filename));
            } else if (m.imageUrl.startsWith("data:")) {
              const matches = m.imageUrl.match(/^data:image\/[a-zA-Z+]+;base64,(.+)$/);
              if (matches) {
                buffer = Buffer.from(matches[1], "base64");
              } else {
                throw new Error("Invalid base64 image data URL");
              }
            } else {
              const fetchRes = await fetch(m.imageUrl);
              buffer = Buffer.from(await fetchRes.arrayBuffer());
            }

            parts.push({
              inlineData: {
                data: buffer.toString("base64"),
                mimeType: m.imageType || "image/jpeg",
              },
            });
            contextText += "[An image was attached as context]\n";
          } catch (err) {
            console.warn(`Failed to process image context for AI chat:`, err);
            contextText += "[Image attachment failed to load]\n";
          }
        }
        contextText += "\n";
      }

      // Add final prompt text
      const finalPrompt = `You are CopyZapp AI, a premium built-in assistant for CopyZapp.
Analyze the context snippets provided below and answer the User's Question.

${contextText}

User's Question:
"${prompt}"

Please respond in a direct, clear, and well-formatted markdown response.`;

      parts.push({ text: finalPrompt });

      // Call Google Gen AI SDK
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: parts,
          }
        ],
      });

      res.json({ text: response.text });
    } catch (err) {
      console.error("AI Chat handler error:", err);
      const errMsg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: `Internal server error during AI generation: ${errMsg}` });
    }
  });

  return app;
}
