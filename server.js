import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { server as wisp, logging } from "@mercuryworkshop/wisp-js/server";
import { setupAssets } from "./setup.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "public");

// Ensure static proxy bundles exist in public/ before serving
if (!fs.existsSync(path.join(publicDir, "scramjet", "scramjet.all.js"))) {
  setupAssets();
}

// Configure Wisp server for cloud & Render compatibility
logging.set_level(logging.NONE);
Object.assign(wisp.options, {
  dns_method: "lookup",
  dns_result_order: "ipv4first",
  allow_udp_streams: false,
  allow_direct_ip: true,
  allow_private_ips: false,
  allow_loopback_ips: false,
});

const app = express();

// Set Cross-Origin Isolation headers required for SharedArrayBuffer and WASM transports
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");

  if (req.path.endsWith(".wasm")) {
    res.type("application/wasm");
  } else if (req.path.endsWith(".mjs") || req.path.endsWith(".js")) {
    res.type("application/javascript");
  }
  next();
});

// Fallback routes for root-level scramjet file lookups if requested by sub-workers
for (const file of ["scramjet.wasm.wasm", "scramjet.all.js", "scramjet.sync.js", "scramjet.bundle.js"]) {
  app.get(`/${file}`, (req, res) => {
    res.sendFile(path.join(publicDir, "scramjet", file));
  });
}

// Health check endpoint for Render deployment
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    wisp: "/wisp/",
    scramjet: "/scramjet/",
    baremux: "/baremux/",
    epoxy: "/epoxy/",
  });
});

// Serve static files from public/
app.use(
  express.static(publicDir, {
    etag: true,
    maxAge: 0,
  })
);

// SPA fallback to public/index.html for non-asset routes
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/scramjet/") || req.path.startsWith("/wisp/")) {
    return next();
  }
  res.sendFile(path.join(publicDir, "index.html"));
});

const server = http.createServer(app);

// Attach @mercuryworkshop/wisp-js to handle WebSocket upgrades on /wisp/
server.on("upgrade", (req, socket, head) => {
  if (req.url && (req.url === "/wisp" || req.url.startsWith("/wisp/"))) {
    if (!req.url.endsWith("/")) {
      req.url += "/";
    }
    wisp.routeRequest(req, socket, head);
  } else {
    socket.end();
  }
});

const PORT = process.env.PORT || 8080;

server.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`Scramjet + Wisp Proxy Server listening on http://0.0.0.0:${PORT}`);
});
