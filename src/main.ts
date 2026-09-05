/**
 * Paper Browser - Main Entry Point
 * Modern modular TypeScript architecture for 3D HTML-in-Canvas Spatial Browser.
 */

import { PaperPhysics } from "./physics/PaperPhysics.ts";
import { InkRippleRenderer } from "./render/InkRippleRenderer.ts";
import { ProxyClient } from "./proxy/client.ts";
import { detectWicgCapabilities } from "./surface/detector.ts";
import { HtmlCanvasSurface } from "./surface/HtmlCanvasSurface.ts";

export interface TabItem {
  id: string;
  url: string | null;
  title: string;
  favicon: string;
  history: string[];
  historyIndex: number;
  isNewTab: boolean;
  tabElement: HTMLElement | null;
  paneElement: HTMLElement | null;
  surface?: HtmlCanvasSurface;
}

// 1. Core Services
const assemblyEl = document.getElementById("paperAssembly") as HTMLElement;
const shadowEl = document.getElementById("paperShadow") as HTMLElement;
const sheenEl = document.getElementById("paperSheen") as HTMLElement;
const paperBrowser = document.getElementById("paperBrowser") as HTMLElement;
const spatialStage = document.getElementById("spatialStage") as HTMLElement;
const paperCanvas = document.getElementById("paperCanvas") as HTMLCanvasElement;
const ambientGlare = document.getElementById("ambientGlare") as HTMLElement;

const physics = new PaperPhysics(assemblyEl, shadowEl, sheenEl);
const ripples = new InkRippleRenderer(paperCanvas);
const proxy = new ProxyClient();

// Telemetry & Status
const statusDot = document.getElementById("statusDot") as HTMLElement;
const statusText = document.getElementById("statusText") as HTMLElement;
const valAngles = document.getElementById("valAngles") as HTMLElement;
const valLight = document.getElementById("valLight") as HTMLElement;
const valEngine = document.getElementById("valEngine") as HTMLElement;
const valFps = document.getElementById("valFps") as HTMLElement;
const valTabs = document.getElementById("valTabs") as HTMLElement;
const valZoom = document.getElementById("valZoom") as HTMLElement;
const dprValue = document.getElementById("dprValue") as HTMLElement;

// Browser Chrome Elements
const tabsBar = document.getElementById("tabsBar") as HTMLElement;
const btnNewTab = document.getElementById("btnNewTab") as HTMLElement;
const tabsContainer = document.getElementById("tabsContainer") as HTMLElement;
const urlInput = document.getElementById("urlInput") as HTMLInputElement;
const btnBack = document.getElementById("btnBack") as HTMLButtonElement;
const btnForward = document.getElementById("btnForward") as HTMLButtonElement;
const btnReload = document.getElementById("btnReload") as HTMLElement;
const btnHome = document.getElementById("btnHome") as HTMLElement;
const btnGoUrl = document.getElementById("btnGoUrl") as HTMLElement;
const browserProgressBar = document.getElementById("browserProgressBar") as HTMLElement;
const btnResetAngle = document.getElementById("btnResetAngle") as HTMLElement;

// Zoom State
let currentZoom = 1.0;
const zoomLevels = [0.5, 0.67, 0.75, 0.8, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0];

// Tabs State
let tabCounter = 0;
const tabsList: TabItem[] = [];
let activeTabId: string | null = null;

// Proxy & UI Elements
const proxyPill = document.getElementById("proxyPill");
const proxyPillIcon = document.getElementById("proxyPillIcon");
const proxyPillLabel = document.getElementById("proxyPillLabel");
const proxyStatusDot = document.getElementById("proxyStatusDot");
const proxyStatusTag = document.getElementById("proxyStatusTag");
const proxyModalBackdrop = document.getElementById("proxyModalBackdrop");
const btnOpenProxyModal = document.getElementById("btnOpenProxyModal");
const btnCloseProxyModal = document.getElementById("btnCloseProxyModal");
const btnModalConfirm = document.getElementById("btnModalConfirm");

// Control Dock Elements
const controlDock = document.getElementById("controlDock");
const btnCollapseDock = document.getElementById("btnCollapseDock");
const btnToggleTiltLock = document.getElementById("btnToggleTiltLock");
const iconTiltLock = document.getElementById("iconTiltLock");
const labelTiltLock = document.getElementById("labelTiltLock");
const btnToggleRipples = document.getElementById("btnToggleRipples");
const btnToggleClickShake = document.getElementById("btnToggleClickShake");
const iconClickShake = document.getElementById("iconClickShake");
const labelClickShake = document.getElementById("labelClickShake");

// Window Traffic Lights
const ctrlClose = document.querySelector(".ctrl-btn.close") as HTMLElement;
const ctrlMin = document.querySelector(".ctrl-btn.min") as HTMLElement;
const ctrlMax = document.querySelector(".ctrl-btn.max") as HTMLElement;

function syncCanvasDpr(): void {
  const w = paperBrowser.offsetWidth || 980;
  const h = paperBrowser.offsetHeight || 620;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  dprValue.textContent = dpr % 1 === 0 ? `${dpr}x` : `${dpr.toFixed(1)}x`;
  ripples.syncDpr(w, h, dpr);
}

window.addEventListener("resize", syncCanvasDpr);

// Setup Mousemove on 3D Stage
spatialStage.addEventListener("mousemove", (e) => {
  const rect = spatialStage.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  physics.setPointer(mouseX, mouseY, rect.width, rect.height);

  ambientGlare.style.background = `radial-gradient(circle at ${mouseX}px ${mouseY}px, rgba(56, 189, 248, 0.1) 0%, transparent 55%)`;
  valLight.textContent = `X: ${Math.round(mouseX)}px, Y: ${Math.round(mouseY)}px`;
});

spatialStage.addEventListener("mouseleave", () => {
  physics.resetAngle();
});

// Space resets angle
window.addEventListener("keydown", (e) => {
  if (e.code === "Space" && (e.target as HTMLElement).tagName !== "INPUT") {
    e.preventDefault();
    physics.state.isSpaceHeld = true;
    physics.resetAngle();
  }
});

window.addEventListener("keyup", (e) => {
  if (e.code === "Space") {
    physics.state.isSpaceHeld = false;
  }
});

btnResetAngle.addEventListener("click", () => physics.resetAngle());

// Click interaction on paper
paperBrowser.addEventListener("pointerdown", (e) => {
  if (
    (e.target as HTMLElement).closest(".browser-header") ||
    (e.target as HTMLElement).closest(".browser-toolbar")
  ) {
    return;
  }
  const rect = paperBrowser.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  physics.triggerClickFlutter(x, y, rect.width, rect.height);
  ripples.addRipple(x, y);
});

// PostMessage Bridge Protocol Authentication (P0 Security)
window.addEventListener("message", (e) => {
  if (!e.data || typeof e.data !== "object" || e.data.version !== 1) {
    return;
  }

  const isAuthorizedSource = tabsList.some(
    (t) => t.paneElement?.querySelector("iframe")?.contentWindow === e.source,
  );
  if (!isAuthorizedSource) {
    return;
  }

  const rect = spatialStage.getBoundingClientRect();
  if (e.data.type === "paper_iframe_mousemove") {
    const activeTab = tabsList.find((t) => t.id === activeTabId);
    const iframe = activeTab?.paneElement?.querySelector("iframe");
    if (!iframe) return;

    const iframeRect = iframe.getBoundingClientRect();
    const mouseX = iframeRect.left + (e.data.clientX || 0) - rect.left;
    const mouseY = iframeRect.top + (e.data.clientY || 0) - rect.top;
    physics.setPointer(mouseX, mouseY, rect.width, rect.height);
    ambientGlare.style.background = `radial-gradient(circle at ${mouseX}px ${mouseY}px, rgba(56, 189, 248, 0.1) 0%, transparent 55%)`;
    valLight.textContent = `X: ${Math.round(mouseX)}px, Y: ${Math.round(mouseY)}px`;
  } else if (e.data.type === "paper_iframe_click") {
    const activeTab = tabsList.find((t) => t.id === activeTabId);
    const iframe = activeTab?.paneElement?.querySelector("iframe");
    if (!iframe) return;

    const x = (iframe.offsetLeft || 0) + (e.data.clientX || 0);
    const y = (iframe.offsetTop || 0) + (e.data.clientY || 0);
    physics.triggerClickFlutter(
      x,
      y,
      paperBrowser.offsetWidth || 980,
      paperBrowser.offsetHeight || 620,
    );
    ripples.addRipple(x, y, "#38bdf8");
  } else if (e.data.type === "paper_iframe_zoom") {
    if (e.data.deltaY < 0) {
      zoomIn();
    } else if (e.data.deltaY > 0) {
      zoomOut();
    }
  } else if (e.data.type === "paper_navigate") {
    if (activeTabId && e.data.url) {
      navigateTab(activeTabId, e.data.url);
    }
  } else if (e.data.type === "paper_new_tab") {
    if (e.data.url) {
      createTab(e.data.url, "新标签页", true);
    }
  }
});

// Zoom Helpers
function setZoom(level: number): void {
  currentZoom = Math.max(0.5, Math.min(2.0, Math.round(level * 100) / 100));
  const percentText = `${Math.round(currentZoom * 100)}%`;
  const zoomLabel = document.getElementById("zoomLabel");
  if (zoomLabel) zoomLabel.textContent = percentText;
  valZoom.textContent = percentText;

  tabsList.forEach((tab) => {
    if (tab.surface) {
      tab.surface.setZoom(currentZoom);
    } else {
      const iframe = tab.paneElement?.querySelector("iframe");
      if (iframe) {
        iframe.style.transform = `scale(${currentZoom})`;
        iframe.style.transformOrigin = "top left";
        iframe.style.width = `${100 / currentZoom}%`;
        iframe.style.height = `${100 / currentZoom}%`;
      }
    }
  });
}

function zoomIn(): void {
  const next = zoomLevels.find((z) => z > currentZoom + 0.02);
  if (next) setZoom(next);
}

function zoomOut(): void {
  const prev = [...zoomLevels].reverse().find((z) => z < currentZoom - 0.02);
  if (prev) setZoom(prev);
}

document.getElementById("btnZoomIn")?.addEventListener("click", zoomIn);
document.getElementById("btnZoomOut")?.addEventListener("click", zoomOut);

// Tab Lifecycle
export function createTab(url: string | null = null, title = "新标签页", activate = true): TabItem {
  const tabId = `tab-${++tabCounter}`;
  const isNewTab = !url;

  const tabData: TabItem = {
    id: tabId,
    url,
    title,
    favicon: isNewTab ? "📄" : "🌐",
    history: url ? [url] : [],
    historyIndex: url ? 0 : -1,
    isNewTab,
    tabElement: null,
    paneElement: null,
  };

  const tabItem = document.createElement("div");
  tabItem.className = "tab-item";
  tabItem.id = `item-${tabId}`;
  tabItem.innerHTML = `
    <span class="tab-favicon">${tabData.favicon}</span>
    <span class="tab-title">${escapeHtml(title)}</span>
    <span class="tab-close" title="关闭标签页 (Ctrl+W)">×</span>
  `;

  tabItem.addEventListener("click", (e) => {
    e.stopPropagation();
    switchTab(tabId);
  });

  tabItem.querySelector(".tab-close")?.addEventListener("click", (e) => {
    e.stopPropagation();
    closeTab(tabId);
  });

  tabsBar.appendChild(tabItem);
  tabData.tabElement = tabItem;

  const pane = document.createElement("div");
  pane.className = "tab-view-pane";
  pane.id = `pane-${tabId}`;

  if (isNewTab) {
    pane.classList.add("newtab-pane");
    pane.innerHTML = renderNewTabHtml();
    bindNewTabEvents(pane, tabId);
  } else {
    pane.innerHTML = `
      <div class="quick-bookmarks-strip">
        <span class="bookmarks-label">快速网址:</span>
        <button class="bookmark-chip" data-url="https://www.google.com">🔍 Google</button>
        <button class="bookmark-chip" data-url="https://en.wikipedia.org/wiki/Paper">📄 维基百科: 纸</button>
        <button class="bookmark-chip" data-url="https://html.duckduckgo.com/html/?q=HTML-in-Canvas">🦆 DuckDuckGo</button>
        <button class="bookmark-chip" data-url="https://news.ycombinator.com">⚡ Hacker News</button>
        <button class="bookmark-chip" data-url="https://html-in-canvas.dev/docs/overview/">🌐 WICG Spec</button>
      </div>
      <iframe
        class="live-web-iframe"
        src="${proxy.getProxiedUrl(url)}"
        ${proxy.getSandboxAttr()}
        title="Paper Browser Frame ${tabId}"
      ></iframe>
    `;

    pane.querySelectorAll(".bookmark-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const u = chip.getAttribute("data-url");
        if (u) navigateTab(tabId, u);
      });
    });

    const iframe = pane.querySelector("iframe");
    if (iframe) setupIframeListeners(iframe);
  }

  tabsContainer.appendChild(pane);
  tabData.paneElement = pane;

  tabsList.push(tabData);
  valTabs.textContent = String(tabsList.length);

  if (activate) {
    switchTab(tabId);
  }

  return tabData;
}

export function createWicgNativeTab(): void {
  const tabData = createTab("wicg://native-canvas", "🎨 WICG 原生画布", true);
  if (tabData?.paneElement) {
    tabData.paneElement.innerHTML = "";
    tabData.paneElement.classList.remove("newtab-pane");
    tabData.favicon = "🎨";
    const favEl = tabData.tabElement?.querySelector(".tab-favicon");
    if (favEl) favEl.textContent = "🎨";

    const surface = new HtmlCanvasSurface();
    surface.mount(tabData.paneElement);
    tabData.surface = surface;
  }
}

export function closeTab(tabId: string): void {
  const index = tabsList.findIndex((t) => t.id === tabId);
  if (index === -1) return;

  const tabData = tabsList[index];
  tabData.surface?.destroy();
  tabData.tabElement?.remove();
  tabData.paneElement?.remove();
  tabsList.splice(index, 1);

  if (activeTabId === tabId) {
    if (tabsList.length > 0) {
      const nextIndex = Math.min(index, tabsList.length - 1);
      switchTab(tabsList[nextIndex].id);
    } else {
      createTab(null, "新标签页", true);
    }
  }

  valTabs.textContent = String(tabsList.length);
  physics.state.flutterAmount = 2.5;
  ripples.addRipple(460, 20, "#ef4444");
}

export function switchTab(tabId: string): void {
  const tabData = tabsList.find((t) => t.id === tabId);
  if (!tabData) return;

  activeTabId = tabId;

  tabsList.forEach((t) => {
    t.tabElement?.classList.toggle("active", t.id === tabId);
    t.paneElement?.classList.toggle("active", t.id === tabId);
  });

  urlInput.value = tabData.url || "";
  btnBack.disabled = tabData.historyIndex <= 0;
  btnForward.disabled = tabData.historyIndex >= tabData.history.length - 1;
}

export function navigateTab(tabId: string, rawInput: string, pushHistory = true): void {
  const tabData = tabsList.find((t) => t.id === tabId);
  if (!tabData) return;

  const trimmed = rawInput.trim();
  if (!trimmed) return;

  let finalUrl = trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    finalUrl = trimmed;
  } else if (/^[\w-]+(\.[\w-]+)+([/?#].*)?$/i.test(trimmed)) {
    finalUrl = `https://${trimmed}`;
  } else {
    finalUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(trimmed)}`;
  }

  tabData.url = finalUrl;
  tabData.isNewTab = false;

  if (tabData.paneElement?.classList.contains("newtab-pane")) {
    tabData.paneElement.classList.remove("newtab-pane");
    tabData.paneElement.innerHTML = `
      <div class="quick-bookmarks-strip">
        <span class="bookmarks-label">快速网址:</span>
        <button class="bookmark-chip" data-url="https://www.google.com">🔍 Google</button>
        <button class="bookmark-chip" data-url="https://en.wikipedia.org/wiki/Paper">📄 维基百科: 纸</button>
        <button class="bookmark-chip" data-url="https://html.duckduckgo.com/html/?q=HTML-in-Canvas">🦆 DuckDuckGo</button>
        <button class="bookmark-chip" data-url="https://news.ycombinator.com">⚡ Hacker News</button>
        <button class="bookmark-chip" data-url="https://html-in-canvas.dev/docs/overview/">🌐 WICG Spec</button>
      </div>
      <iframe
        class="live-web-iframe"
        src="${proxy.getProxiedUrl(finalUrl)}"
        ${proxy.getSandboxAttr()}
        title="Paper Browser Frame ${tabId}"
      ></iframe>
    `;

    tabData.paneElement.querySelectorAll(".bookmark-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const u = chip.getAttribute("data-url");
        if (u) navigateTab(tabId, u);
      });
    });

    const iframe = tabData.paneElement.querySelector("iframe");
    if (iframe) setupIframeListeners(iframe);
  } else {
    const iframe = tabData.paneElement?.querySelector("iframe");
    if (iframe) {
      browserProgressBar.className = "browser-progress-bar loading";
      iframe.src = proxy.getProxiedUrl(finalUrl);
    }
  }

  try {
    const u = new URL(finalUrl);
    tabData.title = u.hostname.replace(/^www\./, "");
    tabData.favicon = "🌐";
  } catch {
    tabData.title = "Web Page";
  }

  const titleEl = tabData.tabElement?.querySelector(".tab-title");
  if (titleEl) titleEl.textContent = tabData.title;

  if (pushHistory) {
    tabData.history = tabData.history.slice(0, tabData.historyIndex + 1);
    tabData.history.push(finalUrl);
    tabData.historyIndex = tabData.history.length - 1;
  }

  if (activeTabId === tabId) {
    urlInput.value = finalUrl;
    btnBack.disabled = tabData.historyIndex <= 0;
    btnForward.disabled = tabData.historyIndex >= tabData.history.length - 1;
  }
}

function setupIframeListeners(iframe: HTMLIFrameElement): void {
  iframe.addEventListener("load", () => {
    browserProgressBar.className = "browser-progress-bar";
    physics.state.flutterAmount = 3.0;
  });
}

function renderNewTabHtml(): string {
  return `
    <div class="newtab-content">
      <div class="newtab-logo">
        <span class="logo-letter c1">P</span>
        <span class="logo-letter c2">a</span>
        <span class="logo-letter c3">p</span>
        <span class="logo-letter c4">e</span>
        <span class="logo-letter c5">r</span>
        <span class="logo-letter c6" style="color:#06b6d4;margin-left:4px;">Browser</span>
      </div>
      <div class="newtab-search-box">
        <span class="search-lens">🔎</span>
        <input type="text" class="newtab-search-input" placeholder="在 3D 纸张上输入网址或搜索关键词..." />
        <button class="newtab-search-submit">进入网络</button>
      </div>
      <div class="newtab-proxy-status" id="newtabProxyStatus">
        <!-- Populated by updateProxyUI() -->
      </div>
      <div class="speeddial-grid">
        <div class="speeddial-card" data-url="https://www.google.com">
          <div class="sd-icon">🔍</div>
          <div class="sd-info">
            <span class="sd-title">Google 搜索</span>
            <span class="sd-desc">全球最大搜索引擎 (建议本地/代理模式)</span>
          </div>
        </div>
        <div class="speeddial-card" data-url="https://en.wikipedia.org/wiki/Paper">
          <div class="sd-icon">📄</div>
          <div class="sd-info">
            <span class="sd-title">维基百科: 纸 (Paper)</span>
            <span class="sd-desc">人类物理书写载体历史与物理特性</span>
          </div>
        </div>
        <div class="speeddial-card" data-url="https://html.duckduckgo.com/html/?q=HTML-in-Canvas">
          <div class="sd-icon">🦆</div>
          <div class="sd-info">
            <span class="sd-title">DuckDuckGo 极简搜索</span>
            <span class="sd-desc">极简轻量级免人机验证搜索引擎</span>
          </div>
        </div>
        <div class="speeddial-card" data-url="https://news.ycombinator.com">
          <div class="sd-icon">⚡</div>
          <div class="sd-info">
            <span class="sd-title">Hacker News</span>
            <span class="sd-desc">全球黑客科技与计算机前沿动态</span>
          </div>
        </div>
        <div class="speeddial-card" data-url="https://html-in-canvas.dev/docs/overview/">
          <div class="sd-icon">🌐</div>
          <div class="sd-info">
            <span class="sd-title">WICG Spec 规范文档</span>
            <span class="sd-desc">HTML in Canvas 原生绘制提案说明</span>
          </div>
        </div>
        <div class="speeddial-card wicg-special-card" id="btnLaunchWicgPoc">
          <div class="sd-icon">🎨</div>
          <div class="sd-info">
            <span class="sd-title">WICG 原生画布置入 PoC</span>
            <span class="sd-desc">体验真正的 layoutsubtree + drawElementImage()</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

function bindNewTabEvents(pane: HTMLElement, tabId: string): void {
  const searchInput = pane.querySelector(".newtab-search-input") as HTMLInputElement;
  const searchBtn = pane.querySelector(".newtab-search-submit") as HTMLElement;

  const doSearch = () => {
    const q = searchInput.value.trim();
    if (q) navigateTab(tabId, q);
  };

  searchBtn?.addEventListener("click", doSearch);
  searchInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSearch();
  });

  pane.querySelectorAll(".speeddial-card").forEach((card) => {
    card.addEventListener("click", () => {
      const u = card.getAttribute("data-url");
      if (u) navigateTab(tabId, u);
    });
  });

  pane.querySelector("#btnLaunchWicgPoc")?.addEventListener("click", () => {
    createWicgNativeTab();
  });
}

// Proxy UI & Switchy Controls
function updateProxyUI(): void {
  const isEdge = proxy.profile.mode === "edge";
  const isLocal = proxy.profile.mode === "local";
  const isDirect = proxy.profile.mode === "direct";

  if (proxyPillIcon && proxyPillLabel) {
    if (isLocal) {
      proxyPillIcon.textContent = "🛡️";
      proxyPillLabel.textContent = `${proxy.profile.host}:${proxy.profile.port}`;
    } else if (isDirect) {
      proxyPillIcon.textContent = "⚡";
      proxyPillLabel.textContent = "直连模式";
    } else {
      proxyPillIcon.textContent = "☁️";
      proxyPillLabel.textContent = "边缘代理";
    }
  }

  renderProxyStatusIndicator();
  if (isLocal) {
    proxy.checkHealth().then(() => renderProxyStatusIndicator());
  }

  document.getElementById("btnDockProxyEdge")?.classList.toggle("active", isEdge);
  document.getElementById("btnDockProxyLocal")?.classList.toggle("active", isLocal);
  document.getElementById("btnDockProxyDirect")?.classList.toggle("active", isDirect);

  const dockCurrentProxyLbl = document.getElementById("dockCurrentProxyLbl");
  if (dockCurrentProxyLbl) {
    dockCurrentProxyLbl.textContent = `目标: ${proxy.profile.host}:${proxy.profile.port}`;
  }

  const radio = document.querySelector(
    `input[name="modalProxyMode"][value="${proxy.profile.mode}"]`,
  ) as HTMLInputElement;
  if (radio) radio.checked = true;

  document.querySelectorAll(".modal-option").forEach((opt) => {
    opt.classList.toggle("active", opt.getAttribute("data-mode") === proxy.profile.mode);
  });

  const fullUri = proxy.getFullProxyAgentUri();
  const switchyPreviewUri = document.getElementById("switchyPreviewUri");
  const modalCmdSnippet = document.getElementById("modalCmdSnippet");
  if (switchyPreviewUri) switchyPreviewUri.textContent = fullUri || "直连 (无代理)";
  if (modalCmdSnippet) {
    const proxyEnv = fullUri ? `HTTPS_PROXY=${fullUri} ` : "";
    modalCmdSnippet.textContent = `${proxyEnv}PORT=${proxy.profile.localServerPort} bun run server`;
  }

  const statusEl = document.getElementById("newtabProxyStatus");
  if (statusEl) {
    if (isLocal) {
      statusEl.innerHTML = `当前网络: <strong>🛡️ Switchy 代理 (${fullUri})</strong> — 经由 127.0.0.1:${proxy.profile.localServerPort} 穿透`;
    } else if (isDirect) {
      statusEl.innerHTML =
        "当前网络: <strong>⚡ 直连模式 (Direct)</strong> — 网页直接在 iframe 渲染，免代理";
    } else {
      statusEl.innerHTML =
        "当前网络: <strong>☁️ Cloudflare 边缘代理</strong> | 遇到 Google/ChatGPT 验证码可切换为「🛡️ 代理」";
    }
  }
}

function renderProxyStatusIndicator(): void {
  if (!proxyPill) return;

  proxyPill.classList.remove("mode-edge", "mode-local-ok", "mode-local-err", "mode-direct");

  if (proxy.profile.mode === "local") {
    if (proxy.localHealth === "online") {
      proxyPill.classList.add("mode-local-ok");
      if (proxyStatusDot) proxyStatusDot.className = "status-indicator-dot online";
      if (proxyStatusTag) proxyStatusTag.textContent = "已连接";
      proxyPill.title = `Switchy 代理 (${proxy.getFullProxyAgentUri()}): 正常连接中`;
    } else {
      proxyPill.classList.add("mode-local-err");
      if (proxyStatusDot) proxyStatusDot.className = "status-indicator-dot offline";
      if (proxyStatusTag) proxyStatusTag.textContent = "未启动";
      proxyPill.title = `本机服务未响应或被浏览器 HTTPS 拦截。`;
    }
  } else if (proxy.profile.mode === "direct") {
    proxyPill.classList.add("mode-direct");
    if (proxyStatusDot) proxyStatusDot.className = "status-indicator-dot direct";
    if (proxyStatusTag) proxyStatusTag.textContent = "直连";
    proxyPill.title = "直连模式: 走当前浏览器网络和环境";
  } else {
    proxyPill.classList.add("mode-edge");
    if (proxyStatusDot) proxyStatusDot.className = "status-indicator-dot edge";
    if (proxyStatusTag) proxyStatusTag.textContent = "边缘就绪";
    proxyPill.title = "Cloudflare 边缘代理: 默认模式";
  }
}

function setProxyMode(newMode: ProxyClient["profile"]["mode"]): void {
  if (newMode === "local" && window.location.protocol === "https:") {
    const switchToDirect = confirm(
      "⚠️ 浏览器安全策略提示 (Mixed Content):\n\n" +
        "当前页面运行在公网 HTTPS (https://browser.xuepoo.xyz)，现代浏览器安全机制会直接拦截本地未加密的 http://127.0.0.1 (混合内容限制)。\n\n" +
        "【推荐极简免端口方案】:\n" +
        "1. 使用「⚡ 直连模式」+ Chrome 扩展 (如 Ignore X-Frame-Options)，免开本地服务，直接走当前浏览器的科学网络！\n" +
        "2. 或者在本地运行 `bun run server` 后直接在浏览器访问: http://localhost:3000\n\n" +
        "点击「确定」自动切换为【⚡ 直连模式】(推荐)，点击「取消」继续尝试本地端口。",
    );
    if (switchToDirect) {
      newMode = "direct";
    }
  }

  proxy.setMode(newMode);
  updateProxyUI();

  const activeTab = tabsList.find((t) => t.id === activeTabId);
  if (activeTab && !activeTab.isNewTab && activeTab.url) {
    navigateTab(activeTab.id, activeTab.url, false);
  }
}

function saveAndApplySwitchyProfile(
  scheme: ProxyClient["profile"]["scheme"],
  host: string,
  port: string,
): void {
  proxy.setSwitchyProfile(scheme, host, port);
  updateProxyUI();
  const activeTab = tabsList.find((t) => t.id === activeTabId);
  if (activeTab && !activeTab.isNewTab && activeTab.url) {
    navigateTab(activeTab.id, activeTab.url, false);
  }
}

// Modal open/close wiring
function openProxyModal(): void {
  updateProxyUI();
  proxyModalBackdrop?.classList.add("open");
}

function closeProxyModal(): void {
  proxyModalBackdrop?.classList.remove("open");
}

proxyPill?.addEventListener("click", openProxyModal);
btnOpenProxyModal?.addEventListener("click", openProxyModal);
btnCloseProxyModal?.addEventListener("click", closeProxyModal);
btnModalConfirm?.addEventListener("click", closeProxyModal);
proxyModalBackdrop?.addEventListener("click", (e) => {
  if (e.target === proxyModalBackdrop) closeProxyModal();
});

document.querySelectorAll('input[name="modalProxyMode"]').forEach((radio) => {
  radio.addEventListener("change", (e) => {
    setProxyMode((e.target as HTMLInputElement).value as ProxyClient["profile"]["mode"]);
  });
});

document.querySelectorAll(".modal-option").forEach((opt) => {
  opt.addEventListener("click", (e) => {
    if (
      (e.target as HTMLElement).tagName === "INPUT" ||
      (e.target as HTMLElement).closest(".switchy-profile-card")
    )
      return;
    const mode = opt.getAttribute("data-mode");
    if (mode) setProxyMode(mode as ProxyClient["profile"]["mode"]);
  });
});

// Switchy Inputs
const switchySchemeSelect = document.getElementById(
  "switchySchemeSelect",
) as HTMLSelectElement | null;
const switchyHostInput = document.getElementById("switchyHostInput") as HTMLInputElement | null;
const switchyPortInput = document.getElementById("switchyPortInput") as HTMLInputElement | null;
const modalLocalPortInput = document.getElementById(
  "modalLocalPortInput",
) as HTMLInputElement | null;

const onSwitchyChange = () => {
  const s = (switchySchemeSelect?.value || "http") as ProxyClient["profile"]["scheme"];
  const h = switchyHostInput?.value.trim() || "127.0.0.1";
  const p = switchyPortInput?.value.trim() || "7890";
  saveAndApplySwitchyProfile(s, h, p);
};

switchySchemeSelect?.addEventListener("change", onSwitchyChange);
switchyHostInput?.addEventListener("change", onSwitchyChange);
switchyPortInput?.addEventListener("change", onSwitchyChange);

modalLocalPortInput?.addEventListener("change", (e) => {
  const val = (e.target as HTMLInputElement).value.trim();
  if (val && !isNaN(Number(val))) {
    proxy.setLocalServerPort(val);
    updateProxyUI();
  }
});

// Chips in Modal and Dock
document.querySelectorAll(".switchy-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    const s = (chip.getAttribute("data-scheme") || "http") as ProxyClient["profile"]["scheme"];
    const h = chip.getAttribute("data-host") || "127.0.0.1";
    const p = chip.getAttribute("data-port") || "7890";
    saveAndApplySwitchyProfile(s, h, p);
    document.querySelectorAll(".switchy-chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
  });
});

document.querySelectorAll(".dock-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    const s = (chip.getAttribute("data-scheme") || "http") as ProxyClient["profile"]["scheme"];
    const h = chip.getAttribute("data-host") || "127.0.0.1";
    const p = chip.getAttribute("data-port") || "7890";
    saveAndApplySwitchyProfile(s, h, p);
    setProxyMode("local");
    document.querySelectorAll(".dock-chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
  });
});

document.getElementById("btnModalCopyCmd")?.addEventListener("click", async () => {
  const uri = proxy.getFullProxyAgentUri() || "http://127.0.0.1:7890";
  const cmd = `HTTPS_PROXY=${uri} PORT=${proxy.profile.localServerPort} bun run server`;
  try {
    await navigator.clipboard.writeText(cmd);
    const btn = document.getElementById("btnModalCopyCmd");
    if (btn) {
      btn.textContent = "✓ 已复制!";
      setTimeout(() => (btn.textContent = "📋 复制启动命令"), 2000);
    }
  } catch {
    // ignore
  }
});

document.getElementById("btnDockProxyEdge")?.addEventListener("click", () => setProxyMode("edge"));
document
  .getElementById("btnDockProxyLocal")
  ?.addEventListener("click", () => setProxyMode("local"));
document
  .getElementById("btnDockProxyDirect")
  ?.addEventListener("click", () => setProxyMode("direct"));

// Toolbar Buttons
btnNewTab.addEventListener("click", () => {
  createTab(null, "新标签页", true);
  ripples.addRipple(460, 20, "#38bdf8");
});

btnGoUrl.addEventListener("click", () => {
  if (activeTabId) navigateTab(activeTabId, urlInput.value);
});

urlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && activeTabId) {
    navigateTab(activeTabId, urlInput.value);
  }
});

btnHome.addEventListener("click", () => {
  if (activeTabId) createTab(null, "新标签页", true);
});

btnReload.addEventListener("click", () => {
  physics.state.flutterAmount = 5.0;
  ripples.addRipple(460, 290, "#06b6d4");
  const activeTab = tabsList.find((t) => t.id === activeTabId);
  if (!activeTab) return;
  if (activeTab.isNewTab) {
    createTab(null, "新标签页", true);
  } else if (activeTab.surface) {
    activeTab.surface.reload();
  } else {
    const iframe = activeTab.paneElement?.querySelector("iframe");
    if (iframe && activeTab.url) {
      browserProgressBar.className = "browser-progress-bar loading";
      iframe.src = proxy.getProxiedUrl(activeTab.url);
    }
  }
});

btnBack.addEventListener("click", () => {
  const activeTab = tabsList.find((t) => t.id === activeTabId);
  if (activeTab && activeTab.historyIndex > 0) {
    activeTab.historyIndex--;
    navigateTab(activeTab.id, activeTab.history[activeTab.historyIndex], false);
  }
});

btnForward.addEventListener("click", () => {
  const activeTab = tabsList.find((t) => t.id === activeTabId);
  if (activeTab && activeTab.historyIndex < activeTab.history.length - 1) {
    activeTab.historyIndex++;
    navigateTab(activeTab.id, activeTab.history[activeTab.historyIndex], false);
  }
});

// Traffic Light Controls
ctrlClose.addEventListener("click", () => {
  if (tabsList.length > 1 && activeTabId) {
    closeTab(activeTabId);
  } else {
    physics.resetAngle();
  }
});

ctrlMin.addEventListener("click", () => {
  physics.state.isMinimized = !physics.state.isMinimized;
  assemblyEl.classList.toggle("minimized", physics.state.isMinimized);
  if (physics.state.isMinimized) physics.resetAngle();
});

ctrlMax.addEventListener("click", () => {
  physics.state.isMaximized = !physics.state.isMaximized;
  assemblyEl.classList.toggle("maximized", physics.state.isMaximized);
  syncCanvasDpr();
});

// Control Dock Toggles
if (btnCollapseDock && controlDock) {
  btnCollapseDock.addEventListener("click", (e) => {
    e.stopPropagation();
    controlDock.classList.toggle("collapsed");
  });
  controlDock.addEventListener("click", () => {
    if (controlDock.classList.contains("collapsed")) {
      controlDock.classList.remove("collapsed");
    }
  });
}

btnToggleTiltLock?.addEventListener("click", () => {
  physics.state.isTiltLocked = !physics.state.isTiltLocked;
  btnToggleTiltLock.classList.toggle("active", physics.state.isTiltLocked);
  if (iconTiltLock && labelTiltLock) {
    if (physics.state.isTiltLocked) {
      physics.resetAngle();
      iconTiltLock.textContent = "🔒";
      labelTiltLock.textContent = "纸面已锁定";
    } else {
      iconTiltLock.textContent = "🔓";
      labelTiltLock.textContent = "自由倾斜";
    }
  }
});

btnToggleRipples?.addEventListener("click", () => {
  ripples.isEnabled = !ripples.isEnabled;
  btnToggleRipples.classList.toggle("active", ripples.isEnabled);
});

btnToggleClickShake?.addEventListener("click", () => {
  physics.state.isClickShakeEnabled = !physics.state.isClickShakeEnabled;
  btnToggleClickShake.classList.toggle("active", physics.state.isClickShakeEnabled);
  if (iconClickShake && labelClickShake) {
    if (physics.state.isClickShakeEnabled) {
      iconClickShake.textContent = "📳";
      labelClickShake.textContent = "振颤开启";
    } else {
      iconClickShake.textContent = "🔇";
      labelClickShake.textContent = "静止模式";
    }
  }
});

// Banner copy & close
const btnCopyFlag = document.getElementById("btnCopyFlag");
const btnCloseBanner = document.getElementById("btnCloseBanner");
const experimentBanner = document.getElementById("experimentBanner");

btnCopyFlag?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText("chrome://flags/#canvas-draw-element");
    if (btnCopyFlag) btnCopyFlag.textContent = "✓ 已复制!";
    setTimeout(() => {
      if (btnCopyFlag) btnCopyFlag.textContent = "📋 复制 Flag 地址";
    }, 2000);
  } catch {
    // ignore
  }
});

btnCloseBanner?.addEventListener("click", () => {
  experimentBanner?.classList.add("collapsed");
});

function escapeHtml(str: string): string {
  return str.replace(
    /[&<>"']/g,
    (m) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[m] || m,
  );
}

// 60 FPS Loop
let frameCount = 0;
let lastFpsTime = performance.now();

function animationLoop(timestamp: number): void {
  const phys = physics.update();
  valAngles.textContent = `${phys.rotX.toFixed(1)}° / ${phys.rotY.toFixed(1)}°`;

  const w = paperBrowser.offsetWidth || 980;
  const h = paperBrowser.offsetHeight || 620;
  ripples.render(w, h);

  frameCount++;
  if (timestamp - lastFpsTime >= 500) {
    const fps = Math.round((frameCount * 1000) / (timestamp - lastFpsTime));
    frameCount = 0;
    lastFpsTime = timestamp;
    valFps.textContent = String(fps);
  }

  requestAnimationFrame(animationLoop);
}

// App Initialization
function initApp(): void {
  syncCanvasDpr();
  setZoom(1.0);
  createTab(null, "新标签页", true);
  updateProxyUI();

  const wicgCaps = detectWicgCapabilities();
  if (wicgCaps.hasDrawElementImage) {
    statusDot.className = "dot active";
    statusText.textContent = "WICG 原生引擎: 已就绪 (原生硬件加速)";
    valEngine.textContent = "WICG Native";
  } else {
    statusDot.className = "dot";
    statusText.textContent = "3D 物理纸张兼容层 (开启 canvas-draw-element 体验原生引擎)";
    valEngine.textContent = "Iframe Surface";
  }

  requestAnimationFrame(animationLoop);
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
