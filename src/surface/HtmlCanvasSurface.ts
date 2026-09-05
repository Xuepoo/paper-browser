import type { BrowserSurface, SurfaceKind, SurfaceNavigationEvent } from "./BrowserSurface.ts";
import { detectWicgCapabilities } from "./detector.ts";

/**
 * HtmlCanvasSurface
 * Native WICG HTML-in-Canvas Surface implementation.
 * Renders real interactive DOM subtrees inside a `<canvas layoutsubtree>`
 * using `ctx.drawElementImage()`.
 */
export class HtmlCanvasSurface implements BrowserSurface {
  readonly kind: SurfaceKind = "html-canvas";
  readonly element: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private docContainer: HTMLElement;
  private capabilities = detectWicgCapabilities();
  private animId: number | null = null;
  private navigateHandler?: (e: SurfaceNavigationEvent) => void;

  constructor() {
    this.element = document.createElement("div");
    this.element.className = "wicg-surface-container";

    // 1. Create canvas with WICG layoutsubtree attribute
    this.canvas = document.createElement("canvas");
    this.canvas.className = "wicg-native-canvas";
    this.canvas.setAttribute("layoutsubtree", "");
    this.ctx = this.canvas.getContext("2d");

    // 2. Create rich interactive DOM document embedded inside canvas
    this.docContainer = document.createElement("div");
    this.docContainer.className = "wicg-paper-doc";
    this.docContainer.setAttribute("tabindex", "0");
    this.renderSampleDocument();

    this.canvas.appendChild(this.docContainer);
    this.element.appendChild(this.canvas);

    this.setupRenderingPipeline();
  }

  mount(container: HTMLElement): void {
    container.appendChild(this.element);
    this.syncDimensions();
  }

  destroy(): void {
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    this.element.remove();
  }

  async navigate(url: string): Promise<void> {
    // For Native HTML-in-Canvas, render document or notice
    this.docContainer
      .querySelector(".doc-url-badge")
      ?.replaceChildren(document.createTextNode(`文档源: ${url}`));
  }

  reload(): void {
    this.renderSampleDocument();
    this.syncDimensions();
  }

  setZoom(zoom: number): void {
    this.docContainer.style.transform = `scale(${zoom})`;
    this.docContainer.style.transformOrigin = "top left";
    this.paint();
  }

  onNavigate(handler: (e: SurfaceNavigationEvent) => void): void {
    this.navigateHandler = handler;
  }

  private syncDimensions(): void {
    const rect = this.element.getBoundingClientRect();
    const w = Math.round(rect.width || 980);
    const h = Math.round(rect.height || 620);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;

    if (this.ctx) {
      this.ctx.resetTransform();
      this.ctx.scale(dpr, dpr);
    }
    this.paint();
  }

  private paint(): void {
    if (!this.ctx) return;

    // Check if WICG native drawElementImage is available
    const ctxAny = this.ctx as unknown as {
      drawElementImage?: (el: Element, x: number, y: number) => DOMMatrixReadOnly;
    };

    if (typeof ctxAny.drawElementImage === "function") {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      try {
        ctxAny.drawElementImage(this.docContainer, 0, 0);
      } catch {
        // Fallback gracefully if DOM contains restricted elements
      }
    }
  }

  private setupRenderingPipeline(): void {
    // 1. Listen to WICG paint event if supported
    this.canvas.addEventListener("paint", () => {
      this.paint();
    });

    // 2. Interactive event listeners on DOM document
    this.docContainer.addEventListener("input", () => this.paint());
    this.docContainer.addEventListener("click", () => this.paint());

    // 3. Continuous sync
    const renderLoop = () => {
      if (this.capabilities.hasDrawElementImage) {
        this.paint();
      }
      this.animId = requestAnimationFrame(renderLoop);
    };
    this.animId = requestAnimationFrame(renderLoop);
  }

  private renderSampleDocument(): void {
    const isSupported = this.capabilities.hasDrawElementImage;
    this.docContainer.innerHTML = `
      <div class="doc-header-strip">
        <div class="doc-badge ${isSupported ? "supported" : "trial"}">
          ${
            isSupported
              ? "✓ WICG HTML-in-Canvas 原生引擎运行中"
              : "⚠️ 当前浏览器未开启 drawElementImage 实验选项"
          }
        </div>
        <span class="doc-url-badge">文档模式: Native DOM Composition</span>
      </div>

      <article class="doc-article">
        <h1>WICG HTML-in-Canvas 原生渲染规范技术验证</h1>
        <p class="lead-text">
          在传统 Web 开发中，HTML DOM 与 Canvas 是两条割裂的管线。WICG <code>&lt;canvas layoutsubtree&gt;</code>
          首次打破了这一界限，允许将<strong>真实、可选择、保留无障碍辅助树 (A11y)</strong> 的 HTML 节点直接作为 Canvas/WebGL/WebGPU 的渲染纹理对象。
        </p>

        <div class="doc-interactive-panel">
          <h3>交互式原生 DOM 控件验证</h3>
          <p>在此直接打字或点击，验证 Canvas 下子元素的原生事件流、焦点与排版：</p>
          <div class="doc-form-row">
            <input type="text" class="doc-input" placeholder="在置于 Canvas 内的 DOM 元素上打字..." value="HTML inside Canvas is live!" />
            <button type="button" class="doc-btn" id="btnDocCounter">点按交互 (点击数: <span id="docCounterVal">0</span>)</button>
          </div>
          <div class="doc-checkbox-row">
            <label><input type="checkbox" checked /> 保持无障碍阅读树 (Accessibility Tree)</label>
            <label><input type="checkbox" checked /> 参与浏览器原生排版 (Participate in Layout)</label>
          </div>
        </div>

        <div class="doc-callout">
          <strong>💡 开启 Chromium 原生特性体验完整管线：</strong>
          在 Chrome 地址栏打开 <code>chrome://flags/#canvas-draw-element</code> 并设为 <strong>Enabled</strong>，重启浏览器即可由 <code>ctx.drawElementImage()</code> 执行原生合成！
        </div>
      </article>
    `;

    // Bind sample interactive elements
    const counterBtn = this.docContainer.querySelector("#btnDocCounter");
    const counterVal = this.docContainer.querySelector("#docCounterVal");
    let count = 0;
    if (counterBtn && counterVal) {
      counterBtn.addEventListener("click", () => {
        count++;
        counterVal.textContent = String(count);
        this.paint();
      });
    }
  }
}
