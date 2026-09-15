/* ===========================================================================
   SEEDED RANDOMNESS

   Everything fabricated in this demo is fabricated from one fixed seed, at
   runtime, on the machine running it. Clone the repo and you reproduce these
   exact crew records, these exact gate states, these exact wrap counts. A demo
   whose findings drift depending on when someone opens it is not reproducible,
   and this one has to be.
   =========================================================================== */

/** Mulberry32. Small, fast, and — the only property that matters here — seeded. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rng: () => number, xs: readonly T[]): T {
  // Non-null assertion is safe: every array passed here is a non-empty literal.
  return xs[Math.floor(rng() * xs.length)]!;
}

export function chance(rng: () => number, p: number): boolean {
  return rng() < p;
}

/** Opaque surrogate identifier. Encodes nothing. Not any vendor's format. */
export function surrogateId(rng: () => number, prefix: string): string {
  const hex = '0123456789ABCDEF';
  let s = '';
  for (let i = 0; i < 6; i += 1) s += hex[Math.floor(rng() * 16)];
  return `${prefix}-${s}`;
}

/** Fixed. Clone this repo and you reproduce these exact records. */
export const DEFAULT_SEED = 20270201;
