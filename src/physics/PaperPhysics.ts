/**
 * PaperPhysics Engine
 * Simulates real-time 3D spring tilt inertia, paper flutter, and dynamic shadow.
 */

export interface PhysicsState {
  currentRotX: number;
  currentRotY: number;
  targetRotX: number;
  targetRotY: number;
  currentZ: number;
  targetZ: number;
  flutterAmount: number;
  isTiltLocked: boolean;
  isSpaceHeld: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  isClickShakeEnabled: boolean;
  pointerActive: boolean;
}

export class PaperPhysics {
  state: PhysicsState = {
    currentRotX: 0,
    currentRotY: 0,
    targetRotX: 0,
    targetRotY: 0,
    currentZ: 0,
    targetZ: 0,
    flutterAmount: 0,
    isTiltLocked: false,
    isSpaceHeld: false,
    isMinimized: false,
    isMaximized: false,
    isClickShakeEnabled: false,
    pointerActive: false,
  };

  private assemblyEl: HTMLElement;
  private shadowEl: HTMLElement;
  private sheenEl: HTMLElement;

  constructor(assemblyEl: HTMLElement, shadowEl: HTMLElement, sheenEl: HTMLElement) {
    this.assemblyEl = assemblyEl;
    this.shadowEl = shadowEl;
    this.sheenEl = sheenEl;
  }

  update(): { rotX: number; rotY: number; isSettled: boolean } {
    if (this.state.isMinimized) {
      return { rotX: 0, rotY: 0, isSettled: true };
    }

    const s = this.state;
    const prevRotX = s.currentRotX;
    const prevRotY = s.currentRotY;
    const prevZ = s.currentZ;

    s.currentRotX += (s.targetRotX - s.currentRotX) * 0.12;
    s.currentRotY += (s.targetRotY - s.currentRotY) * 0.12;
    s.currentZ += (s.targetZ - s.currentZ) * 0.12;

    s.flutterAmount *= 0.88;
    const totalRotX = s.currentRotX + Math.sin(Date.now() * 0.02) * s.flutterAmount;
    const totalRotY = s.currentRotY + Math.cos(Date.now() * 0.02) * s.flutterAmount;

    // Apply 3D Transform to Assembly
    this.assemblyEl.style.transform = `
      rotateX(${totalRotX.toFixed(2)}deg)
      rotateY(${totalRotY.toFixed(2)}deg)
      translateZ(${s.currentZ.toFixed(1)}px)
    `;

    // Dynamic Shadow Offset opposite to light direction
    const shadowX = -totalRotY * 1.8;
    const shadowY = totalRotX * 1.5 + 28;
    const shadowBlur = 35 + Math.abs(totalRotX) * 0.8 + Math.abs(totalRotY) * 0.8;
    const shadowOpacity = Math.max(0.35, 0.62 - s.currentZ * 0.003);

    this.shadowEl.style.transform = `translate3d(${shadowX.toFixed(1)}px, ${shadowY.toFixed(1)}px, -70px)`;
    this.shadowEl.style.filter = `blur(${shadowBlur.toFixed(1)}px)`;
    this.shadowEl.style.backgroundColor = `rgba(0, 0, 0, ${shadowOpacity.toFixed(2)})`;

    // Dynamic Specular Highlight on Paper Surface
    const sheenAngle = Math.atan2(totalRotY, -totalRotX) * (180 / Math.PI) + 90;
    const sheenAlpha = Math.min(0.28, (Math.abs(totalRotX) + Math.abs(totalRotY)) * 0.008 + 0.04);
    this.sheenEl.style.background = `linear-gradient(${sheenAngle.toFixed(1)}deg, rgba(255, 255, 255, ${sheenAlpha.toFixed(2)}) 0%, transparent 60%)`;

    const isSettled =
      Math.abs(s.currentRotX - prevRotX) < 0.01 &&
      Math.abs(s.currentRotY - prevRotY) < 0.01 &&
      Math.abs(s.currentZ - prevZ) < 0.05 &&
      s.flutterAmount < 0.05;

    return { rotX: totalRotX, rotY: totalRotY, isSettled };
  }

  setPointer(mouseX: number, mouseY: number, stageWidth: number, stageHeight: number): void {
    this.state.pointerActive = true;
    if (this.state.isTiltLocked || this.state.isSpaceHeld || this.state.isMinimized) {
      return;
    }
    const normX = (mouseX - stageWidth / 2) / (stageWidth / 2);
    const normY = (mouseY - stageHeight / 2) / (stageHeight / 2);

    this.state.targetRotY = Math.max(-26, Math.min(26, normX * 26));
    this.state.targetRotX = Math.max(-22, Math.min(22, -normY * 22));
    this.state.targetZ = 20;
  }

  resetAngle(): void {
    this.state.pointerActive = false;
    this.state.targetRotX = 0;
    this.state.targetRotY = 0;
    this.state.targetZ = 0;
  }
  triggerClickFlutter(x: number, y: number, width: number, height: number): void {
    if (!this.state.isClickShakeEnabled || this.state.isMinimized) return;

    this.state.flutterAmount = Math.min(this.state.flutterAmount + 1.4, 3.2);

    if (!this.state.isTiltLocked) {
      const normDx = (x - width / 2) / (width / 2);
      const normDy = (y - height / 2) / (height / 2);
      this.state.targetRotY += normDx * 0.7;
      this.state.targetRotX -= normDy * 0.5;
    }
  }
}
