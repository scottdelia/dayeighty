import type { Location } from './types';

/* ===========================================================================
   LOCATIONS AND STAGES

   A practical location has a permit window, a fee, a deposit and a drive time.
   A stage set has a day the build is ready. Both are the kind of constraint
   that is written down once, in a contract, and then lives in the head of the
   location manager, which is fine until the location manager is asleep and the
   call sheet is due.

   Every location here is invented.
   =========================================================================== */

export const LOCATIONS: readonly Location[] = [
  {
    id: 'STAGE_A',
    name: 'Stage A · The great hall',
    kind: 'stage',
    exterior: false,
    permitFrom: null,
    permitTo: null,
    sundaysAllowed: true,
    assumed_sunday_uplift: 1.0,
    readyOnDay: -3,
    travelMinutes: 0,
    assumed_day_fee_cents: null,
    depositCents: null,
  },
  {
    id: 'STAGE_B1',
    name: "Stage B · Tudwal's hall",
    kind: 'stage',
    exterior: false,
    permitFrom: null,
    permitTo: null,
    sundaysAllowed: true,
    assumed_sunday_uplift: 1.0,
    readyOnDay: 10,
    travelMinutes: 0,
    assumed_day_fee_cents: null,
    depositCents: null,
  },
  {
    id: 'STAGE_B2',
    name: 'Stage B · Abbey scriptorium',
    kind: 'stage',
    exterior: false,
    permitFrom: null,
    permitTo: null,
    sundaysAllowed: true,
    assumed_sunday_uplift: 1.0,
    readyOnDay: 44,
    travelMinutes: 0,
    assumed_day_fee_cents: null,
    depositCents: null,
  },
  {
    id: 'STAGE_C',
    name: 'Stage C · The island palace',
    kind: 'stage',
    exterior: false,
    permitFrom: null,
    permitTo: null,
    sundaysAllowed: true,
    assumed_sunday_uplift: 1.0,
    readyOnDay: 30,
    travelMinutes: 0,
    assumed_day_fee_cents: null,
    depositCents: null,
  },
  {
    id: 'STAGE_D',
    name: 'Stage D · The forest house',
    kind: 'stage',
    exterior: false,
    permitFrom: null,
    permitTo: null,
    sundaysAllowed: true,
    assumed_sunday_uplift: 1.0,
    readyOnDay: 44,
    travelMinutes: 0,
    assumed_day_fee_cents: null,
    depositCents: null,
  },
  {
    id: 'HILLFORT',
    name: 'Hillfort',
    kind: 'practical',
    exterior: true,
    permitFrom: 5,
    permitTo: 14,
    sundaysAllowed: false,
    assumed_sunday_uplift: 1.0,
    readyOnDay: null,
    travelMinutes: 55,
    assumed_day_fee_cents: 600_000,
    depositCents: 2_000_000,
  },
  {
    id: 'FOREST_ROAD',
    name: 'Forest road',
    kind: 'practical',
    exterior: true,
    permitFrom: 18,
    permitTo: 26,
    sundaysAllowed: false,
    assumed_sunday_uplift: 1.0,
    readyOnDay: null,
    travelMinutes: 70,
    assumed_day_fee_cents: 400_000,
    depositCents: 1_000_000,
  },
  {
    id: 'COAST',
    name: 'Coast',
    kind: 'practical',
    exterior: true,
    permitFrom: 30,
    permitTo: 38,
    sundaysAllowed: false,
    assumed_sunday_uplift: 1.0,
    readyOnDay: null,
    travelMinutes: 95,
    assumed_day_fee_cents: 750_000,
    depositCents: 3_000_000,
  },
  {
    id: 'RIDGE',
    name: 'Battlefield ridge',
    kind: 'practical',
    exterior: true,
    permitFrom: 42,
    permitTo: 46,
    sundaysAllowed: false,
    assumed_sunday_uplift: 1.0,
    readyOnDay: null,
    travelMinutes: 60,
    assumed_day_fee_cents: 900_000,
    depositCents: 2_500_000,
  },
  /* The lost day's location. Permit runs to day 50 and no further; Sundays are
     allowed at a premium. Both facts decide what the engine may propose. */
  {
    id: 'FORD',
    name: 'River ford',
    kind: 'practical',
    exterior: true,
    permitFrom: 46,
    permitTo: 50,
    sundaysAllowed: true,
    assumed_sunday_uplift: 1.5,
    readyOnDay: null,
    travelMinutes: 65,
    assumed_day_fee_cents: 800_000,
    depositCents: 4_000_000,
  },
  {
    id: 'VILLAGE',
    name: 'Village (backlot)',
    kind: 'practical',
    exterior: true,
    permitFrom: 61,
    permitTo: 70,
    sundaysAllowed: true,
    assumed_sunday_uplift: 1.0,
    readyOnDay: null,
    travelMinutes: 10,
    assumed_day_fee_cents: 300_000,
    depositCents: 500_000,
  },
  {
    id: 'CAVE',
    name: 'Sea cave',
    kind: 'practical',
    exterior: false,
    permitFrom: 71,
    permitTo: 75,
    sundaysAllowed: false,
    assumed_sunday_uplift: 1.0,
    readyOnDay: null,
    travelMinutes: 80,
    assumed_day_fee_cents: 500_000,
    depositCents: 1_500_000,
  },
];

const BY_ID = new Map(LOCATIONS.map((l) => [l.id, l]));

export function locationById(id: string): Location {
  const l = BY_ID.get(id);
  if (!l) throw new Error(`locations.ts: no location ${id}`);
  return l;
}

/** Whether a location may be shot on a production day, and if not, why. */
export function locationOpenOn(id: string, day: number): { ok: true } | { ok: false; reason: string } {
  const l = locationById(id);
  if (l.kind === 'stage') {
    if (l.readyOnDay !== null && day < l.readyOnDay) {
      return { ok: false, reason: `${l.name} is not built until day ${l.readyOnDay}` };
    }
    return { ok: true };
  }
  if (l.permitFrom !== null && l.permitTo !== null && (day < l.permitFrom || day > l.permitTo)) {
    return { ok: false, reason: `${l.name} permit covers days ${l.permitFrom}–${l.permitTo} only` };
  }
  return { ok: true };
}
