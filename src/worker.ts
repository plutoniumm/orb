/// <reference lib="webworker" />
import { createSim } from './sim/bodies';
import { accelerations, step, TIME_STEP } from './sim/physics';
import { Renderer } from './render/renderer';
import type { Camera, FromWorker, SimState, ToWorker } from './types';

// Physics + rendering share one rAF loop here, drawing straight to the
// transferred OffscreenCanvas — all off the main thread.

let canvas: OffscreenCanvas;
let renderer: Renderer;
let state: SimState;
let cam: Camera;
let aCur: Float64Array;
let aNext: Float64Array;
let speed = 1.0;
let started = false;
let firstFrame = true;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const ZOOM_MIN = 4;
const ZOOM_MAX = 200_000;

self.onmessage = (e: MessageEvent<ToWorker>) => {
  const m = e.data;
  switch (m.type) {
    case 'init': {
      canvas = m.canvas;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('OffscreenCanvas 2D context unavailable');
      state = createSim();
      aCur = new Float64Array(2 * state.n);
      aNext = new Float64Array(2 * state.n);
      accelerations(state, aCur);
      renderer = new Renderer(ctx, state.n);
      cam = { zoom: fitZoom(m.width, m.height), panX: 0, panY: 0, reference: 0 };
      applyResize(m.width, m.height, m.dpr);
      if (!started) {
        started = true;
        requestAnimationFrame(frame);
      }
      break;
    }
    case 'resize':
      applyResize(m.width, m.height, m.dpr);
      break;
    case 'wheel':
      cam.zoom = clamp(cam.zoom * Math.exp(-m.dy * 0.0015), ZOOM_MIN, ZOOM_MAX);
      break;
    case 'drag':
      cam.panX += m.dx;
      cam.panY += m.dy;
      break;
    case 'pick':
      cam.reference = renderer.pick(m.x, m.y, state, cam) ?? 0;
      cam.panX = 0;
      cam.panY = 0;
      break;
    case 'key':
      handleKey(m.code);
      break;
  }
};

function handleKey(code: string): void {
  switch (code) {
    case 'ArrowUp':
      cam.zoom = clamp(cam.zoom * 1.1, ZOOM_MIN, ZOOM_MAX);
      break;
    case 'ArrowDown':
      cam.zoom = clamp(cam.zoom * 0.9, ZOOM_MIN, ZOOM_MAX);
      break;
    case 'ArrowRight':
      speed = clamp(speed === 0 ? 0.25 : speed * 1.25, 0, 200);
      break;
    case 'ArrowLeft':
      speed = clamp(speed * 0.8, 0, 200);
      break;
    case 'Space':
      speed = speed > 0 ? 0 : 1;
      break;
  }
}

function applyResize(w: number, h: number, dpr: number): void {
  canvas.width = Math.max(1, Math.round(w * dpr));
  canvas.height = Math.max(1, Math.round(h * dpr));
  renderer.resize(w, h, dpr);
}

function fitZoom(w: number, h: number): number {
  return Math.min(w, h) / 24; // frames the whole system (Neptune at world-radius ~10)
}

function frame(): void {
  const total = TIME_STEP * speed;
  if (total > 0) {
    // Cap per-substep dt so high speed multipliers stay stable.
    const maxDt = TIME_STEP * 1.5;
    const nsub = Math.max(1, Math.ceil(total / maxDt));
    const dt = total / nsub;
    for (let s = 0; s < nsub; s++) step(state, dt, aCur, aNext);
  }
  renderer.record(state.pos);
  renderer.render(state, cam, speed);

  if (firstFrame) {
    firstFrame = false;
    (self as DedicatedWorkerGlobalScope).postMessage({ type: 'ready' } satisfies FromWorker);
  }
  requestAnimationFrame(frame);
}
