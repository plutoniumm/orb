import type { FromWorker, ToWorker } from './types';

// Main thread only bootstraps the worker and forwards input; all physics and
// rendering run in the worker on the transferred OffscreenCanvas, so the UI
// thread never blocks.

const canvas = document.getElementById('view') as HTMLCanvasElement;
const loader = document.getElementById('loader');

const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

const post = (msg: ToWorker, transfer?: Transferable[]) =>
  transfer ? worker.postMessage(msg, transfer) : worker.postMessage(msg);

const cssWidth = () => Math.max(1, canvas.getBoundingClientRect().width);
const cssHeight = () => Math.max(1, canvas.getBoundingClientRect().height);
const dpr = () => Math.min(window.devicePixelRatio || 1, 2);

const offscreen = canvas.transferControlToOffscreen();
post(
  {
    type: 'init',
    canvas: offscreen,
    width: cssWidth(),
    height: cssHeight(),
    dpr: dpr(),
  },
  [offscreen],
);

worker.onmessage = (e: MessageEvent<FromWorker>) => {
  if (e.data.type === 'ready') loader?.classList.add('hide');
};

new ResizeObserver(() =>
  post({
    type: 'resize',
    width: cssWidth(),
    height: cssHeight(),
    dpr: dpr(),
  }),
).observe(canvas);

canvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    post({ type: 'wheel', dy: e.deltaY });
  },
  { passive: false },
);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

let dragging = false;
let button = -1;
let moved = false;
let lastX = 0;
let lastY = 0;
let downX = 0;
let downY = 0;

canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  dragging = true;
  button = e.button;
  moved = false;
  lastX = downX = e.clientX;
  lastY = downY = e.clientY;
});

canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;
  if (Math.abs(e.clientX - downX) > 3 || Math.abs(e.clientY - downY) > 3) moved = true;

  // Right-drag always pans; left-drag pans only once it's clearly a drag, not a click.
  if (button === 2 || (button === 0 && moved))
    post({
      type: 'drag',
      dx,
      dy,
    });
});

canvas.addEventListener('pointerup', (e) => {
  if (
    dragging &&
    button === 0 &&
    !moved
  ) {
    const r = canvas.getBoundingClientRect();
    post({
      type: 'pick',
      x: e.clientX - r.left,
      y: e.clientY - r.top,
    });
  }

  dragging = false;
  button = -1;
});

window.addEventListener('keydown', (e) => {
  switch (e.code) {
    case 'ArrowUp':
    case 'ArrowDown':
    case 'ArrowLeft':
    case 'ArrowRight':
    case 'Space':
      e.preventDefault();
      post({ type: 'key', code: e.code });
  }
});
