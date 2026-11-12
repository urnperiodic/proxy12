import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targets = [
  {
    name: "@mercuryworkshop/scramjet",
    src: path.join(__dirname, "node_modules", "@mercuryworkshop", "scramjet", "dist"),
    dest: path.join(__dirname, "public", "scramjet"),
  },
  {
    name: "@mercuryworkshop/bare-mux",
    src: path.join(__dirname, "node_modules", "@mercuryworkshop", "bare-mux", "dist"),
    dest: path.join(__dirname, "public", "baremux"),
  },
  {
    name: "@mercuryworkshop/epoxy-transport",
    src: path.join(__dirname, "node_modules", "@mercuryworkshop", "epoxy-transport", "dist"),
    dest: path.join(__dirname, "public", "epoxy"),
  },
];

export function setupAssets() {
  for (const target of targets) {
    if (!fs.existsSync(target.src)) {
      throw new Error(`Missing source directory for ${target.name}: ${target.src}`);
    }
    fs.mkdirSync(target.dest, { recursive: true });
    fs.cpSync(target.src, target.dest, { recursive: true, force: true });
    console.log(`[setup] Copied ${target.name} -> ${path.relative(__dirname, target.dest)}/`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  try {
    setupAssets();
    console.log("[setup] All proxy static assets copied successfully.");
  } catch (err) {
    console.error("[setup] Failed to copy proxy static assets:", err);
    process.exit(1);
  }
}
