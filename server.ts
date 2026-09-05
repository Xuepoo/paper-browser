import { validateTargetUrl } from "./src/security/ssrf.ts";

import { serve } from "bun";
import { join } from "path";

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

      const validation = validateTargetUrl(targetParam);
      if (!validation.valid || !validation.parsedUrl) {
        return new Response(
          `<!doctype html><html><body style="font-family:system-ui,-apple-system,sans-serif;padding:36px;color:#1e293b;background:#f8fafc;line-height:1.6;">` +
            `<div style="max-width:600px;margin:0 auto;background:#fff;padding:28px;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,0.06);border:1px solid #e2e8f0;">` +
            `<h3 style="color:#ef4444;margin-top:0;">🛡️ 目标地址被安全策略拦截 (SSRF Blocked)</h3>` +
            `<p><strong>目标地址:</strong> <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">${targetParam}</code></p>` +
            `<p><strong>拦截原因:</strong> ${validation.error || "禁止访问内部网络、本地回环或云元数据网段"}</p>` +
            `</div></body></html>`,
          {
            status: 403,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          },
        );
      }

      const parsedTarget = validation.parsedUrl;
      const targetUrl = parsedTarget.toString();

      const requestHeaders: Record<string, string> = {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        Referer: parsedTarget.origin,
      };

      // Determine upstream proxy agent (SwitchyOmega architecture: scheme, host, port, or full proxy_agent)
      const customAgentParam = url.searchParams.get("proxy_agent");
      const proxyPortParam =
        url.searchParams.get("proxy_port") ||
        url.searchParams.get("clash_port") ||
        url.searchParams.get("upstream_port");
      const proxyHostParam = url.searchParams.get("proxy_host") || "127.0.0.1";
      const proxySchemeParam = url.searchParams.get("proxy_scheme") || "http";

      let activeProxyAgent: string | undefined = PROXY_AGENT;

      if (customAgentParam) {
        if (
          customAgentParam === "none" ||
          customAgentParam === "direct" ||
          customAgentParam === "null"
        ) {
          activeProxyAgent = undefined;
        } else {
          activeProxyAgent = customAgentParam;
        }
      } else if (proxyPortParam) {
        const portNum = parseInt(proxyPortParam, 10);
        if (!isNaN(portNum) && portNum > 0 && portNum <= 65535) {
          activeProxyAgent = `${proxySchemeParam}://${proxyHostParam}:${portNum}`;
        } else if (proxyPortParam === "none" || proxyPortParam === "direct" || portNum === 0) {
          activeProxyAgent = undefined;
        }
      }
      let upstreamResponse: Response;

      if (activeProxyAgent) {
        // Attempt 1: Fetch through specified local proxy agent (e.g. Clash on 7890 / 7897)
        try {
          upstreamResponse = await fetch(parsedTarget.toString(), {
            proxy: activeProxyAgent,
            headers: requestHeaders,
            redirect: "follow",
          });
        } catch (errProxy: unknown) {
          const proxyErrMsg = errProxy instanceof Error ? errProxy.message : "连接失败";
          // Attempt 2: Direct fetch fallback
          try {
            upstreamResponse = await fetch(parsedTarget.toString(), {
              headers: requestHeaders,
              redirect: "follow",
            });
          } catch (errDirect: unknown) {
            const directErrMsg = errDirect instanceof Error ? errDirect.message : "连接中断";
            return new Response(
              `<html><body style="font-family:system-ui,-apple-system,sans-serif;padding:36px;color:#1e293b;background:#f8fafc;line-height:1.6;">` +
                `<div style="max-width:600px;margin:0 auto;background:#fff;padding:28px;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,0.06);border:1px solid #e2e8f0;">` +
                `<h3 style="color:#ef4444;margin-top:0;">⚠️ 无法加载目标网页 (Failed to fetch)</h3>` +
                `<p><strong>目标地址:</strong> <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">${targetUrl}</code></p>` +
                `<p><strong>网络诊断:</strong></p>` +
                `<ul style="font-size:13px;color:#475569;">` +
                `<li>科学代理模式 (<code>${activeProxyAgent}</code>): ${proxyErrMsg}</li>` +
                `<li>直连模式 (Direct): ${directErrMsg}</li>` +
                `</ul>` +
                `<div style="margin-top:16px;padding:12px 14px;background:#f0fdf4;border-left:4px solid #22c55e;border-radius:4px;font-size:13px;color:#166534;">` +
                `💡 <strong>提示:</strong> 若访问境外站点 (如 YouTube / Google)，请确保本地代理客户端 (当前尝试: <code>${activeProxyAgent}</code>) 已启动且规则正常。` +
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
      } else {
        // Direct fetch without upstream proxy
        try {
          upstreamResponse = await fetch(parsedTarget.toString(), {
            headers: requestHeaders,
            redirect: "follow",
          });
        } catch (errDirect: unknown) {
          const directErrMsg =
            errDirect instanceof Error ? errDirect.message : "连接超时或站点拒绝访问";
          return new Response(
            `<html><body style="font-family:system-ui,-apple-system,sans-serif;padding:36px;color:#1e293b;background:#f8fafc;line-height:1.6;">` +
              `<div style="max-width:600px;margin:0 auto;background:#fff;padding:28px;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,0.06);border:1px solid #e2e8f0;">` +
              `<h3 style="color:#ef4444;margin-top:0;">⚠️ 直连加载失败 (Failed to fetch directly)</h3>` +
              `<p><strong>目标地址:</strong> <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">${targetUrl}</code></p>` +
              `<p><strong>原因:</strong> ${directErrMsg}</p>` +
              `</div></body></html>`,
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
        version: 1,
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
        version: 1,
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
          version: 1,
          type: 'paper_iframe_zoom',
          deltaY: e.deltaY
        }, '*');
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

  // Intercept all link clicks to navigate or open new tab inside the paper browser
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

    var targetAttr = (a.getAttribute('target') || '').toLowerCase();
    var isNewTab = targetAttr === '_blank' || e.ctrlKey || e.metaKey;

    window.parent.postMessage({
      version: 1,
      type: isNewTab ? 'paper_new_tab' : 'paper_navigate',
      url: resolvedUrl
    }, '*');

  // Intercept window.open to open inside Paper Browser tabs
  try {
    window.open = function(url) {
      if (url) {
        var resolvedUrl;
        try {
          resolvedUrl = new URL(url, "${parsedTarget.href}").href;
        } catch(err) {
          resolvedUrl = url;
        window.parent.postMessage({
          version: 1,
          type: 'paper_new_tab',
          url: resolvedUrl
        }, '*');
      }
      return null;
    };
  } catch(err) {}
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
