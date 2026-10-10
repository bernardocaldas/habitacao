// A small seeded generator (mulberry32). Its whole state is one integer, so it lives inside
// the saved game and a game replays exactly from its seed.

export interface Rng {
  s: number;
}

export function makeRng(seed: number): Rng {
  return { s: seed >>> 0 };
}

/** Uniform in [0, 1). Advances the generator. */
export function rand(r: Rng): number {
  r.s = (r.s + 0x6d2b79f5) >>> 0;
  let t = r.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Integer in [a, b], both ends included. */
export const randInt = (r: Rng, a: number, b: number) => a + Math.floor(rand(r) * (b - a + 1));

export const chance = (r: Rng, p: number) => rand(r) < p;

export function pick<T>(r: Rng, xs: readonly T[]): T {
  return xs[Math.floor(rand(r) * xs.length)];
}

/** A copy that runs independently, for forecasts that must not disturb the game. */
export const fork = (r: Rng, salt = 0): Rng => ({ s: (r.s ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0 });
