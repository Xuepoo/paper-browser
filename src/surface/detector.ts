/**
 * WICG HTML-in-Canvas Feature Detection
 * Detects whether the current browser supports:
 * 1. ctx.drawElementImage() (2D Canvas drawing of DOM element)
 * 2. layoutsubtree attribute on HTMLCanvasElement
 */

export interface WicgCapabilities {
  hasDrawElementImage: boolean;
  hasLayoutSubtree: boolean;
  isFullySupported: boolean;
  summaryText: string;
}

export function detectWicgCapabilities(): WicgCapabilities {
  if (typeof window === "undefined") {
    return {
      hasDrawElementImage: false,
      hasLayoutSubtree: false,
      isFullySupported: false,
      summaryText: "Non-browser environment",
    };
  }

  const hasDrawElementImage =
    typeof CanvasRenderingContext2D !== "undefined" &&
    "drawElementImage" in CanvasRenderingContext2D.prototype;

  let hasLayoutSubtree = false;
  try {
    const testCanvas = document.createElement("canvas");
    hasLayoutSubtree = "layoutsubtree" in testCanvas;
  } catch {
    hasLayoutSubtree = false;
  }

  const isFullySupported = hasDrawElementImage && hasLayoutSubtree;

  let summaryText = "";
  if (isFullySupported) {
    summaryText = "WICG 原生引擎: 已就绪 (原生硬件加速)";
  } else if (hasDrawElementImage) {
    summaryText = "WICG 部分支持 (支持 drawElementImage)";
  } else {
    summaryText = "WICG 引擎: 未启用 (需开启 chrome://flags/#canvas-draw-element)";
  }

  return {
    hasDrawElementImage,
    hasLayoutSubtree,
    isFullySupported,
    summaryText,
  };
}
