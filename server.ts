import { serve } from "bun";
import { join } from "path";
import { handleProxyCore } from "./src/proxy/core.ts";

const PORT = Number(process.env.PORT) || 3000;
const BASE_DIR = import.meta.dir;
const PROXY_AGENT =
  process.env.HTTPS_PROXY ||
  process.env.HTTP_PROXY ||
  process.env.ALL_PROXY ||
  "http://127.0.0.1:7890";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".ts": "application/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

const server = serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    let pathname = url.pathname;

    if (pathname === "/api/proxy") {
      return handleProxyCore({
        request: req,
        defaultProxyAgent: PROXY_AGENT,
      });
    }

    if (pathname === "/" || pathname === "") {
      pathname = "/index.html";
    }

    const filePath = join(BASE_DIR, pathname);
    const file = Bun.file(filePath);
    if (await file.exists()) {
      const ext = pathname.substring(pathname.lastIndexOf("."));
      const contentType = MIME_TYPES[ext] || "application/octet-stream";
      return new Response(file, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "no-cache",
        },
      });
    }

    return new Response("404 Not Forwarded", { status: 404 });
  },
});

console.log(`[Paper Browser Server] Running at http://localhost:${server.port}`);
console.log(`[Paper Browser Server] Upstream default proxy: ${PROXY_AGENT}`);
