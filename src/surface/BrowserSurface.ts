/**
 * BrowserSurface Architecture
 * Abstract contract for rendering surfaces in Paper Browser:
 * - IframeSurface: External public web viewing via isolated proxy
 * - HtmlCanvasSurface: Native WICG HTML-in-Canvas rendering via layoutsubtree + drawElementImage
 */

export type SurfaceKind = "iframe" | "html-canvas";

export interface SurfaceNavigationEvent {
  url: string;
  title?: string;
  isNewTab?: boolean;
}

export interface BrowserSurface {
  readonly kind: SurfaceKind;
  readonly element: HTMLElement;
  mount(container: HTMLElement): void;
  destroy(): void;
  navigate(url: string): Promise<void>;
  reload(): void;
  setZoom(zoom: number): void;
  onNavigate?(handler: (e: SurfaceNavigationEvent) => void): void;
}
