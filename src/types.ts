export interface BodyDef {
  name: string;
  /** Solar masses (Sun = 1). */
  mass: number;
  /** World units. */
  radius: number;
  color: string;
}

export interface SimState {
  defs: BodyDef[];
  n: number;
  /** Interleaved [x0, y0, x1, y1, ...], length 2n. */
  pos: Float64Array;
  vel: Float64Array;
}

export interface Camera {
  /** CSS px per world unit. */
  zoom: number;
  panX: number;
  panY: number;
  /** Index of the body pinned at the origin (0,0). */
  reference: number;
}

export type ToWorker =
  | { type: 'init'; canvas: OffscreenCanvas; width: number; height: number; dpr: number }
  | { type: 'resize'; width: number; height: number; dpr: number }
  | { type: 'wheel'; dy: number }
  | { type: 'pick'; x: number; y: number }
  | { type: 'drag'; dx: number; dy: number }
  | { type: 'key'; code: string };

export type FromWorker = { type: 'ready' };
