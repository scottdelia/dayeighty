import type { IntExt, Scene, SceneNeed, ShootDay, TimeOfDay } from './types';
import { castAvailableOn } from './cast';
import { locationById } from './locations';
import { PRODUCTION, dawnCallFor } from './production';
import { DEFAULT_SEED, chance, mulberry32, pick } from './rng';

/* ===========================================================================
   THE SCRIPT AND THE STRIPBOARD

   A season of television is a few hundred scenes, each with a page count, a
   cast list, a location, a time of day and a list of things that have to be
   booked, built or rigged before it can shoot. The stripboard orders those
   scenes into shoot days, and the order is the schedule.

   The fifteen days around the lost day are written by hand, because the
   demo's argument lives in their details. The rest of the season is generated
   from the same seed as everything else, inside the same contract windows and
   permit windows, so that a cover-set search over the whole schedule has real
   candidates to reject.

   Every scene here is invented. None is from any script.
   =========================================================================== */

/* ---------------------------------------------------------------------------
   Blocks: which location the unit is at on which days. Shooting order, not
   story order, which is why episode numbers jump around.
   --------------------------------------------------------------------------- */
interface Block {
  from: number;
  to: number;
  locationId: string;
  episode: number;
  /** Cast who appear in this block's scenes. Filtered per day by contract. */
  pool: number[];
  extras: number;
  needs: SceneNeed[];
  /** First scene number to hand out. Leaves gaps for the hand-written scenes. */
  firstScene: number;
}

const BLOCKS: readonly Block[] = [
  { from: 1, to: 6, locationId: 'STAGE_A', episode: 1, pool: [1, 2, 6, 7, 11, 16, 17], extras: 20, needs: [], firstScene: 1 },
  { from: 7, to: 12, locationId: 'HILLFORT', episode: 1, pool: [1, 3, 7, 11, 13], extras: 40, needs: ['horses', 'armory'], firstScene: 26 },
  { from: 13, to: 18, locationId: 'STAGE_B1', episode: 2, pool: [1, 2, 5, 16, 17], extras: 0, needs: [], firstScene: 110 },
  { from: 19, to: 24, locationId: 'FOREST_ROAD', episode: 3, pool: [1, 3, 8, 13, 21], extras: 15, needs: ['horses'], firstScene: 135 },
  { from: 25, to: 30, locationId: 'STAGE_A', episode: 3, pool: [1, 2, 4, 6, 7, 10, 18], extras: 20, needs: [], firstScene: 160 },
  { from: 31, to: 36, locationId: 'COAST', episode: 4, pool: [1, 3, 11, 12, 13, 22], extras: 25, needs: ['sfx_rain'], firstScene: 185 },
  { from: 37, to: 42, locationId: 'STAGE_C', episode: 5, pool: [1, 22, 10, 13, 23], extras: 0, needs: [], firstScene: 210 },
  { from: 43, to: 45, locationId: 'RIDGE', episode: 5, pool: [1, 3, 7, 20, 23], extras: 80, needs: ['horses', 'armory', 'horse_falls'], firstScene: 235 },
  { from: 61, to: 66, locationId: 'VILLAGE', episode: 6, pool: [1, 2, 3, 8, 9, 10], extras: 35, needs: [], firstScene: 260 },
  { from: 67, to: 70, locationId: 'STAGE_C', episode: 7, pool: [1, 2, 10, 22], extras: 0, needs: [], firstScene: 285 },
  { from: 71, to: 75, locationId: 'CAVE', episode: 7, pool: [1, 3, 7, 10], extras: 0, needs: ['sfx_fire'], firstScene: 310 },
  { from: 76, to: 79, locationId: 'STAGE_A', episode: 8, pool: [1, 2, 3, 4, 7, 10], extras: 30, needs: [], firstScene: 335 },
];

/* ---------------------------------------------------------------------------
   Hand-written: days 46 to 60. The ford block, the scriptorium, the feast,
   and the hut. See breakdown.ts for the pages the reader reads these from.
   --------------------------------------------------------------------------- */
const s = (
  number: string,
  episode: number,
  intExt: IntExt,
  set: string,
  time: TimeOfDay,
  eighths: number,
  cast: number[],
  locationId: string,
  extra: Partial<Pick<Scene, 'extras' | 'needs' | 'prepDays' | 'weatherDependent' | 'secondUnit'>> = {},
): Scene => ({
  number,
  episode,
  intExt,
  set,
  time,
  eighths,
  cast,
  locationId,
  extras: extra.extras ?? 0,
  needs: extra.needs ?? [],
  prepDays: extra.prepDays ?? 0,
  weatherDependent: extra.weatherDependent ?? intExt === 'EXT',
  secondUnit: extra.secondUnit ?? false,
});

const HAND_SCENES: readonly Scene[] = [
  // Day 46 · the ford · shot today
  s('57', 5, 'EXT', 'RIVER FORD', 'DAY', 14, [1, 3, 7, 20], 'FORD', { extras: 30, needs: ['horses'], secondUnit: true }),
  s('58', 5, 'EXT', 'RIVER FORD', 'DAY', 10, [1, 3], 'FORD'),
  s('59', 5, 'EXT', 'RIVER FORD', 'DUSK', 8, [3, 20], 'FORD'),
  // Day 47 · the ford · the lost day
  s('61', 5, 'EXT', 'RIVER FORD', 'DAWN', 12, [1, 3, 7], 'FORD', { extras: 30, needs: ['horses', 'water_safety'], secondUnit: true }),
  s('62', 5, 'EXT', 'RIVER FORD', 'DAY', 18, [1, 2, 3, 7, 12], 'FORD', { extras: 30, needs: ['horses', 'horse_falls', 'water_safety'] }),
  s('63', 5, 'EXT', 'RIVER FORD, FAR BANK', 'DAY', 9, [3, 14, 15], 'FORD', { needs: ['water_safety'], secondUnit: true }),
  s('64', 5, 'EXT', 'RIVER FORD', 'DUSK', 6, [1, 9], 'FORD'),
  // Day 48 · the ford
  s('65', 5, 'EXT', 'RIVER FORD', 'DAY', 16, [1, 2, 3, 7], 'FORD', { extras: 30, needs: ['horses'] }),
  s('66', 5, 'EXT', 'RIVER FORD, FAR BANK', 'DAY', 14, [7, 20], 'FORD', { extras: 30, needs: ['horses'], secondUnit: true }),
  // Day 49 · the ford
  s('67', 5, 'EXT', 'RIVER FORD', 'DAY', 16, [1, 2], 'FORD'),
  s('68', 5, 'EXT', 'RIVER FORD', 'DAY', 16, [2, 13], 'FORD'),
  // Day 50 · the ford
  s('69', 5, 'EXT', 'RIVER FORD', 'DAWN', 8, [1], 'FORD'),
  s('70', 5, 'EXT', 'RIVER FORD', 'DAY', 14, [1, 3, 12], 'FORD', { extras: 30, needs: ['horses'] }),
  s('71', 5, 'EXT', 'RIVER FORD', 'DAY', 12, [3, 14, 15], 'FORD', { needs: ['water_safety'], secondUnit: true }),
  // Days 51–54 · the scriptorium
  s('84', 6, 'INT', 'ABBEY SCRIPTORIUM', 'DAY', 20, [5, 19], 'STAGE_B2', { weatherDependent: false }),
  s('85', 6, 'INT', 'ABBEY SCRIPTORIUM', 'DAY', 16, [1, 5], 'STAGE_B2', { weatherDependent: false }),
  s('88', 6, 'INT', 'ABBEY SCRIPTORIUM', 'NIGHT', 26, [5, 2], 'STAGE_B2', { weatherDependent: false }),
  s('89', 6, 'INT', 'ABBEY SCRIPTORIUM', 'NIGHT', 14, [1, 5, 2], 'STAGE_B2', { weatherDependent: false }),
  s('86', 6, 'INT', 'ABBEY SCRIPTORIUM', 'DAY', 18, [1, 19], 'STAGE_B2', { weatherDependent: false }),
  s('87', 6, 'INT', 'ABBEY SCRIPTORIUM', 'DAY', 12, [5], 'STAGE_B2', { weatherDependent: false }),
  s('90', 6, 'INT', 'ABBEY SCRIPTORIUM', 'NIGHT', 8, [1], 'STAGE_B2', { weatherDependent: false }),
  s('91', 6, 'INT', 'ABBEY SCRIPTORIUM', 'DAY', 24, [1, 2, 5], 'STAGE_B2', { weatherDependent: false }),
  s('92', 6, 'INT', 'ABBEY SCRIPTORIUM', 'DAY', 12, [2], 'STAGE_B2', { weatherDependent: false }),
  // Days 55–57 · the feast
  s('95', 6, 'INT', 'GREAT HALL', 'NIGHT', 20, [1, 2, 3, 6, 7, 10], 'STAGE_A', { extras: 60, needs: ['sfx_fire', 'feast_dressing'], prepDays: 2, weatherDependent: false }),
  s('96', 6, 'INT', 'GREAT HALL', 'NIGHT', 18, [1, 7, 10], 'STAGE_A', { extras: 60, needs: ['sfx_fire', 'feast_dressing'], prepDays: 2, weatherDependent: false }),
  s('97', 6, 'INT', 'GREAT HALL', 'NIGHT', 22, [6, 7, 10, 24], 'STAGE_A', { extras: 60, needs: ['sfx_fire', 'feast_dressing'], prepDays: 2, weatherDependent: false }),
  s('98', 6, 'INT', 'GREAT HALL', 'NIGHT', 14, [1, 6], 'STAGE_A', { extras: 60, needs: ['sfx_fire', 'feast_dressing'], prepDays: 2, weatherDependent: false }),
  s('99', 6, 'INT', 'GREAT HALL', 'DAY', 20, [7, 10, 24], 'STAGE_A', { weatherDependent: false }),
  s('100', 6, 'INT', 'GREAT HALL', 'DAY', 16, [1, 7], 'STAGE_A', { weatherDependent: false }),
  // Days 58–60 · the hut
  s('101', 6, 'INT', 'FOREST HOUSE', 'DAY', 14, [1, 2], 'STAGE_D', { weatherDependent: false }),
  s('102', 6, 'INT', 'FOREST HOUSE', 'DAY', 10, [2, 9], 'STAGE_D', { needs: ['sfx_fire'], weatherDependent: false }),
  s('103', 6, 'INT', 'FOREST HOUSE', 'NIGHT', 12, [1, 2], 'STAGE_D', { needs: ['sfx_rain'], weatherDependent: false }),
  s('104', 6, 'INT', 'FOREST HOUSE', 'DAY', 16, [2, 9], 'STAGE_D', { weatherDependent: false }),
  s('105', 6, 'INT', 'FOREST HOUSE', 'NIGHT', 14, [1, 2, 9], 'STAGE_D', { weatherDependent: false }),
  s('106', 6, 'INT', 'FOREST HOUSE', 'DAY', 18, [1, 2], 'STAGE_D', { weatherDependent: false }),
  s('107', 6, 'INT', 'FOREST HOUSE', 'NIGHT', 10, [2], 'STAGE_D', { weatherDependent: false }),
  s('108', 6, 'INT', 'FOREST HOUSE', 'NIGHT', 8, [1, 2, 3], 'STAGE_D', { weatherDependent: false }),
];

const HAND_DAYS: readonly { day: number; locationId: string; scenes: string[] }[] = [
  { day: 46, locationId: 'FORD', scenes: ['57', '58', '59'] },
  { day: 47, locationId: 'FORD', scenes: ['61', '62', '63', '64'] },
  { day: 48, locationId: 'FORD', scenes: ['65', '66'] },
  { day: 49, locationId: 'FORD', scenes: ['67', '68'] },
  { day: 50, locationId: 'FORD', scenes: ['69', '70', '71'] },
  { day: 51, locationId: 'STAGE_B2', scenes: ['84', '85'] },
  { day: 52, locationId: 'STAGE_B2', scenes: ['88', '89'] },
  { day: 53, locationId: 'STAGE_B2', scenes: ['86', '87', '90'] },
  { day: 54, locationId: 'STAGE_B2', scenes: ['91', '92'] },
  { day: 55, locationId: 'STAGE_A', scenes: ['95', '96'] },
  { day: 56, locationId: 'STAGE_A', scenes: ['97', '98'] },
  { day: 57, locationId: 'STAGE_A', scenes: ['99', '100'] },
  { day: 58, locationId: 'STAGE_D', scenes: ['101', '102', '103'] },
  { day: 59, locationId: 'STAGE_D', scenes: ['104', '105'] },
  { day: 60, locationId: 'STAGE_D', scenes: ['106', '107', '108'] },
];

/* ---------------------------------------------------------------------------
   Generation for the rest of the season.
   --------------------------------------------------------------------------- */
const SET_NAMES: Record<string, string[]> = {
  STAGE_A: ['GREAT HALL', 'GREAT HALL, GALLERY', 'GREAT HALL, ANTECHAMBER'],
  HILLFORT: ['HILLFORT, RAMPARTS', 'HILLFORT, GATE', 'HILLFORT, YARD'],
  STAGE_B1: ["TUDWAL'S HALL", "TUDWAL'S HALL, LOFT"],
  FOREST_ROAD: ['FOREST ROAD', 'FOREST ROAD, CLEARING', 'FOREST ROAD, STREAM'],
  COAST: ['COAST', 'SHINGLE BEACH', 'CLIFF PATH'],
  STAGE_C: ['THE ISLAND PALACE', 'THE ISLAND PALACE, INNER CHAMBER'],
  RIDGE: ['BATTLEFIELD RIDGE', 'RIDGE, LOWER SLOPE'],
  VILLAGE: ['VILLAGE', 'VILLAGE, SMITHY', 'VILLAGE, WELL'],
  CAVE: ['SEA CAVE', 'SEA CAVE, PASSAGE'],
};

function unitCallFor(locationId: string, hasDawn: boolean, day: number): string {
  if (hasDawn) return dawnCallFor(day);
  return locationById(locationId).kind === 'stage' ? '07:00' : '06:30';
}

function generate(): { scenes: Scene[]; days: ShootDay[] } {
  const rng = mulberry32(DEFAULT_SEED + 7);
  const scenes: Scene[] = [...HAND_SCENES];
  const days: ShootDay[] = [];
  const handByDay = new Map(HAND_DAYS.map((d) => [d.day, d]));

  for (const b of BLOCKS) {
    let next = b.firstScene;
    const loc = locationById(b.locationId);
    for (let day = b.from; day <= b.to; day += 1) {
      const target = 32 + Math.floor(rng() * 9); // 32..40 eighths
      let used = 0;
      const dayScenes: string[] = [];
      let hasDawn = false;
      while (used < target - 6) {
        const eighths = Math.max(8, Math.min(8 + Math.floor(rng() * 13), target - used));
        const available = b.pool.filter((n) => castAvailableOn(n, day).ok);
        const cast = pickCast(rng, available);
        let time: TimeOfDay = 'DAY';
        if (loc.exterior && !hasDawn && dayScenes.length === 0 && chance(rng, 0.15)) {
          time = 'DAWN';
          hasDawn = true;
        } else if (loc.exterior && chance(rng, 0.1)) {
          time = 'DUSK';
        } else if (!loc.exterior && chance(rng, 0.4)) {
          time = 'NIGHT';
        }
        const needs: SceneNeed[] = b.needs.filter(() => chance(rng, 0.6));
        scenes.push({
          number: String(next),
          episode: b.episode,
          intExt: loc.exterior ? 'EXT' : 'INT',
          set: pick(rng, SET_NAMES[b.locationId] ?? [loc.name.toUpperCase()]),
          time,
          eighths,
          cast,
          locationId: b.locationId,
          extras: chance(rng, 0.5) ? b.extras : 0,
          needs,
          prepDays: 0,
          weatherDependent: loc.exterior,
          secondUnit: needs.includes('horse_falls') && chance(rng, 0.5),
        });
        dayScenes.push(String(next));
        next += 1;
        used += eighths;
      }
      days.push({
        day,
        locationId: b.locationId,
        scenes: dayScenes,
        unitCall: unitCallFor(b.locationId, hasDawn, day),
        plannedWrap: hasDawn ? '15:00' : loc.kind === 'stage' ? '17:00' : '16:30',
      });
    }
  }

  for (const h of HAND_DAYS) {
    const hasDawn = h.scenes.some((n) => scenes.find((sc) => sc.number === n)?.time === 'DAWN');
    days.push({
      day: h.day,
      locationId: h.locationId,
      scenes: h.scenes,
      unitCall: unitCallFor(h.locationId, hasDawn, h.day),
      plannedWrap: hasDawn ? '15:00' : locationById(h.locationId).kind === 'stage' ? '17:00' : '16:30',
    });
  }
  void handByDay;

  days.sort((a, b) => a.day - b.day);
  if (days.length !== PRODUCTION.shootDays) {
    throw new Error(`script.ts: expected ${PRODUCTION.shootDays} shoot days, built ${days.length}`);
  }
  // A duplicate scene number would let a generated scene silently replace a
  // hand-written one, and the demo would argue from the wrong page.
  const seen = new Set<string>();
  for (const sc of scenes) {
    if (seen.has(sc.number)) throw new Error(`script.ts: duplicate scene number ${sc.number}`);
    seen.add(sc.number);
  }
  return { scenes, days };
}

function pickCast(rng: () => number, available: number[]): number[] {
  const out = new Set<number>();
  if (available.includes(1) && chance(rng, 0.7)) out.add(1);
  const n = 1 + Math.floor(rng() * 3);
  for (let i = 0; i < n && available.length > 0; i += 1) out.add(pick(rng, available));
  return [...out].sort((a, b) => a - b);
}

const BUILT = generate();

export const SCENES: readonly Scene[] = BUILT.scenes;
export const SHOOT_DAYS: readonly ShootDay[] = BUILT.days;

const SCENE_BY_NUMBER = new Map(SCENES.map((sc) => [sc.number, sc]));
const DAY_BY_NUMBER = new Map(SHOOT_DAYS.map((d) => [d.day, d]));

export function sceneByNumber(n: string): Scene {
  const sc = SCENE_BY_NUMBER.get(n);
  if (!sc) throw new Error(`script.ts: no scene ${n}`);
  return sc;
}

export function shootDay(day: number): ShootDay {
  const d = DAY_BY_NUMBER.get(day);
  if (!d) throw new Error(`script.ts: no shoot day ${day}`);
  return d;
}

export function dayEighths(day: ShootDay): number {
  return day.scenes.reduce((n, id) => n + sceneByNumber(id).eighths, 0);
}

export function slugOf(sc: Scene): string {
  return `${sc.intExt}. ${sc.set} — ${sc.time}`;
}

/** Every cast number appearing in a set of scenes, sorted. */
export function castIn(sceneNumbers: readonly string[]): number[] {
  const out = new Set<number>();
  for (const n of sceneNumbers) for (const c of sceneByNumber(n).cast) out.add(c);
  return [...out].sort((a, b) => a - b);
}
