import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const sourceFile = fileURLToPath(import.meta.url);
const dashboardRoot = path.resolve(path.dirname(sourceFile), "..");

const requiredFiles = [
  "public/index.html",
  "public/styles.css",
  "public/app.js",
  "public/logo.svg",
  "public/architecture.html",
  "public/architecture.js",
  "public/architecture.css"
];

for (const file of requiredFiles) {
  await fs.access(path.join(dashboardRoot, file));
}

console.log("Dashboard assets: ok");
