import type { BrowserSurface, SurfaceKind, SurfaceNavigationEvent } from "./BrowserSurface.ts";

/**
 * IframeSurface
 * Surface implementation for viewing arbitrary public web pages via isolated proxy.
 */
export class IframeSurface implements BrowserSurface {
  readonly kind: SurfaceKind = "iframe";
  readonly element: HTMLElement;
  private iframe: HTMLIFrameElement;
  private navigateHandler?: (e: SurfaceNavigationEvent) => void;

  constructor(initialUrl: string, proxiedUrl: string, sandboxAttr: string) {
    this.element = document.createElement("div");
    this.element.className = "iframe-surface-container";

    this.iframe = document.createElement("iframe");
    this.iframe.className = "live-web-iframe";
    this.iframe.src = proxiedUrl;
    if (sandboxAttr) {
      this.iframe.setAttribute("sandbox", sandboxAttr);
    }
    this.iframe.title = `Paper Browser Frame: ${initialUrl}`;

    this.element.appendChild(this.iframe);
  }

  mount(container: HTMLElement): void {
    container.appendChild(this.element);
  }

  destroy(): void {
    this.element.remove();
  }

  async navigate(proxiedUrl: string): Promise<void> {
    this.iframe.src = proxiedUrl;
  }

  reload(): void {
    const currentSrc = this.iframe.src;
    this.iframe.src = currentSrc;
  }

  setZoom(zoom: number): void {
    this.iframe.style.transform = `scale(${zoom})`;
    this.iframe.style.transformOrigin = "top left";
    this.iframe.style.width = `${100 / zoom}%`;
    this.iframe.style.height = `${100 / zoom}%`;
  }

  onNavigate(handler: (e: SurfaceNavigationEvent) => void): void {
    this.navigateHandler = handler;
  }

  get contentWindow(): Window | null {
    return this.iframe.contentWindow;
  }
}
