import type { CastMember } from './types';

/* ===========================================================================
   CAST

   Twenty-four parts, reduced to what a scheduler needs: a contract window,
   the days an actor is contractually elsewhere, whether they are a child, and
   whether their deal forbids a seventh consecutive day.

   The characters are invented, with names that belong to no book, legend
   or show. No actor is named or implied. The day rates exist so that the
   model boundary has something real to refuse; see `breakdown.ts` and
   `boundary.test.ts`.

   Every contract here is invented.
   =========================================================================== */

export const CAST: readonly CastMember[] = [
  { number: 1, character: 'MAELOR', contractFrom: 1, contractTo: 79, unavailableDays: [], minor: false, restDayClause: false, assumed_day_rate_cents: 2_500_000, optionExpires: '2027-06-30' },
  { number: 2, character: 'TANWEN', contractFrom: 1, contractTo: 79, unavailableDays: [], minor: false, restDayClause: false, assumed_day_rate_cents: 1_200_000, optionExpires: '2027-06-30' },
  { number: 3, character: 'BRIOC', contractFrom: 1, contractTo: 79, unavailableDays: [], minor: false, restDayClause: false, assumed_day_rate_cents: 900_000, optionExpires: '2027-06-30' },
  { number: 4, character: 'ELERI', contractFrom: 9, contractTo: 72, unavailableDays: [], minor: false, restDayClause: false, assumed_day_rate_cents: 1_100_000, optionExpires: '2027-06-30' },
  /* A theater run in the actor's home city: two fixed dates the production agreed to at signing. */
  { number: 5, character: 'PADARN', contractFrom: 13, contractTo: 70, unavailableDays: [47, 48], minor: false, restDayClause: false, assumed_day_rate_cents: 800_000, optionExpires: null },
  { number: 6, character: 'EINION', contractFrom: 1, contractTo: 60, unavailableDays: [], minor: false, restDayClause: false, assumed_day_rate_cents: 1_000_000, optionExpires: '2027-05-31' },
  /* No seventh consecutive days. Negotiated, in writing, and it binds the schedule. */
  { number: 7, character: 'CYNAN', contractFrom: 1, contractTo: 79, unavailableDays: [], minor: false, restDayClause: true, assumed_day_rate_cents: 1_500_000, optionExpires: '2027-06-30' },
  { number: 8, character: 'SELYF', contractFrom: 20, contractTo: 66, unavailableDays: [], minor: false, restDayClause: false, assumed_day_rate_cents: 600_000, optionExpires: null },
  /* Eleven years old. Everything about his day is shorter. Contracted from
     day 5 for fittings and tutor set-up. */
  { number: 9, character: 'IEUAN', contractFrom: 5, contractTo: 79, unavailableDays: [], minor: true, restDayClause: false, assumed_day_rate_cents: 150_000, optionExpires: null },
  { number: 10, character: 'NEST', contractFrom: 25, contractTo: 79, unavailableDays: [], minor: false, restDayClause: false, assumed_day_rate_cents: 700_000, optionExpires: '2027-06-30' },
  { number: 11, character: 'BLEDRI', contractFrom: 1, contractTo: 36, unavailableDays: [], minor: false, restDayClause: false, assumed_day_rate_cents: 1_300_000, optionExpires: null },
  /* One travel day mid-block, agreed at signing. */
  { number: 12, character: 'TUDWAL', contractFrom: 30, contractTo: 58, unavailableDays: [48], minor: false, restDayClause: false, assumed_day_rate_cents: 500_000, optionExpires: null },
  { number: 13, character: 'CADFAN', contractFrom: 7, contractTo: 50, unavailableDays: [], minor: false, restDayClause: false, assumed_day_rate_cents: 550_000, optionExpires: null },
  { number: 14, character: 'FIRST SCOUT', contractFrom: 46, contractTo: 50, unavailableDays: [], minor: false, restDayClause: false, assumed_day_rate_cents: 90_000, optionExpires: null },
  { number: 15, character: 'SECOND SCOUT', contractFrom: 46, contractTo: 50, unavailableDays: [], minor: false, restDayClause: false, assumed_day_rate_cents: 90_000, optionExpires: null },
  { number: 16, character: 'DYFNWAL', contractFrom: 1, contractTo: 30, unavailableDays: [], minor: false, restDayClause: false, assumed_day_rate_cents: 450_000, optionExpires: null },
  { number: 17, character: 'CERIS', contractFrom: 1, contractTo: 30, unavailableDays: [], minor: false, restDayClause: false, assumed_day_rate_cents: 450_000, optionExpires: null },
  { number: 18, character: 'GWYNFOR', contractFrom: 25, contractTo: 30, unavailableDays: [], minor: false, restDayClause: false, assumed_day_rate_cents: 800_000, optionExpires: null },
  { number: 19, character: 'THE ABBOT', contractFrom: 51, contractTo: 56, unavailableDays: [], minor: false, restDayClause: false, assumed_day_rate_cents: 300_000, optionExpires: null },
  { number: 20, character: 'RIDER CAPTAIN', contractFrom: 42, contractTo: 50, unavailableDays: [], minor: false, restDayClause: false, assumed_day_rate_cents: 200_000, optionExpires: null },
  { number: 21, character: 'THE SMITH', contractFrom: 19, contractTo: 24, unavailableDays: [], minor: false, restDayClause: false, assumed_day_rate_cents: 180_000, optionExpires: null },
  { number: 22, character: 'LLIO', contractFrom: 25, contractTo: 66, unavailableDays: [], minor: false, restDayClause: false, assumed_day_rate_cents: 1_400_000, optionExpires: '2027-06-30' },
  { number: 23, character: 'THE MESSENGER', contractFrom: 37, contractTo: 45, unavailableDays: [], minor: false, restDayClause: false, assumed_day_rate_cents: 160_000, optionExpires: null },
  { number: 24, character: 'THE QUEEN', contractFrom: 55, contractTo: 57, unavailableDays: [], minor: false, restDayClause: false, assumed_day_rate_cents: 400_000, optionExpires: null },
];

const BY_NUMBER = new Map(CAST.map((c) => [c.number, c]));

export function castByNumber(n: number): CastMember {
  const c = BY_NUMBER.get(n);
  if (!c) throw new Error(`cast.ts: no cast member ${n}`);
  return c;
}

/** Under contract, and not contractually elsewhere, on this production day. */
export function castAvailableOn(n: number, day: number): { ok: true } | { ok: false; reason: string } {
  const c = castByNumber(n);
  if (day < c.contractFrom || day > c.contractTo) {
    return { ok: false, reason: `${c.number} ${c.character} is out of contract on day ${day} (window ${c.contractFrom}–${c.contractTo})` };
  }
  if (c.unavailableDays.includes(day)) {
    return { ok: false, reason: `${c.number} ${c.character} is contractually elsewhere on day ${day}` };
  }
  return { ok: true };
}
