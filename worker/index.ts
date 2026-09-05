import { handleProxyCore } from "../src/proxy/core.ts";

export interface Env {}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response("Paper Browser Cloudflare Worker Proxy is operational.", {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    if (url.pathname === "/api/proxy" || url.pathname === "/proxy") {
      return handleProxyCore({ request });
    }
    return new Response("Not Found", { status: 404 });
  },
};
