import type { SimState } from '../types';

// G = 1, masses in solar masses, positions/velocities pre-scaled (planets.json) — not SI.
export const G = 1.0;
export const TIME_STEP = 0.005;

const SOFTENING2 = 1e-8; // avoids singular force on coincident bodies

export function accelerations(state: SimState, out: Float64Array): void {
  const { pos, defs, n } = state;
  out.fill(0);
  for (let i = 0; i < n; i++) {
    const xi = pos[2 * i];
    const yi = pos[2 * i + 1];
    let ax = 0;
    let ay = 0;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const dx = pos[2 * j] - xi;
      const dy = pos[2 * j + 1] - yi;
      const d2 = dx * dx + dy * dy;
      if (d2 <= SOFTENING2) continue;
      const inv = 1 / Math.sqrt(d2);
      const f = (G * defs[j].mass) / d2;
      ax += dx * inv * f;
      ay += dy * inv * f;
    }
    out[2 * i] = ax;
    out[2 * i + 1] = ay;
  }
}

// Velocity-Verlet. `aCur` must hold the acceleration at the current positions on
// entry; it is updated in place to the acceleration at the new positions, so the
// caller reuses it next step (one force eval per step).
export function step(
  state: SimState,
  dt: number,
  aCur: Float64Array,
  aNext: Float64Array,
): void {
  const { pos, vel, n } = state;
  const m = 2 * n;
  const halfDt2 = 0.5 * dt * dt;
  for (let k = 0; k < m; k++) pos[k] += vel[k] * dt + aCur[k] * halfDt2;
  accelerations(state, aNext);
  const halfDt = 0.5 * dt;
  for (let k = 0; k < m; k++) vel[k] += (aCur[k] + aNext[k]) * halfDt;
  aCur.set(aNext);
}
