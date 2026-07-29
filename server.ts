/**
 * CopyZap — Local Development Server
 *
 * Run: npm run dev
 *
 * This is the LOCAL entry point only.
 * On Vercel, api/[...path].ts is used instead.
 */

import { createServer as createViteServer } from "vite";
import os from "os";
import { createApp, performCleanup } from "./lib/app.js";

const PORT = parseInt(process.env.PORT ?? "3000", 10);

async function startServer() {
  const app = createApp();

  // Vite HMR dev middleware (only in development)
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve the Vite-built frontend in production (local)
    const { default: express } = await import("express");
    const { default: path } = await import("path");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n🚀 CopyZap running on http://0.0.0.0:${PORT}`);
    console.log(`   🌐 Local:  http://localhost:${PORT}`);

    const ifaces = os.networkInterfaces();
    for (const [name, list] of Object.entries(ifaces)) {
      if (!list) continue;
      for (const iface of list) {
        if (iface.internal || iface.family !== "IPv4") continue;
        const ip = iface.address;
        const isHotspot = ip.startsWith("192.168.137.");
        const isWifi = /wi-fi|wlan|wireless/i.test(name);
        const label = isHotspot ? "📡 Hotspot" : isWifi ? "📶 Wi-Fi  " : "🔌 Ethernet";
        console.log(`   ${label}: http://${ip}:${PORT}`);
      }
    }
    console.log("");
  });

  // Cleanup expired memories every 15 minutes (local dev only)
  setInterval(async () => {
    const deleted = await performCleanup();
    if (deleted > 0) console.log(`[Cleanup] Removed ${deleted} expired memories`);
  }, 15 * 60 * 1000);
}

startServer();
