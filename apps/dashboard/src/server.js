import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const sourceFile = fileURLToPath(import.meta.url);
const dashboardRoot = path.resolve(path.dirname(sourceFile), "..");
const publicDirectory = path.join(dashboardRoot, "public");

const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"]
]);

function getContentType(filePath) {
  return contentTypes.get(path.extname(filePath)) ?? "application/octet-stream";
}

const cleanRoutes = new Map([
  ["/", "/index.html"],
  ["/architecture", "/architecture.html"]
]);

function resolvePublicPath(requestUrl) {
  const url = new URL(requestUrl ?? "/", "http://localhost");
  const pathname = cleanRoutes.get(url.pathname) ?? url.pathname;
  const requestedPath = path.resolve(publicDirectory, `.${pathname}`);

  if (!requestedPath.startsWith(publicDirectory)) {
    return path.join(publicDirectory, "index.html");
  }

  return requestedPath;
}

const server = http.createServer(async (request, response) => {
  const filePath = resolvePublicPath(request.url);

  try {
    const content = await fs.readFile(filePath);
    response.writeHead(200, {
      "content-type": getContentType(filePath)
    });
    response.end(content);
  } catch {
    response.writeHead(404, {
      "content-type": "application/json; charset=utf-8"
    });
    response.end(JSON.stringify({ error: "Dashboard asset not found" }));
  }
});

const port = Number(process.env.PORT ?? 4318);

server.on("error", error => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `Port ${port} is already in use. Open http://localhost:${port} or run with PORT=4319.`
    );
    process.exit(1);
  }

  throw error;
});

server.listen(port, () => {
  console.log(`CodeSentinel Dashboard listening on http://localhost:${port}`);
});
