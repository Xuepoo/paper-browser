/**
 * InkRippleRenderer
 * Renders dynamic fluid ink ripples, capillary waves, and watercolor blooming on Canvas.
 */

export interface RippleParticle {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  speed: number;
  color: string;
  type: "wave" | "echo" | "bloom";
}

export class InkRippleRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private ripples: RippleParticle[] = [];
  isEnabled = true;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Failed to acquire Canvas 2D context");
    }
    this.ctx = context;
  }

  get activeCount(): number {
    return this.ripples.length;
  }

  addRipple(x: number, y: number, color = "#38bdf8"): void {
    if (!this.isEnabled) return;

    // Layer 1: Fast capillary outer shockwave
    this.ripples.push({
      x,
      y,
      radius: 3,
      maxRadius: 220,
      alpha: 0.65,
      speed: 5.4,
      color,
      type: "wave",
    });

    // Layer 2: Harmonic secondary echo ring
    this.ripples.push({
      x,
      y,
      radius: 0,
      maxRadius: 140,
      alpha: 0.45,
      speed: 3.2,
      color: "#6366f1",
      type: "echo",
    });

    // Layer 3: Organic soft ink diffusion bloom (fading watercolor core)
    this.ripples.push({
      x,
      y,
      radius: 2,
      maxRadius: 80,
      alpha: 0.35,
      speed: 1.6,
      color,
      type: "bloom",
    });
  }

  syncDpr(cssWidth: number, cssHeight: number, cappedDpr: number): void {
    this.canvas.width = Math.round(cssWidth * cappedDpr);
    this.canvas.height = Math.round(cssHeight * cappedDpr);
    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;

    this.ctx.resetTransform();
    this.ctx.scale(cappedDpr, cappedDpr);
  }

  render(cssWidth: number, cssHeight: number): void {
    this.ctx.clearRect(0, 0, cssWidth, cssHeight);

    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      this.ctx.save();

      if (r.type === "bloom") {
        const grad = this.ctx.createRadialGradient(r.x, r.y, 0, r.x, r.y, Math.max(8, r.radius));
        grad.addColorStop(0, `rgba(56, 189, 248, ${(r.alpha * 0.4).toFixed(3)})`);
        grad.addColorStop(0.6, `rgba(99, 102, 241, ${(r.alpha * 0.18).toFixed(3)})`);
        grad.addColorStop(1, "transparent");
        this.ctx.fillStyle = grad;
        this.ctx.beginPath();
        this.ctx.arc(r.x, r.y, Math.max(8, r.radius), 0, Math.PI * 2);
        this.ctx.fill();
      } else if (r.type === "echo") {
        if (r.radius > 10) {
          this.ctx.beginPath();
          this.ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
          this.ctx.strokeStyle = `rgba(99, 102, 241, ${(r.alpha * 0.7).toFixed(3)})`;
          this.ctx.lineWidth = 1.6;
          this.ctx.stroke();
        }
      } else {
        this.ctx.beginPath();
        this.ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        this.ctx.strokeStyle = `rgba(56, 189, 248, ${r.alpha.toFixed(3)})`;
        this.ctx.lineWidth = 2.4;
        this.ctx.stroke();
      }

      this.ctx.restore();

      r.radius += r.speed;
      r.alpha *= 0.93;

      if (r.alpha < 0.01 || r.radius > r.maxRadius) {
        this.ripples.splice(i, 1);
      }
    }
  }
}
