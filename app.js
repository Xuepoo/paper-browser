/**
 * Paper Browser: Full-Featured 3D Floating Paper Browser
 * Features:
 * - Real in-paper live web browsing via transparent HTTP proxy
 * - Dynamic tab lifecycle (Create '+', Close '×', Switch, History per tab)
 * - Single tab by default on initial load
 * - Device Pixel Ratio (DPR) HiDPI canvas rendering & Viewport Zoom (50% - 200%)
 * - Window controls (Close, Minimize, Maximize)
 * - 3D spring tilt physics & interactive fluid canvas ripples
 */

const PROXY_ENDPOINT = window.__PAPER_PROXY_ENDPOINT__ || "/api/proxy";

// 1. DOM Elements
const paperCanvas = document.getElementById("paperCanvas");
const ctx = paperCanvas.getContext("2d");
const paperBrowser = document.getElementById("paperBrowser");
const spatialStage = document.getElementById("spatialStage");
const paperAssembly = document.getElementById("paperAssembly");
const paperShadow = document.getElementById("paperShadow");
const paperSheen = document.getElementById("paperSheen");
const ambientGlare = document.getElementById("ambientGlare");

const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const btnResetAngle = document.getElementById("btnResetAngle");

// Telemetry
const valAngles = document.getElementById("valAngles");
const valLight = document.getElementById("valLight");
const valEngine = document.getElementById("valEngine");
const valFps = document.getElementById("valFps");
const valTabs = document.getElementById("valTabs");
const valZoom = document.getElementById("valZoom");

// Browser Chrome Elements
const tabsBar = document.getElementById("tabsBar");
const btnNewTab = document.getElementById("btnNewTab");
const tabsContainer = document.getElementById("tabsContainer");
const urlInput = document.getElementById("urlInput");
const btnBack = document.getElementById("btnBack");
const btnForward = document.getElementById("btnForward");
const btnReload = document.getElementById("btnReload");
const btnHome = document.getElementById("btnHome");
const btnGoUrl = document.getElementById("btnGoUrl");
const browserProgressBar = document.getElementById("browserProgressBar");

// Zoom & DPR Elements
const btnZoomOut = document.getElementById("btnZoomOut");
const btnZoomIn = document.getElementById("btnZoomIn");
const zoomLabel = document.getElementById("zoomLabel");
const dprValue = document.getElementById("dprValue");

// Banner & Quick Control Dock Elements
const experimentBanner = document.getElementById("experimentBanner");
const btnCopyFlag = document.getElementById("btnCopyFlag");
const btnCloseBanner = document.getElementById("btnCloseBanner");

const btnSizeCompact = document.getElementById("btnSizeCompact");
const btnSizeStandard = document.getElementById("btnSizeStandard");
const btnSizeWide = document.getElementById("btnSizeWide");
const btnSizeUltra = document.getElementById("btnSizeUltra");
const btnZoomPaperIn = document.getElementById("btnZoomPaperIn");
const btnZoomPaperOut = document.getElementById("btnZoomPaperOut");

const btnToggleTiltLock = document.getElementById("btnToggleTiltLock");
const iconTiltLock = document.getElementById("iconTiltLock");
const labelTiltLock = document.getElementById("labelTiltLock");
const btnToggleRipples = document.getElementById("btnToggleRipples");
const controlDock = document.getElementById("controlDock");
const btnCollapseDock = document.getElementById("btnCollapseDock");

// Window Traffic Lights
const ctrlClose = document.querySelector(".ctrl-btn.close");
const ctrlMin = document.querySelector(".ctrl-btn.min");
const ctrlMax = document.querySelector(".ctrl-btn.max");

// 2. Physics & State
let currentRotX = 0;
let currentRotY = 0;
let targetRotX = 0;
let targetRotY = 0;
let currentZ = 0;
let targetZ = 0;
let flutterAmount = 0;
let isSpaceHeld = false;
let isMinimized = false;
let isMaximized = false;

let isTiltLocked = false;
let isRipplesEnabled = true;
let currentPaperScale = 1.0;

// Zoom State
let currentZoom = 1.0;
const zoomLevels = [0.5, 0.67, 0.75, 0.8, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0];

// Tabs State
let tabCounter = 0;
const tabsList = [];
let activeTabId = null;

// Canvas Ink Ripples System
const ripples = [];

/**
 * 3. 3D Floating Paper Physics Engine
 */
function updatePaperPhysics() {
  if (isMinimized) return;

  currentRotX += (targetRotX - currentRotX) * 0.12;
  currentRotY += (targetRotY - currentRotY) * 0.12;
  currentZ += (targetZ - currentZ) * 0.12;

  flutterAmount *= 0.88;
  const totalRotX = currentRotX + Math.sin(Date.now() * 0.02) * flutterAmount;
  const totalRotY = currentRotY + Math.cos(Date.now() * 0.02) * flutterAmount;

  // Apply 3D Transform to Paper Assembly
  paperAssembly.style.transform = `
    rotateX(${totalRotX.toFixed(2)}deg)
    rotateY(${totalRotY.toFixed(2)}deg)
    translateZ(${currentZ.toFixed(1)}px)
  `;

  // Dynamic Shadow Offset opposite to light direction
  const shadowX = -totalRotY * 1.8;
  const shadowY = totalRotX * 1.5 + 28;
  const shadowBlur = 35 + Math.abs(totalRotX) * 0.8 + Math.abs(totalRotY) * 0.8;
  const shadowOpacity = Math.max(0.35, 0.62 - currentZ * 0.003);

  paperShadow.style.transform = `translate3d(${shadowX.toFixed(1)}px, ${shadowY.toFixed(1)}px, -70px)`;
  paperShadow.style.filter = `blur(${shadowBlur.toFixed(1)}px)`;
  paperShadow.style.backgroundColor = `rgba(0, 0, 0, ${shadowOpacity.toFixed(2)})`;

  // Dynamic Specular Highlight on Paper Surface
  const sheenAngle = Math.atan2(totalRotY, -totalRotX) * (180 / Math.PI) + 90;
  const sheenAlpha = Math.min(0.28, (Math.abs(totalRotX) + Math.abs(totalRotY)) * 0.008 + 0.04);
  paperSheen.style.background = `linear-gradient(${sheenAngle.toFixed(1)}deg, rgba(255, 255, 255, ${sheenAlpha.toFixed(2)}) 0%, transparent 60%)`;

  valAngles.textContent = `${totalRotX.toFixed(1)}° / ${totalRotY.toFixed(1)}°`;
}

// Track mouse on spatial stage
spatialStage.addEventListener("mousemove", (e) => {
  if (isTiltLocked || isSpaceHeld || isMinimized) return;

  const rect = spatialStage.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const normX = (mouseX - rect.width / 2) / (rect.width / 2);
  const normY = (mouseY - rect.height / 2) / (rect.height / 2);

  targetRotY = Math.max(-26, Math.min(26, normX * 26));
  targetRotX = Math.max(-22, Math.min(22, -normY * 22));
  targetZ = 20;

  ambientGlare.style.background = `radial-gradient(circle at ${mouseX}px ${mouseY}px, rgba(56, 189, 248, 0.1) 0%, transparent 55%)`;
  valLight.textContent = `X: ${Math.round(mouseX)}px, Y: ${Math.round(mouseY)}px`;
});

spatialStage.addEventListener("mouseleave", () => {
  targetRotX = 0;
  targetRotY = 0;
  targetZ = 0;
});

// Space key resets angle smoothly
window.addEventListener("keydown", (e) => {
  if (e.code === "Space" && e.target.tagName !== "INPUT") {
    e.preventDefault();
    isSpaceHeld = true;
    targetRotX = 0;
    targetRotY = 0;
    targetZ = 0;
  }
});

window.addEventListener("keyup", (e) => {
  if (e.code === "Space") {
    isSpaceHeld = false;
  }
});

btnResetAngle.addEventListener("click", () => {
  targetRotX = 0;
  targetRotY = 0;
  targetZ = 0;
});

/**
 * 4. Canvas DPR & HiDPI Sharpness System
 */
function syncCanvasDPR() {
  const dpr = window.devicePixelRatio || 1;
  dprValue.textContent = dpr % 1 === 0 ? `${dpr}x` : `${dpr.toFixed(1)}x`;

  const cssWidth = paperBrowser.offsetWidth || 980;
  const cssHeight = paperBrowser.offsetHeight || 620;

  paperCanvas.width = Math.round(cssWidth * dpr);
  paperCanvas.height = Math.round(cssHeight * dpr);
  paperCanvas.style.width = cssWidth + "px";
  paperCanvas.style.height = cssHeight + "px";

  ctx.resetTransform();
  ctx.scale(dpr, dpr);
}

window.addEventListener("resize", syncCanvasDPR);

/**
 * 5. Canvas Dynamic Fluid Ink Ripples System
 */
function addRipple(x, y, color = "#38bdf8") {
  if (!isRipplesEnabled) return;
  ripples.push({
    x,
    y,
    radius: 4,
    maxRadius: 180,
    alpha: 0.55,
    speed: 4.8,
    color,
  });
}

paperBrowser.addEventListener("pointerdown", (e) => {
  if (e.target.closest(".browser-header") || e.target.closest(".browser-toolbar")) {
    return;
  }
  const rect = paperBrowser.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  addRipple(x, y);
});

function renderCanvasEffects() {
  const cssWidth = paperBrowser.offsetWidth || 980;
  const cssHeight = paperBrowser.offsetHeight || 620;
  ctx.clearRect(0, 0, cssWidth, cssHeight);
  // Update and draw active ripples
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i];

    ctx.save();
    // Primary outer wave ring
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(56, 189, 248, ${r.alpha.toFixed(3)})`;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Secondary inner echo ring
    if (r.radius > 20) {
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius * 0.65, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(99, 102, 241, ${(r.alpha * 0.5).toFixed(3)})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Soft core glow
    const grad = ctx.createRadialGradient(r.x, r.y, 0, r.x, r.y, Math.max(10, r.radius * 0.8));
    grad.addColorStop(0, `rgba(56, 189, 248, ${(r.alpha * 0.25).toFixed(3)})`);
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(r.x, r.y, Math.max(10, r.radius * 0.8), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    r.radius += r.speed;
    r.alpha *= 0.94;

    if (r.alpha < 0.01 || r.radius > r.maxRadius) {
      ripples.splice(i, 1);
    }
  }
}

/**
 * 6. Viewport Zoom & DPR Scaling Control
 */
function setZoom(level) {
  currentZoom = Math.max(0.5, Math.min(2.0, Math.round(level * 100) / 100));
  const percentText = `${Math.round(currentZoom * 100)}%`;
  zoomLabel.textContent = percentText;
  valZoom.textContent = percentText;

  // Apply zoom to all active tabs
  tabsContainer.style.zoom = currentZoom;
  flutterAmount = 2.0;
}

function zoomIn() {
  const next = zoomLevels.find((z) => z > currentZoom + 0.02) ?? Math.min(2.0, currentZoom + 0.1);
  setZoom(next);
}

function zoomOut() {
  const prev =
    [...zoomLevels].reverse().find((z) => z < currentZoom - 0.02) ??
    Math.max(0.5, currentZoom - 0.1);
  setZoom(prev);
}

btnZoomIn.addEventListener("click", zoomIn);
btnZoomOut.addEventListener("click", zoomOut);
zoomLabel.addEventListener("click", () => setZoom(1.0));

// Keyboard shortcuts for Zoom (Ctrl + / Ctrl - / Ctrl 0)
window.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey) {
    if (e.key === "=" || e.key === "+") {
      e.preventDefault();
      zoomIn();
    } else if (e.key === "-") {
      e.preventDefault();
      zoomOut();
    } else if (e.key === "0") {
      e.preventDefault();
      setZoom(1.0);
    } else if (e.key.toLowerCase() === "t") {
      e.preventDefault();
      createTab(null, "新标签页", true);
    } else if (e.key.toLowerCase() === "w") {
      e.preventDefault();
      if (activeTabId) closeTab(activeTabId);
    }
  }
});

// Mouse Wheel Scroll & Zoom Handling for Paper Browser
paperBrowser.addEventListener(
  "wheel",
  (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      if (e.deltaY < 0) {
        zoomIn();
      } else if (e.deltaY > 0) {
        zoomOut();
      }
      return;
    }

    // Scroll active tab content
    const activeTab = tabsList.find((t) => t.id === activeTabId);
    if (!activeTab || !activeTab.paneElement) return;

    if (activeTab.isNewTab) {
      const ntp = activeTab.paneElement.querySelector(".newtab-pane");
      if (ntp) {
        ntp.scrollBy({ top: e.deltaY, left: e.deltaX, behavior: "auto" });
      }
    } else {
      const iframe = activeTab.paneElement.querySelector("iframe");
      if (iframe && iframe.contentWindow) {
        try {
          let dy = e.deltaY;
          let dx = e.deltaX;
          if (e.deltaMode === 1) {
            dy *= 20;
            dx *= 20;
          } else if (e.deltaMode === 2) {
            dy *= 400;
            dx *= 400;
          }
          iframe.contentWindow.scrollBy({
            top: dy,
            left: dx,
            behavior: "auto",
          });
        } catch {}
      }
    }
  },
  { passive: false },
);

/**
 * 7. Dynamic Tabs Lifecycle Management
 */
function createTab(url = null, title = "新标签页", activate = true) {
  const tabId = "tab-" + ++tabCounter;
  const isNewTab = !url;

  const tabData = {
    id: tabId,
    url: url || "",
    title: title,
    favicon: isNewTab ? "📄" : "🌐",
    history: url ? [url] : [],
    historyIndex: url ? 0 : -1,
    isNewTab: isNewTab,
    tabElement: null,
    paneElement: null,
  };

  // 1. Create Tab Item in Tab Bar
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

  const closeBtn = tabItem.querySelector(".tab-close");
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    closeTab(tabId);
  });

  tabsBar.appendChild(tabItem);
  tabData.tabElement = tabItem;

  // 2. Create Viewport Pane
  const pane = document.createElement("div");
  pane.className = "tab-view-pane";
  pane.id = `pane-${tabId}`;

  if (isNewTab) {
    pane.classList.add("newtab-pane");
    pane.innerHTML = `
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
        <div class="speeddial-grid">
          <div class="speeddial-card" data-url="https://en.wikipedia.org/wiki/Paper">
            <div class="sd-icon">📄</div>
            <div class="sd-info">
              <span class="sd-title">维基百科: 纸 (Paper)</span>
              <span class="sd-desc">探索人类书写载体与纸张物理历史</span>
            </div>
          </div>
          <div class="speeddial-card" data-url="https://html.duckduckgo.com/html/?q=HTML-in-Canvas">
            <div class="sd-icon">🦆</div>
            <div class="sd-info">
              <span class="sd-title">DuckDuckGo 全网搜索</span>
              <span class="sd-desc">极简轻量级真实搜索引擎</span>
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
        </div>
      </div>
    `;

    const searchInput = pane.querySelector(".newtab-search-input");
    const searchBtn = pane.querySelector(".newtab-search-submit");

    const doSearch = () => {
      const q = searchInput.value.trim();
      if (q) navigateTab(tabId, q);
    };

    searchBtn.addEventListener("click", doSearch);
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doSearch();
    });

    pane.querySelectorAll(".speeddial-card").forEach((card) => {
      card.addEventListener("click", () => {
        const u = card.getAttribute("data-url");
        if (u) navigateTab(tabId, u);
      });
    });
  } else {
    pane.innerHTML = `
      <div class="quick-bookmarks-strip">
        <span class="bookmarks-label">快速网址:</span>
        <button class="bookmark-chip" data-url="https://en.wikipedia.org/wiki/Paper">📄 维基百科: 纸</button>
        <button class="bookmark-chip" data-url="https://html.duckduckgo.com/html/?q=HTML-in-Canvas">🦆 DuckDuckGo</button>
        <button class="bookmark-chip" data-url="https://news.ycombinator.com">⚡ Hacker News</button>
        <button class="bookmark-chip" data-url="https://html-in-canvas.dev/docs/overview/">🌐 WICG Spec</button>
        <button class="bookmark-chip" data-url="https://example.com">💻 Example</button>
      </div>
      <iframe
        class="live-web-iframe"
        src="${PROXY_ENDPOINT}?url=${encodeURIComponent(url)}"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
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
    setupIframeListeners(iframe, tabId);
  }

  tabsContainer.appendChild(pane);
  tabData.paneElement = pane;

  tabsList.push(tabData);
  valTabs.textContent = tabsList.length;

  if (activate) {
    switchTab(tabId);
  }

  return tabData;
}

function closeTab(tabId) {
  const index = tabsList.findIndex((t) => t.id === tabId);
  if (index === -1) return;

  const tabData = tabsList[index];
  tabData.tabElement.remove();
  tabData.paneElement.remove();
  tabsList.splice(index, 1);

  // If closed tab was active, switch to neighbor
  if (activeTabId === tabId) {
    if (tabsList.length > 0) {
      const nextIndex = Math.min(index, tabsList.length - 1);
      switchTab(tabsList[nextIndex].id);
    } else {
      // Default at least 1 tab: create a fresh tab!
      createTab(null, "新标签页", true);
    }
  }

  valTabs.textContent = tabsList.length;
  flutterAmount = 2.5;
  addRipple(460, 20, "#ef4444");
}

function switchTab(tabId) {
  const tabData = tabsList.find((t) => t.id === tabId);
  if (!tabData) return;

  activeTabId = tabId;

  // Update tabs UI
  tabsList.forEach((t) => {
    t.tabElement.classList.toggle("active", t.id === tabId);
    t.paneElement.classList.toggle("active", t.id === tabId);
  });

  // Update URL bar
  urlInput.value = tabData.url || "";

  // Update Back / Forward buttons
  btnBack.disabled = tabData.historyIndex <= 0;
  btnForward.disabled = tabData.historyIndex >= tabData.history.length - 1;

  flutterAmount = 2.0;
}

function navigateTab(tabId, rawInput, pushHistory = true) {
  const tabData = tabsList.find((t) => t.id === tabId);
  if (!tabData) return;

  let trimmed = rawInput.trim();
  if (!trimmed) return;

  // Normalize URL or Search Query
  let finalUrl = trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    finalUrl = trimmed;
  } else if (/^[\w-]+(\.[\w-]+)+([/?#].*)?$/i.test(trimmed)) {
    finalUrl = "https://" + trimmed;
  } else {
    finalUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(trimmed)}`;
  }

  tabData.url = finalUrl;
  tabData.isNewTab = false;

  // If pane was a newtab pane, reconstruct it as live web pane
  if (tabData.paneElement.classList.contains("newtab-pane")) {
    tabData.paneElement.classList.remove("newtab-pane");
    tabData.paneElement.innerHTML = `
      <div class="quick-bookmarks-strip">
        <span class="bookmarks-label">快速网址:</span>
        <button class="bookmark-chip" data-url="https://en.wikipedia.org/wiki/Paper">📄 维基百科: 纸</button>
        <button class="bookmark-chip" data-url="https://html.duckduckgo.com/html/?q=HTML-in-Canvas">🦆 DuckDuckGo</button>
        <button class="bookmark-chip" data-url="https://news.ycombinator.com">⚡ Hacker News</button>
        <button class="bookmark-chip" data-url="https://html-in-canvas.dev/docs/overview/">🌐 WICG Spec</button>
        <button class="bookmark-chip" data-url="https://example.com">💻 Example</button>
      </div>
      <iframe
        class="live-web-iframe"
        src="${PROXY_ENDPOINT}?url=${encodeURIComponent(finalUrl)}"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
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
    setupIframeListeners(iframe, tabId);
  } else {
    // Normal navigation on existing iframe
    const iframe = tabData.paneElement.querySelector("iframe");
    if (iframe) {
      browserProgressBar.className = "browser-progress-bar loading";
      iframe.src = `${PROXY_ENDPOINT}?url=${encodeURIComponent(finalUrl)}`;
    }
  }

  // Update tab title and favicon
  try {
    const u = new URL(finalUrl);
    tabData.title = u.hostname.replace(/^www\./, "");
    tabData.favicon = "🌐";
  } catch {
    tabData.title = "Web Page";
  }

  const titleEl = tabData.tabElement.querySelector(".tab-title");
  if (titleEl) titleEl.textContent = tabData.title;
  const favEl = tabData.tabElement.querySelector(".tab-favicon");
  if (favEl) favEl.textContent = tabData.favicon;

  if (activeTabId === tabId) {
    urlInput.value = finalUrl;
  }

  if (pushHistory) {
    if (tabData.history[tabData.historyIndex] !== finalUrl) {
      tabData.history.splice(tabData.historyIndex + 1);
      tabData.history.push(finalUrl);
      tabData.historyIndex = tabData.history.length - 1;
    }
  }

  // Update Back/Forward button states
  if (activeTabId === tabId) {
    btnBack.disabled = tabData.historyIndex <= 0;
    btnForward.disabled = tabData.historyIndex >= tabData.history.length - 1;
  }

  flutterAmount = 3.5;
}

function setupIframeListeners(iframe, tabId) {
  iframe.addEventListener("load", () => {
    browserProgressBar.className = "browser-progress-bar finished";
    setTimeout(() => {
      browserProgressBar.className = "browser-progress-bar";
    }, 400);

    const tabData = tabsList.find((t) => t.id === tabId);
    if (!tabData) return;

    try {
      if (iframe.contentWindow) {
        iframe.contentWindow.addEventListener(
          "wheel",
          (e) => {
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault();
              handlePaperZoom(-Math.sign(e.deltaY));
              return;
            }
            let dy = e.deltaY;
            let dx = e.deltaX;
            if (e.deltaMode === 1) {
              dy *= 20;
              dx *= 20;
            } else if (e.deltaMode === 2) {
              dy *= 400;
              dx *= 400;
            }
            iframe.contentWindow?.scrollBy({
              top: dy,
              left: dx,
              behavior: "auto",
            });
          },
          { passive: false },
        );
      }
    } catch {}
  });
}

// PostMessage Bridge: handles mouse movement, navigation, and zoom inside live iframe
window.addEventListener("message", (e) => {
  if (e.data?.type === "paper_iframe_mousemove") {
    if (isTiltLocked || isSpaceHeld || isMinimized) return;
    const activeTab = tabsList.find((t) => t.id === activeTabId);
    if (!activeTab || !activeTab.paneElement) return;

    const iframe = activeTab.paneElement.querySelector("iframe");
    if (!iframe) return;

    const iframeRect = iframe.getBoundingClientRect();
    const stageRect = spatialStage.getBoundingClientRect();

    const mouseX = iframeRect.left + e.data.clientX - stageRect.left;
    const mouseY = iframeRect.top + e.data.clientY - stageRect.top;

    const normX = (mouseX - stageRect.width / 2) / (stageRect.width / 2);
    const normY = (mouseY - stageRect.height / 2) / (stageRect.height / 2);

    targetRotY = Math.max(-26, Math.min(26, normX * 26));
    targetRotX = Math.max(-22, Math.min(22, -normY * 22));
    targetZ = 20;

    ambientGlare.style.background = `radial-gradient(circle at ${mouseX}px ${mouseY}px, rgba(56, 189, 248, 0.1) 0%, transparent 55%)`;
    valLight.textContent = `X: ${Math.round(mouseX)}px, Y: ${Math.round(mouseY)}px`;
  } else if (e.data?.type === "paper_iframe_click") {
    const activeTab = tabsList.find((t) => t.id === activeTabId);
    if (!activeTab || !activeTab.paneElement) return;

    const iframe = activeTab.paneElement.querySelector("iframe");
    if (!iframe) return;

    const iframeRect = iframe.getBoundingClientRect();
    const canvasRect = paperCanvas.getBoundingClientRect();
    const x = iframeRect.left + e.data.clientX - canvasRect.left;
    const y = iframeRect.top + e.data.clientY - canvasRect.top;
    addRipple(x, y, "#38bdf8");
  } else if (e.data?.type === "paper_iframe_zoom") {
    if (e.data.deltaY < 0) {
      zoomIn();
    } else if (e.data.deltaY > 0) {
      zoomOut();
    }
  } else if (e.data?.type === "paper_navigate") {
    if (activeTabId) {
      navigateTab(activeTabId, e.data.url);
    }
  }
});

// Banner & Quick Control Dock Listeners
if (btnCopyFlag) {
  btnCopyFlag.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText("chrome://flags/#canvas-draw-element");
      btnCopyFlag.textContent = "✓ 已复制!";
      setTimeout(() => {
        btnCopyFlag.textContent = "📋 复制 Flag 地址";
      }, 2200);
    } catch {
      btnCopyFlag.textContent = "chrome://flags/#canvas-draw-element";
    }
  });
}

if (btnCloseBanner) {
  btnCloseBanner.addEventListener("click", () => {
    experimentBanner?.classList.add("collapsed");
  });
}

function setPaperSize(sizeClass) {
  paperAssembly.classList.remove("size-compact", "size-standard", "size-wide", "size-ultra");
  if (sizeClass) {
    paperAssembly.classList.add(sizeClass);
  }

  [btnSizeCompact, btnSizeStandard, btnSizeWide, btnSizeUltra].forEach((btn) => {
    if (btn) btn.classList.remove("active");
  });

  if (sizeClass === "size-compact") btnSizeCompact?.classList.add("active");
  else if (sizeClass === "size-wide") btnSizeWide?.classList.add("active");
  else if (sizeClass === "size-ultra") btnSizeUltra?.classList.add("active");
  else btnSizeStandard?.classList.add("active");

  setTimeout(syncCanvasDPR, 50);
}

btnSizeCompact?.addEventListener("click", () => setPaperSize("size-compact"));
btnSizeStandard?.addEventListener("click", () => setPaperSize("size-standard"));
btnSizeWide?.addEventListener("click", () => setPaperSize("size-wide"));
btnSizeUltra?.addEventListener("click", () => setPaperSize("size-ultra"));

btnZoomPaperIn?.addEventListener("click", () => {
  currentPaperScale = Math.min(1.35, currentPaperScale + 0.1);
  paperAssembly.style.setProperty("--paper-width", `${Math.round(980 * currentPaperScale)}px`);
  paperAssembly.style.setProperty("--paper-height", `${Math.round(620 * currentPaperScale)}px`);
  setTimeout(syncCanvasDPR, 50);
});

btnZoomPaperOut?.addEventListener("click", () => {
  currentPaperScale = Math.max(0.7, currentPaperScale - 0.1);
  paperAssembly.style.setProperty("--paper-width", `${Math.round(980 * currentPaperScale)}px`);
  paperAssembly.style.setProperty("--paper-height", `${Math.round(620 * currentPaperScale)}px`);
  setTimeout(syncCanvasDPR, 50);
});

btnToggleTiltLock?.addEventListener("click", () => {
  isTiltLocked = !isTiltLocked;
  btnToggleTiltLock.classList.toggle("active", isTiltLocked);
  if (isTiltLocked) {
    targetRotX = 0;
    targetRotY = 0;
    targetZ = 0;
    if (iconTiltLock) iconTiltLock.textContent = "🔒";
    if (labelTiltLock) labelTiltLock.textContent = "纸面已锁定";
  } else {
    if (iconTiltLock) iconTiltLock.textContent = "🔓";
    if (labelTiltLock) labelTiltLock.textContent = "自由倾斜";
  }
});

btnToggleRipples?.addEventListener("click", () => {
  isRipplesEnabled = !isRipplesEnabled;
  btnToggleRipples.classList.toggle("active", isRipplesEnabled);
});

if (btnCollapseDock && controlDock) {
  btnCollapseDock.addEventListener("click", (e) => {
    e.stopPropagation();
    controlDock.classList.toggle("collapsed");
    btnCollapseDock.title = controlDock.classList.contains("collapsed")
      ? "展开控制面板"
      : "收起控制面板";
  });

  controlDock.addEventListener("click", () => {
    if (controlDock.classList.contains("collapsed")) {
      controlDock.classList.remove("collapsed");
      btnCollapseDock.title = "收起控制面板";
    }
  });
}

// New Tab Button Click '+'
btnNewTab.addEventListener("click", () => {
  createTab(null, "新标签页", true);
  addRipple(460, 20, "#38bdf8");
});

// Toolbar Controls
btnGoUrl.addEventListener("click", () => {
  if (activeTabId) navigateTab(activeTabId, urlInput.value);
});

urlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && activeTabId) {
    navigateTab(activeTabId, urlInput.value);
  }
});

btnHome.addEventListener("click", () => {
  if (activeTabId) {
    createTab(null, "新标签页", true);
  }
});

btnReload.addEventListener("click", () => {
  flutterAmount = 9.0;
  addRipple(460, 290, "#06b6d4");

  const activeTab = tabsList.find((t) => t.id === activeTabId);
  if (!activeTab) return;

  if (activeTab.isNewTab) {
    createTab(null, "新标签页", true);
  } else {
    const iframe = activeTab.paneElement?.querySelector("iframe");
    if (iframe) {
      browserProgressBar.className = "browser-progress-bar loading";
      iframe.src = `${PROXY_ENDPOINT}?url=${encodeURIComponent(activeTab.url)}&t=${Date.now()}`;
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

/**
 * 8. Window Traffic Light Controls (Close / Min / Max)
 */
ctrlClose.addEventListener("click", () => {
  flutterAmount = 16.0;
  addRipple(60, 20, "#ef4444");
  // Close active tab or reset view
  if (tabsList.length > 1 && activeTabId) {
    closeTab(activeTabId);
  } else {
    // Reset angle
    targetRotX = 0;
    targetRotY = 0;
    targetZ = 0;
  }
});

ctrlMin.addEventListener("click", () => {
  isMinimized = !isMinimized;
  paperAssembly.classList.toggle("minimized", isMinimized);
  if (isMinimized) {
    targetRotX = 0;
    targetRotY = 0;
    targetZ = 0;
  }
});

ctrlMax.addEventListener("click", () => {
  isMaximized = !isMaximized;
  paperAssembly.classList.toggle("maximized", isMaximized);
  syncCanvasDPR();
  flutterAmount = 5.0;
});

function escapeHtml(str) {
  return str.replace(
    /[&<>"']/g,
    (m) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[m],
  );
}

/**
 * 9. Main 60FPS Animation Loop
 */
let frameCount = 0;
let lastFpsTime = performance.now();

function animationLoop(timestamp) {
  // 3D Tilt Physics
  updatePaperPhysics();

  // Canvas Ink Ripples
  renderCanvasEffects();

  // FPS calculation
  frameCount++;
  if (timestamp - lastFpsTime >= 500) {
    const fps = Math.round((frameCount * 1000) / (timestamp - lastFpsTime));
    frameCount = 0;
    lastFpsTime = timestamp;
    valFps.textContent = fps;
  }

  requestAnimationFrame(animationLoop);
}

// 10. Initialization
function initPaperBrowser() {
  syncCanvasDPR();
  setZoom(1.0);

  // Default: start with exactly ONE tab as requested
  createTab("https://en.wikipedia.org/wiki/Paper", "维基百科: 纸", true);

  statusDot.className = "dot active";
  statusText.textContent = "3D 物理纸张引擎: 运行中 (动态多标签 + DPR缩放)";
  valEngine.textContent = "3D Paper Browser";

  requestAnimationFrame(animationLoop);
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", initPaperBrowser);
} else {
  initPaperBrowser();
}
