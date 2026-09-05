import { validateTargetUrl } from "../../src/security/ssrf.ts";

interface Env {}

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);

  // Handle CORS preflight
  if (context.request.method === "OPTIONS") {
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

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(parsedTarget.toString(), {
      headers: requestHeaders,
      redirect: "follow",
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Connection failed";
    return new Response(
      `<!doctype html><html><body style="font-family:system-ui,-apple-system,sans-serif;padding:36px;color:#1e293b;background:#f8fafc;line-height:1.6;">` +
        `<div style="max-width:600px;margin:0 auto;background:#fff;padding:28px;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,0.06);border:1px solid #e2e8f0;">` +
        `<h3 style="color:#ef4444;margin-top:0;">⚠️ 无法加载目标网页 (Failed to fetch)</h3>` +
        `<p><strong>目标地址:</strong> <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">${targetUrl}</code></p>` +
        `<p><strong>错误原因:</strong> ${errorMsg}</p>` +
        `</div></body></html>`,
      {
        status: 502,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }

  const contentType = upstreamResponse.headers.get("content-type") || "text/html";

  // Strip headers preventing iframe embedding
  const responseHeaders = new Headers();
  for (const [key, value] of upstreamResponse.headers.entries()) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey === "x-frame-options" ||
      lowerKey === "content-security-policy" ||
      lowerKey === "content-security-policy-report-only" ||
      lowerKey === "cross-origin-opener-policy" ||
      lowerKey === "cross-origin-resource-policy" ||
      lowerKey === "cross-origin-embedder-policy"
    ) {
      continue;
    }
    responseHeaders.set(key, value);
  }

  responseHeaders.set("Content-Type", contentType);
  responseHeaders.set("Cache-Control", "no-cache");
  responseHeaders.set("Access-Control-Allow-Origin", "*");
  responseHeaders.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  responseHeaders.set("Access-Control-Allow-Headers", "*");

  // If HTML, inject <base> tag and interactive Paper Browser Bridge script
  if (contentType.includes("text/html")) {
    let html = await upstreamResponse.text();

    const bridgeScript = `
<base href="${parsedTarget.href}">
<script id="__paper_browser_bridge__">
(function() {
  window.addEventListener('mousemove', function(e) {
    try {
      window.parent.postMessage({
        type: 'paper_iframe_mousemove',
        clientX: e.clientX,
  window.addEventListener('mousemove', function(e) {
    try {
      window.parent.postMessage({
        version: 1,
        type: 'paper_iframe_mousemove',
        clientX: e.clientX,
        clientY: e.clientY
      }, '*');
    } catch(_err) {}
  }, { passive: true });

  window.addEventListener('pointerdown', function(e) {
    try {
      window.parent.postMessage({
        version: 1,
        type: 'paper_iframe_click',
        clientX: e.clientX,
        clientY: e.clientY
      }, '*');
    } catch(_err) {}
  }, { passive: true });

  window.addEventListener('wheel', function(e) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      try {
        window.parent.postMessage({
          version: 1,
          type: 'paper_iframe_zoom',
          deltaY: e.deltaY
        }, '*');
      } catch(_err) {}
      return;
    }
    var dy = e.deltaY;
    var dx = e.deltaX;
    if (e.deltaMode === 1) {
      dy *= 20;
      dx *= 20;
    } else if (e.deltaMode === 2) {
      dy *= 400;
      dx *= 400;
    }
    window.scrollBy({
      top: dy,
      left: dx,
      behavior: 'auto'
    });
  }, { passive: false });

  document.addEventListener('click', function(e) {
    var a = e.target.closest('a');
    if (!a || !a.href) return;
    var rawHref = a.getAttribute('href') || '';
    if (rawHref.startsWith('javascript:') || rawHref.startsWith('#')) return;

    e.preventDefault();
    var resolvedUrl;
    try {
      resolvedUrl = new URL(rawHref, "${parsedTarget.href}").href;
    } catch(_err) {
      resolvedUrl = a.href;
    }
    var targetAttr = (a.getAttribute('target') || '').toLowerCase();
    var isNewTab = targetAttr === '_blank' || e.ctrlKey || e.metaKey;

    window.parent.postMessage({
      version: 1,
      type: isNewTab ? 'paper_new_tab' : 'paper_navigate',
      url: resolvedUrl
    }, '*');
  }, true);

  // Intercept window.open to open inside Paper Browser tabs
  try {
    window.open = function(url) {
      if (url) {
        var resolvedUrl;
        try {
          resolvedUrl = new URL(url, "${parsedTarget.href}").href;
        } catch(err) {
          resolvedUrl = url;
        }
        window.parent.postMessage({
          version: 1,
          type: 'paper_new_tab',
          url: resolvedUrl
        }, '*');
      return null;
    };
  } catch(err) {}

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
};
