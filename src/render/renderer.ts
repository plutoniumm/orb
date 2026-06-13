import type { Camera, SimState } from '../types';

const TRAIL_LEN = 2000; // trail samples per body

/**
 * Draws bodies and trails to the OffscreenCanvas. Trails are plotted in the
 * current reference frame as `body(t) - reference(t)`, so the Sun gives clean
 * ellipses and the Earth gives Ptolemaic epicycles.
 */
export class Renderer {
  private ctx: OffscreenCanvasRenderingContext2D;
  private n: number;
  private hist: Float32Array; // ring buffer, TRAIL_LEN * n * 2 world positions
  private head = 0;
  private count = 0;

  private w = 0;
  private h = 0;
  private dpr = 1;

  constructor(ctx: OffscreenCanvasRenderingContext2D, n: number) {
    this.ctx = ctx;
    this.n = n;
    this.hist = new Float32Array(TRAIL_LEN * n * 2);
  }

  resize(w: number, h: number, dpr: number): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
  }

  record(pos: Float64Array): void {
    const base = this.head * this.n * 2;
    for (let k = 0; k < this.n * 2; k++) this.hist[base + k] = pos[k];
    this.head = (this.head + 1) % TRAIL_LEN;
    if (this.count < TRAIL_LEN) this.count++;
  }

  pick(x: number, y: number, state: SimState, cam: Camera): number | null {
    const { w, h, n } = this;
    const cx = w / 2 + cam.panX;
    const cy = h / 2 + cam.panY;
    const refX = state.pos[2 * cam.reference];
    const refY = state.pos[2 * cam.reference + 1];
    // Reverse so the visually top-most body wins overlaps.
    for (let b = n - 1; b >= 0; b--) {
      const sx = cx + (state.pos[2 * b] - refX) * cam.zoom;
      const sy = cy - (state.pos[2 * b + 1] - refY) * cam.zoom;
      const r = this.screenRadius(state, b, cam) + 6;
      const dx = x - sx;
      const dy = y - sy;
      if (dx * dx + dy * dy <= r * r) return b;
    }
    return null;
  }

  render(state: SimState, cam: Camera, speed: number): void {
    const { ctx, w, h, dpr, n } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#05060a';
    ctx.fillRect(0, 0, w, h);

    const R = cam.reference;
    const cx = w / 2 + cam.panX;
    const cy = h / 2 + cam.panY;
    const refX = state.pos[2 * R];
    const refY = state.pos[2 * R + 1];

    this.drawTrails(state, cam, cx, cy);

    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 9, cy);
    ctx.lineTo(cx + 9, cy);
    ctx.moveTo(cx, cy - 9);
    ctx.lineTo(cx, cy + 9);
    ctx.stroke();

    for (let b = 0; b < n; b++) {
      const def = state.defs[b];
      const sx = cx + (state.pos[2 * b] - refX) * cam.zoom;
      const sy = cy - (state.pos[2 * b + 1] - refY) * cam.zoom;
      const r = this.screenRadius(state, b, cam);

      if (b === 0) {
        const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 3.2);
        glow.addColorStop(0, 'rgba(255,247,204,0.9)');
        glow.addColorStop(0.45, 'rgba(255,207,77,0.35)');
        glow.addColorStop(1, 'rgba(255,207,77,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(sx, sy, r * 3.2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();

      if (b === R) {
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(sx, sy, r + 5, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = 'rgba(255,255,255,0.72)';
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillText(def.name, sx + r + 5, sy + 4);
    }

    this.drawHud(state, cam, speed);
  }

  private drawTrails(state: SimState, cam: Camera, cx: number, cy: number): void {
    const { ctx, n, count, head } = this;
    if (count < 2) return;
    const R = cam.reference;
    const start = (head - count + TRAIL_LEN) % TRAIL_LEN;

    ctx.lineWidth = 1;
    for (let b = 0; b < n; b++) {
      if (b === R) continue; // reference sits at the origin
      ctx.beginPath();
      for (let s = 0; s < count; s++) {
        const slot = (start + s) % TRAIL_LEN;
        const o = slot * n * 2;
        const rx = this.hist[o + R * 2];
        const ry = this.hist[o + R * 2 + 1];
        const px = cx + (this.hist[o + b * 2] - rx) * cam.zoom;
        const py = cy - (this.hist[o + b * 2 + 1] - ry) * cam.zoom;
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = withAlpha(state.defs[b].color, 0.5);
      ctx.stroke();
    }
  }

  private screenRadius(state: SimState, b: number, cam: Camera): number {
    const floor = b === 0 ? 9 : 3;
    return Math.max(state.defs[b].radius * cam.zoom, floor);
  }

  private drawHud(state: SimState, cam: Camera, speed: number): void {
    const { ctx } = this;
    ctx.font = '13px system-ui, sans-serif';

    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(`Reference frame: ${state.defs[cam.reference].name}`, 14, 24);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(
      `zoom ${cam.zoom.toFixed(0)}   speed ${speed === 0 ? 'paused' : speed.toFixed(2) + '×'}`,
      14,
      42,
    );

    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    const lines = [
      'Click a body — make it the center',
      'Drag — pan    Wheel / ↑↓ — zoom',
      '← → — speed    Space — pause',
    ];
    lines.forEach((t, i) => ctx.fillText(t, 14, this.h - 14 - (lines.length - 1 - i) * 17));
  }
}

function withAlpha(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}
