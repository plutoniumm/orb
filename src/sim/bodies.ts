import type { BodyDef, SimState } from '../types';
import planetsData from '../../data/planets.json';

const SOL = 1.0;
const M_E = 3.003e-6; // Earth in solar masses; planet masses below are Earth-relative
const DAYS_PER_YEAR = 365.2422; // planets.json velocities are per day; the sim runs in years

// Index order is the body id used everywhere (0 = Sun).
export const DEFS: BodyDef[] = [
  {
    name: 'Sun',
    mass: SOL,
    radius: 0.12,
    color: '#ffcf4d',
  },
  {
    name: 'Mercury',
    mass: 0.166 * M_E,
    radius: 0.03,
    color: '#b7b2a8',
  },
  {
    name: 'Venus',
    mass: 0.815 * M_E,
    radius: 0.05,
    color: '#e6c98f',
  },
  {
    name: 'Earth',
    mass: M_E,
    radius: 0.05,
    color: '#4a90e2',
  },
  {
    name: 'Mars',
    mass: 0.107 * M_E,
    radius: 0.045,
    color: '#d1593f',
  },
  {
    name: 'Jupiter',
    mass: 317.8 * M_E,
    radius: 0.1,
    color: '#d9a066',
  },
  {
    name: 'Saturn',
    mass: 95.2 * M_E,
    radius: 0.09,
    color: '#e3c87a',
  },
  {
    name: 'Uranus',
    mass: 14.536 * M_E,
    radius: 0.08,
    color: '#9fd6e3',
  },
  {
    name: 'Neptune',
    mass: 17.147 * M_E,
    radius: 0.08,
    color: '#4f7cdd',
  },
];

type PlanetRow = { pos: [number, number]; vel: [number, number] };

export function createSim (): SimState {
  const n = DEFS.length;
  const pos = new Float64Array(2 * n);
  const vel = new Float64Array(2 * n);
  const table = planetsData.planets as unknown as Record<string, PlanetRow>;

  for (let i = 0; i < n; i++) {
    const d = DEFS[i];
    const row = table[d.name.toLowerCase()];
    if (!row) throw new Error(`Missing '${d.name}' in data/planets.json`);
    pos[2 * i] = row.pos[0];
    pos[2 * i + 1] = row.pos[1];
    vel[2 * i] = row.vel[0] * DAYS_PER_YEAR;
    vel[2 * i + 1] = row.vel[1] * DAYS_PER_YEAR;
  }

  return {
    defs: DEFS,
    n,
    pos,
    vel,
  };
}
