import type { Camera, SimState } from '../types';

const TRAIL_LEN = 2000;
const FADE_SAMPLES = 1200; // trail fades to nothing across the most recent samples
const TRAIL_BASE_ALPHA = 0.55;
const TRAIL_BAND = 6; // samples per alpha step (perf vs. fade smoothness)

const CONTROL_LINES = [
  'Click a body — make it the center',
  'Drag — pan    Wheel / ↑↓ — zoom',
  '← → — speed    Space — pause',
];

/** Reference frame being displayed; during a switch it blends two bodies. */
export type RefView = { fromRef: number; toRef: number; blend: number };

/**
 * Trails are plotted in the current reference frame as `body(t) - reference(t)`
 * (Sun → ellipses, Earth → epicycles). During a switch the reference is the
 * blend `lerp(fromRef, toRef, blend)`, so the scene morphs with no snap.
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

  // Blended reference position written by computeRef (avoids per-sample allocation).
  private refX = 0;
  private refY = 0;

  constructor(ctx: OffscreenCanvasRenderingContext2D, n: number) {
    this.ctx = ctx;
    this.n = n;
    this.hist = new Float32Array(TRAIL_LEN * n * 2);
  }

  resize (w: number, h: number, dpr: number): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
  }

  record (pos: Float64Array): void {
    const base = this.head * this.n * 2;
    const len = this.n * 2;
    for (let k = 0; k < len; k++) this.hist[base + k] = pos[k];
    this.head = (this.head + 1) % TRAIL_LEN;
    if (this.count < TRAIL_LEN) this.count++;
  }

  pick (x: number, y: number, state: SimState, cam: Camera, view: RefView): number | null {
    const { w, h, n } = this;
    const cx = w / 2 + cam.panX;
    const cy = h / 2 + cam.panY;
    this.computeRef(state.pos, view, 0);
    const refX = this.refX;
    const refY = this.refY;
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

  render (state: SimState, cam: Camera, speed: number, view: RefView): void {
    const { ctx, w, h, dpr, n } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#05060a';
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2 + cam.panX;
    const cy = h / 2 + cam.panY;
    this.computeRef(state.pos, view, 0);
    const refX = this.refX;
    const refY = this.refY;

    this.drawTrails(state, cam, view, cx, cy);

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

      if (b === view.toRef) {
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

  /** Writes the blended reference position at state offset `o` into refX/refY. */
  private computeRef (buf: Float64Array | Float32Array, view: RefView, o: number): void {
    const { fromRef, toRef, blend } = view;
    const fx = buf[o + fromRef * 2];
    const fy = buf[o + fromRef * 2 + 1];
    this.refX = fx + (buf[o + toRef * 2] - fx) * blend;
    this.refY = fy + (buf[o + toRef * 2 + 1] - fy) * blend;
  }

  private drawTrails (state: SimState, cam: Camera, view: RefView, cx: number, cy: number): void {
    const { ctx, n, count, head, hist } = this;
    if (count < 2) return;
    const settled = view.blend >= 1;
    const window = Math.min(count, FADE_SAMPLES);
    const oldest = (head - window + TRAIL_LEN) % TRAIL_LEN;
    const zoom = cam.zoom;

    ctx.lineWidth = 1;

    for (let b = 0; b < n; b++) {
      if (settled && b === view.toRef) continue; // sits at the origin
      ctx.strokeStyle = state.defs[b].color;

      for (let s = 0; s < window - 1; s += TRAIL_BAND) {
        const end = Math.min(window - 1, s + TRAIL_BAND);
        ctx.globalAlpha = (end / (window - 1)) * TRAIL_BASE_ALPHA;
        ctx.beginPath();

        for (let k = s; k <= end; k++) {
          const o = ((oldest + k) % TRAIL_LEN) * n * 2;
          this.computeRef(hist, view, o);
          const x = cx + (hist[o + b * 2] - this.refX) * zoom;
          const y = cy - (hist[o + b * 2 + 1] - this.refY) * zoom;

          if (k === s) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.stroke();
      }
    }

    ctx.globalAlpha = 1;
  }

  private screenRadius (state: SimState, b: number, cam: Camera): number {
    const floor = b === 0 ? 9 : 3;

    return Math.max(state.defs[b].radius * cam.zoom, floor);
  }

  private drawHud (state: SimState, cam: Camera, speed: number): void {
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

    for (let i = 0; i < CONTROL_LINES.length; i++) {
      ctx.fillText(CONTROL_LINES[i], 14, this.h - 14 - (CONTROL_LINES.length - 1 - i) * 17);
    }
  }
}
