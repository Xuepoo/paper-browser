import { serve } from "bun";
import { join } from "path";

const PORT = 3000;
const BASE_DIR = import.meta.dir;
const PROXY_AGENT = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || "http://127.0.0.1:1080";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
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

    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // 1. Web Proxy Endpoint for Real In-Paper Browsing
    if (pathname === "/api/proxy") {
      const targetParam = url.searchParams.get("url");
      if (!targetParam) {
        return new Response("Missing target url parameter", { status: 400 });
      }

      let targetUrl = targetParam.trim();
      if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
        targetUrl = "https://" + targetUrl;
      }

      let parsedTarget: URL;
      try {
        parsedTarget = new URL(targetUrl);
      } catch (e: any) {
        return new Response(`Invalid target URL: ${e.message}`, {
          status: 400,
        });
      }

      const requestHeaders: Record<string, string> = {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        Referer: parsedTarget.origin,
      };

      let upstreamResponse: Response;

      // Attempt 1: Fetch through local proxy agent (for external/blocked domains)
      try {
        upstreamResponse = await fetch(parsedTarget.toString(), {
          proxy: PROXY_AGENT,
          headers: requestHeaders,
          redirect: "follow",
        });
      } catch (errProxy: any) {
        // Attempt 2: Direct fetch (for local / intranet / non-blocked domains)
        try {
          upstreamResponse = await fetch(parsedTarget.toString(), {
            headers: requestHeaders,
            redirect: "follow",
          });
        } catch (errDirect: any) {
          return new Response(
            `<html><body style="font-family:system-ui,-apple-system,sans-serif;padding:36px;color:#1e293b;background:#f8fafc;line-height:1.6;">` +
              `<div style="max-width:600px;margin:0 auto;background:#fff;padding:28px;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,0.06);border:1px solid #e2e8f0;">` +
              `<h3 style="color:#ef4444;margin-top:0;">⚠️ 无法加载目标网页 (Failed to fetch)</h3>` +
              `<p><strong>目标地址:</strong> <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">${targetUrl}</code></p>` +
              `<p><strong>网络诊断:</strong></p>` +
              `<ul style="font-size:13px;color:#475569;">` +
              `<li>代理模式 (<code>${PROXY_AGENT}</code>): ${errProxy?.message || "连接失败"}</li>` +
              `<li>直连模式 (Direct): ${errDirect?.message || "连接中断"}</li>` +
              `</ul>` +
              `<div style="margin-top:16px;padding:12px 14px;background:#f0fdf4;border-left:4px solid #22c55e;border-radius:4px;font-size:13px;color:#166534;">` +
              `💡 <strong>提示:</strong> 若访问境外站点 (如 YouTube / Google)，请确保本地代理客户端 (默认 <code>${PROXY_AGENT}</code>) 已启动且规则正常。` +
              `</div>` +
              `</div>` +
              `</body></html>`,
            {
              status: 502,
              headers: { "Content-Type": "text/html; charset=utf-8" },
            },
          );
        }
      }

      const contentType = upstreamResponse.headers.get("content-type") || "text/html";

      // Strip headers preventing iframe embedding
      const responseHeaders = new Headers();
      responseHeaders.set("Content-Type", contentType);
      responseHeaders.set("Cache-Control", "no-cache");
      responseHeaders.set("Access-Control-Allow-Origin", "*");

      // If HTML, inject <base> tag and interactive Paper Browser Bridge script
      if (contentType.includes("text/html")) {
        let html = await upstreamResponse.text();

        const bridgeScript = `
<base href="${parsedTarget.href}">
<script id="__paper_browser_bridge__">
(function() {
  // Forward mouse movements to parent 3D paper stage
  window.addEventListener('mousemove', function(e) {
    try {
      window.parent.postMessage({
        type: 'paper_iframe_mousemove',
        clientX: e.clientX,
        clientY: e.clientY
      }, '*');
    } catch(err) {}
  }, { passive: true });

  // Forward click events to parent (triggers 3D paper ink ripple)
  window.addEventListener('pointerdown', function(e) {
    try {
      window.parent.postMessage({
        type: 'paper_iframe_click',
        clientX: e.clientX,
        clientY: e.clientY
      }, '*');
    } catch(err) {}
  }, { passive: true });

  // Handle mouse wheel scrolling inside 3D perspective iframe
  window.addEventListener('wheel', function(e) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      try {
        window.parent.postMessage({
          type: 'paper_iframe_zoom',
          deltaY: e.deltaY
        }, '*');
      } catch(err) {}
      return;
    }
    var dy = e.deltaY;
    var dx = e.deltaX;
    if (e.deltaMode === 1) { // Line mode
      dy *= 20;
      dx *= 20;
    } else if (e.deltaMode === 2) { // Page mode
      dy *= 400;
      dx *= 400;
    }
    window.scrollBy({
      top: dy,
      left: dx,
      behavior: 'auto'
    });
  }, { passive: false });

  // Intercept all link clicks to navigate inside the paper browser
  document.addEventListener('click', function(e) {
    var a = e.target.closest('a');
    if (!a || !a.href) return;
    var rawHref = a.getAttribute('href') || '';
    if (rawHref.startsWith('javascript:') || rawHref.startsWith('#')) return;

    e.preventDefault();
    var resolvedUrl;
    try {
      resolvedUrl = new URL(rawHref, "${parsedTarget.href}").href;
    } catch(err) {
      resolvedUrl = a.href;
    }

    window.parent.postMessage({
      type: 'paper_navigate',
      url: resolvedUrl
    }, '*');
  }, true);

  // Intercept forms (e.g. Wikipedia search or DuckDuckGo search)
  document.addEventListener('submit', function(e) {
    var form = e.target;
    if (!form || !form.action) return;
    var action = form.action;
    var method = (form.method || 'GET').toUpperCase();
    if (method === 'GET') {
      e.preventDefault();
      var formData = new FormData(form);
      var params = new URLSearchParams(formData).toString();
      var fullUrl = action + (action.includes('?') ? '&' : '?') + params;
      window.parent.postMessage({
        type: 'paper_navigate',
        url: fullUrl
      }, '*');
    }
  }, true);
})();
</script>
`;

        if (html.includes("<head>")) {
          html = html.replace("<head>", `<head>${bridgeScript}`);
        } else if (html.includes("<html>")) {
          html = html.replace("<html>", `<html><head>${bridgeScript}</head>`);
        } else {
          html = bridgeScript + html;
        }

        return new Response(html, {
          status: upstreamResponse.status,
          headers: responseHeaders,
        });
      }

      // Stream other content types directly
      return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        headers: responseHeaders,
      });
    }

    // 2. Static File Serving
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

    return new Response("404 Not Found", { status: 404 });
  },
});

console.log(`[HTML-in-Canvas Demo] Server running at http://localhost:${server.port}`);
