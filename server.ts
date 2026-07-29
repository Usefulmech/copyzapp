/**
 * CopyZapp — Local Development Server
 *
 * Run: npm run dev
 *
 * This is the LOCAL entry point only.
 * On Vercel, api/[...path].ts is used instead.
 */

import dotenv from "dotenv";
dotenv.config();

import { createServer as createViteServer } from "vite";
import net from "net";
import os from "os";
import { createApp, performCleanup } from "./lib/app.js";

const DESIRED_PORT = parseInt(process.env.PORT ?? "3000", 10);

/**
 * Finds an available port, starting from the desired port.
 * If the desired port is in use, it will increment until a free port is found.
 */
function findAvailablePort(port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        console.log(`Port ${port} is in use, trying another...`);
        findAvailablePort(port + 1).then(resolve, reject);
      } else {
        reject(err);
      }
    });
    server.listen({ port, host: "0.0.0.0" }, () => {
      const listenPort = (server.address() as net.AddressInfo).port;
      server.close(() => {
        resolve(listenPort);
      });
    });
  });
}


async function startServer() {
  const app = createApp();
  
  let finalPort: number;

  try {
    finalPort = await findAvailablePort(DESIRED_PORT);
  } catch(e) {
    console.error("Could not find an open port to start the server.");
    process.exit(1);
  }

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

  app.listen(finalPort, "0.0.0.0", () => {
    console.log(`\n🚀 CopyZapp running on http://0.0.0.0:${finalPort}`);
    console.log(`   🌐 Local:  http://localhost:${finalPort}`);

    const ifaces = os.networkInterfaces();
    for (const [name, list] of Object.entries(ifaces)) {
      if (!list) continue;
      for (const iface of list) {
        if (iface.internal || iface.family !== "IPv4") continue;
        const ip = iface.address;
        const isHotspot = ip.startsWith("192.168.137.");
        const isWifi = /wi-fi|wlan|wireless/i.test(name);
        const label = isHotspot ? "📡 Hotspot" : isWifi ? "📶 Wi-Fi  " : "🔌 Ethernet";
        console.log(`   ${label}: http://${ip}:${finalPort}`);
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
