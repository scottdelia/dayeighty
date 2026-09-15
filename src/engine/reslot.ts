import type {
  CoverCandidate,
  Feasibility,
  Finding,
  Forecast,
  Notice,
  Placement,
  ReslotOption,
  Scene,
  Unplaced,
} from './types';
import { worstSeverity } from './types';
import { castAvailableOn, castByNumber } from './cast';
import { locationById, locationOpenOn } from './locations';
import {
  ASSUMED,
  dawnCallFor,
  dayLabel,
  daylightFor,
  hhmmToMinutes,
  isFirstDayAfterRest,
  minutesToHhmm,
  restDayAfter,
  longDate,
  clock,
} from './production';
import { mulberry32 } from './rng';
import { SHOOT_DAYS, castIn, dayEighths, sceneByNumber, shootDay } from './script';

/* ===========================================================================
   THE LOST DAY — THE DETERMINISTIC HALF

   No model runs in this file. Given the same schedule, the same contracts and
   the same forecast it proposes the same options at the same prices, every
   time, and every constraint it checks cites the document it is checking.

   The situation: it is the evening before an exterior day. The forecast has
   turned. The call sheet has to go out by 20:00. Five or six people are about
   to stand around a paper schedule and re-sort it by hand.

   This file does the re-sorting, for any exterior day in the schedule. It
   does not choose. The producer chooses, with the costs in front of them
   instead of behind them.
   =========================================================================== */

/* ---------------------------------------------------------------------------
   The forecast: an input with a horizon, not a prediction.
   --------------------------------------------------------------------------- */

const FEED_SOURCE =
  'Weather feed, issued 5:30 PM. The engine does not predict weather. It takes the forecast as given and says nothing about days beyond its horizon.';

/**
 * The forecast that turns an exterior day into a lost one.
 *
 * Deterministic per day. A river location is unsafe once the river is up,
 * whatever the sky does afterward; that fact decides which scenes can shoot
 * in a cleared afternoon, and it is the water safety lead's call, not the
 * engine's, so the engine only carries it.
 */
export function forecastFor(day: number): Forecast {
  const loc = locationById(shootDay(day).locationId);
  const rng = mulberry32(day * 7919);
  const clears = rng() < 0.6;
  const rainIn = (6 + Math.floor(rng() * 7)) / 10;
  const windMph = 15 + Math.floor(rng() * 20);
  const waterUnsafe = loc.id === 'FORD' || loc.id === 'COAST';
  const clearsAt = clears ? (rng() < 0.5 ? '14:00' : '15:00') : null;
  const summary = clears
    ? `Heavy rain from 5:00 AM, clearing mid-afternoon. Wind gusting from the west.${waterUnsafe ? (loc.id === 'FORD' ? ' River rising.' : ' Sea state rough into the evening.') : ''}`
    : `Rain and wind all day. No window.${waterUnsafe ? (loc.id === 'FORD' ? ' River rising.' : ' Sea state rough.') : ''}`;
  return { forDay: day, issuedAt: '17:30', summary, rainIn, windMph, horizonDays: 5, clearsAt, waterUnsafe, source: FEED_SOURCE };
}

export interface ReslotContext {
  asOfDay: number;
  lostDay: number;
  forecast: Forecast;
}

/** The evening before `day`, with that day's forecast in hand. */
export function lostDayContext(day: number): ReslotContext {
  return { asOfDay: day - 1, lostDay: day, forecast: forecastFor(day) };
}

export const DEFAULT_LOST_DAY = 47;
export const DEFAULT_RESLOT_CONTEXT: ReslotContext = lostDayContext(DEFAULT_LOST_DAY);
export const FORECAST: Forecast = DEFAULT_RESLOT_CONTEXT.forecast;

/** Every exterior day the weather could take. Stage days do not get lost to rain. */
export function losableDays(): number[] {
  return SHOOT_DAYS.filter((d) => d.day >= 2 && locationById(d.locationId).exterior).map((d) => d.day);
}

/** What a lost day was going to be, for the page that describes it. */
export function describeLostDay(day: number): {
  locationName: string;
  sceneCount: number;
  eighths: number;
  extras: number;
  horses: boolean;
  water: boolean;
  dawn: boolean;
  dusk: boolean;
  minor: boolean;
  permitTo: number | null;
  daysLeftInPermit: number;
} {
  const d = shootDay(day);
  const loc = locationById(d.locationId);
  const scenes = d.scenes.map(sceneByNumber);
  return {
    locationName: loc.name,
    sceneCount: scenes.length,
    eighths: dayEighths(d),
    extras: Math.max(0, ...scenes.map((s) => s.extras)),
    horses: scenes.some((s) => s.needs.includes('horses')),
    water: scenes.some((s) => s.needs.includes('water_safety')),
    dawn: scenes.some((s) => s.time === 'DAWN'),
    dusk: scenes.some((s) => s.time === 'DUSK'),
    minor: scenes.some((s) => s.cast.some((n) => castByNumber(n).minor)),
    permitTo: loc.permitTo,
    daysLeftInPermit: sameLocationDaysAfter(day).length,
  };
}

/* ---------------------------------------------------------------------------
   Money
   --------------------------------------------------------------------------- */

const HOURLY_CENTS = ASSUMED.assumed_unit_day_cost_cents / ASSUMED.assumed_base_hours;

/** Cost of `hours` of overtime beyond the base day, at the assumed multipliers. */
export function overtimeCents(hours: number): number {
  if (hours <= 0) return 0;
  const tier1 = Math.min(hours, 2);
  const tier2 = Math.max(0, hours - 2);
  return Math.round(HOURLY_CENTS * (tier1 * ASSUMED.assumed_ot_multiplier_1 + tier2 * ASSUMED.assumed_ot_multiplier_2));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function sum(lines: readonly { cents: number }[]): number {
  return lines.reduce((n, l) => n + l.cents, 0);
}

/* ---------------------------------------------------------------------------
   Day state, for placing scenes into days that already have scenes.
   --------------------------------------------------------------------------- */

interface DayState {
  day: number;
  locationId: string;
  eighths: number;
  hasDawn: boolean;
  hasDusk: boolean;
  extras: number;
  hasHorses: boolean;
  hasWater: boolean;
  unitCall: string;
  plannedWrap: string;
  overtimeHours: number;
}

function dayState(day: number): DayState {
  const d = shootDay(day);
  const scenes = d.scenes.map(sceneByNumber);
  return {
    day,
    locationId: d.locationId,
    eighths: dayEighths(d),
    hasDawn: scenes.some((s) => s.time === 'DAWN'),
    hasDusk: scenes.some((s) => s.time === 'DUSK'),
    extras: Math.max(0, ...scenes.map((s) => s.extras)),
    hasHorses: scenes.some((s) => s.needs.includes('horses')),
    hasWater: scenes.some((s) => s.needs.includes('water_safety')),
    unitCall: d.unitCall,
    plannedWrap: d.plannedWrap,
    overtimeHours: 0,
  };
}

/** Overtime hours a day carries at a given page load, before any dusk lock. */
function pagesOvertime(eighths: number): number {
  const over = Math.max(0, eighths - ASSUMED.assumed_day_capacity_eighths);
  return over / ASSUMED.assumed_eighths_per_hour;
}

/** Overtime a dusk scene forces: the unit cannot wrap before the light goes. */
function duskOvertime(unitCall: string, day: number): number {
  const wrapBase = hhmmToMinutes(unitCall) + ASSUMED.assumed_base_hours * 60;
  const duskEnd = hhmmToMinutes(daylightFor(day).sunset) + 30;
  return Math.max(0, (duskEnd - wrapBase) / 60);
}

function sameLocationDaysAfter(day: number): number[] {
  const lost = shootDay(day);
  return SHOOT_DAYS.filter((d) => d.day > day && d.locationId === lost.locationId).map((d) => d.day);
}

/* ---------------------------------------------------------------------------
   Placing lost scenes into other days: the absorb routine every option shares.
   --------------------------------------------------------------------------- */

interface AbsorbResult {
  placements: Placement[];
  unplaced: Unplaced[];
  findings: Finding[];
  costLines: { label: string; cents: number }[];
}

interface Attempt {
  ok: boolean;
  reasons: string[];
  marginalCents: number;
  marginalOt: number;
  findings: Finding[];
}

function tryPlace(sc: Scene, st: DayState, _ctx: ReslotContext): Attempt {
  const reasons: string[] = [];
  const findings: Finding[] = [];
  let marginalCents = 0;

  const open = locationOpenOn(st.locationId, st.day);
  if (!open.ok) reasons.push(open.reason);
  if (sc.locationId !== st.locationId) reasons.push(`scene is set at ${locationById(sc.locationId).name}, not ${locationById(st.locationId).name}`);

  for (const n of sc.cast) {
    const a = castAvailableOn(n, st.day);
    if (!a.ok) reasons.push(a.reason);
  }

  if (sc.time === 'DAWN' && st.hasDawn) reasons.push(`${dayLabel(st.day)} already has a dawn scene; a day has one dawn`);
  if (sc.time === 'DUSK' && st.hasDusk) reasons.push(`${dayLabel(st.day)} already has a dusk scene; a day has one dusk`);

  if (reasons.length > 0) return { ok: false, reasons, marginalCents: 0, marginalOt: 0, findings };

  // Overtime: the marginal hours this scene adds to the day.
  const dawnCall = dawnCallFor(st.day);
  const before = Math.max(pagesOvertime(st.eighths), st.hasDusk ? duskOvertime(st.unitCall, st.day) : 0);
  const afterCall = sc.time === 'DAWN' ? dawnCall : st.unitCall;
  const after = Math.max(pagesOvertime(st.eighths + sc.eighths), st.hasDusk || sc.time === 'DUSK' ? duskOvertime(afterCall, st.day) : 0);
  const marginalOt = round1(Math.max(0, after - before));
  marginalCents += overtimeCents(after) - overtimeCents(before);
  if (sc.extras > 0 && marginalOt > 0) {
    marginalCents += Math.round(Math.max(sc.extras, st.extras) * ASSUMED.assumed_extra_ot_hour_cents * marginalOt);
  }

  // Bookings the day does not already carry.
  if (sc.extras > st.extras) {
    const added = sc.extras - st.extras;
    marginalCents += added * ASSUMED.assumed_extra_day_rate_cents;
    findings.push({
      code: 'BOOK.EXTRAS_ADDED',
      severity: 'open',
      title: `${added} background added to ${dayLabel(st.day)}`,
      detail: `${dayLabel(st.day)} was not carrying ${sc.extras} background. Booking them at short notice is ordinary, and it is a cost the original day did not have.`,
      source: `Stripboard · ${dayLabel(st.day)} · background`,
      costCents: added * ASSUMED.assumed_extra_day_rate_cents,
      dueDay: st.day - 1,
    });
  }
  if (sc.needs.includes('horses') && !st.hasHorses) {
    marginalCents += ASSUMED.assumed_horse_package_day_cents;
    findings.push({
      code: 'BOOK.HORSES_ADDED',
      severity: 'open',
      title: `Horse package added to ${dayLabel(st.day)}`,
      detail: `${dayLabel(st.day)} had no mounted work. The package comes as a day, not as a scene.`,
      source: `Stripboard · ${dayLabel(st.day)} · animals`,
      costCents: ASSUMED.assumed_horse_package_day_cents,
      dueDay: st.day - 1,
    });
  }
  if (sc.needs.includes('water_safety') && !st.hasWater) {
    marginalCents += ASSUMED.assumed_water_safety_day_cents;
  }

  // A dawn call the morning after a full day breaks turnaround unless the
  // previous day wraps early or the previous day was the rest day.
  if (sc.time === 'DAWN' && !isFirstDayAfterRest(st.day)) {
    const prev = SHOOT_DAYS.find((d) => d.day === st.day - 1);
    if (prev) {
      const gap = (24 * 60 - hhmmToMinutes(prev.plannedWrap) + hhmmToMinutes(dawnCall)) / 60;
      if (gap < ASSUMED.assumed_turnaround_hours) {
        const mustWrap = minutesToHhmm(hhmmToMinutes(dawnCall) - ASSUMED.assumed_turnaround_hours * 60);
        findings.push({
          code: 'TURNAROUND.DAWN_CALL',
          severity: 'review',
          title: `${dawnCall} call on ${dayLabel(st.day)} breaks turnaround from ${dayLabel(prev.day)}`,
          detail: `${dayLabel(prev.day)} is planned to wrap at ${prev.plannedWrap}; a ${dawnCall} call gives ${round1(gap)} hours against an assumed ${ASSUMED.assumed_turnaround_hours}. Either ${dayLabel(prev.day)} wraps by ${mustWrap}, or the forced call is paid.`,
          source: 'Crew agreement · turnaround · assumed_turnaround_hours',
          costCents: ASSUMED.assumed_forced_call_cents,
          dueDay: prev.day,
        });
        marginalCents += ASSUMED.assumed_forced_call_cents;
      }
    }
  }

  // A child on a dusk scene: hours and latest wrap.
  if (sc.cast.some((n) => castByNumber(n).minor) && sc.time === 'DUSK') {
    const wrapMin = hhmmToMinutes(daylightFor(st.day).sunset) + 30;
    if (wrapMin > hhmmToMinutes(ASSUMED.assumed_minor_latest_wrap)) {
      reasons.push('the dusk wrap is later than a child may work');
      return { ok: false, reasons, marginalCents: 0, marginalOt: 0, findings };
    }
    findings.push({
      code: 'MINOR.LATE_CALL',
      severity: 'open',
      title: `Call the child late on ${dayLabel(st.day)}`,
      detail: `Dusk wraps about ${clock(minutesToHhmm(wrapMin))}, inside the assumed ${clock(ASSUMED.assumed_minor_latest_wrap)} latest wrap. An afternoon call keeps the day inside ${ASSUMED.assumed_minor_max_set_hours} hours. Chaperone and tutor on the sheet.`,
      source: 'Child performance rules · assumed_minor_max_set_hours · assumed_minor_latest_wrap',
      costCents: null,
      dueDay: st.day - 1,
    });
  }

  return { ok: true, reasons, marginalCents, marginalOt, findings };
}

/**
 * Place each lost scene into the cheapest feasible candidate day.
 *
 * Order matters: scenes locked to the light go first because they have the
 * fewest homes, then scenes with a child, then the longest. A greedy order
 * is not optimal in general, and the point of this demo is not the solver;
 * it is that the constraints are checked at all, and cited.
 */
export function absorb(lostScenes: readonly Scene[], candidateDays: readonly number[], ctx: ReslotContext): AbsorbResult {
  const states = new Map<number, DayState>(candidateDays.map((d) => [d, dayState(d)]));
  const placements: Placement[] = [];
  const unplaced: Unplaced[] = [];
  const findings: Finding[] = [];
  const costLines: { label: string; cents: number }[] = [];

  const rank = (s: Scene): number => (s.time === 'DAWN' || s.time === 'DUSK' ? 0 : s.cast.some((n) => castByNumber(n).minor) ? 1 : 2);
  const ordered = [...lostScenes].sort((a, b) => rank(a) - rank(b) || b.eighths - a.eighths);

  for (const sc of ordered) {
    let best: { day: number; attempt: Attempt } | null = null;
    const rejected: string[] = [];
    if (candidateDays.length === 0) {
      rejected.push(`no later day at ${locationById(sc.locationId).name} inside its permit window`);
    }
    for (const d of candidateDays) {
      const st = states.get(d)!;
      const attempt = tryPlace(sc, st, ctx);
      if (!attempt.ok) {
        rejected.push(`${dayLabel(d)}: ${attempt.reasons.join('; ')}`);
        continue;
      }
      if (!best || attempt.marginalCents < best.attempt.marginalCents) best = { day: d, attempt };
    }
    if (!best) {
      unplaced.push({ scene: sc.number, reason: rejected.join(' · ') });
      continue;
    }
    const st = states.get(best.day)!;
    st.eighths += sc.eighths;
    if (sc.time === 'DAWN') {
      st.hasDawn = true;
      st.unitCall = dawnCallFor(best.day);
    }
    if (sc.time === 'DUSK') st.hasDusk = true;
    st.extras = Math.max(st.extras, sc.extras);
    if (sc.needs.includes('horses')) st.hasHorses = true;
    if (sc.needs.includes('water_safety')) st.hasWater = true;
    st.overtimeHours = round1(st.overtimeHours + best.attempt.marginalOt);
    placements.push({
      scene: sc.number,
      fromDay: ctx.lostDay,
      toDay: best.day,
      overtimeHours: best.attempt.marginalOt,
      unit: 'main',
      reason:
        best.attempt.marginalOt > 0
          ? `Cheapest home. Adds ${best.attempt.marginalOt} hours of overtime to ${dayLabel(best.day)}.`
          : `Fits inside ${dayLabel(best.day)} without overtime.`,
    });
    findings.push(...best.attempt.findings);
    if (best.attempt.marginalCents > 0) {
      costLines.push({ label: `Sc ${sc.number} → ${dayLabel(best.day)}`, cents: best.attempt.marginalCents });
    }
  }

  for (const st of states.values()) {
    if (st.overtimeHours > 0) {
      const total = pagesOvertime(st.eighths);
      findings.push({
        code: 'OT.DAY_EXTENDED',
        severity: total > 2 ? 'review' : 'open',
        title: `${dayLabel(st.day)} runs ${st.overtimeHours} hrs over`,
        detail: `${st.eighths} eighths against an assumed capacity of ${ASSUMED.assumed_day_capacity_eighths}. ${total > 2 ? "Beyond two hours the rate doubles and the next morning's turnaround starts to move." : 'Inside the time-and-a-half band.'}`,
        source: 'Stripboard · assumed_day_capacity_eighths · assumed_eighths_per_hour',
        costCents: overtimeCents(total),
        dueDay: st.day,
      });
    }
  }

  if (unplaced.length > 0) {
    findings.push({
      code: 'ABSORB.NO_HOME',
      severity: 'review',
      title: `${unplaced.length} scene${unplaced.length === 1 ? '' : 's'} with no home inside the permit window`,
      detail: 'The pages still have to shoot. That means a permit extension, a return visit, or a rewrite, and the engine prices none of those because none is a rate.',
      source: 'Location agreement · permitTo',
      costCents: null,
      dueDay: ctx.lostDay,
    });
  }

  return { placements, unplaced, findings, costLines };
}

/* ---------------------------------------------------------------------------
   What tomorrow's bookings cost to cancel inside 48 hours.
   --------------------------------------------------------------------------- */

function cancellationLines(lostScenes: readonly Scene[]): { lines: { label: string; cents: number }[]; findings: Finding[] } {
  const lines: { label: string; cents: number }[] = [];
  const findings: Finding[] = [];
  const extras = Math.max(0, ...lostScenes.map((s) => s.extras));
  if (extras > 0) {
    const cents = Math.round(extras * ASSUMED.assumed_extra_day_rate_cents * ASSUMED.assumed_extra_cancel_share_under_48h);
    lines.push({ label: `${extras} background canceled inside 48 hours`, cents });
  }
  if (lostScenes.some((s) => s.needs.includes('horses'))) {
    const cents = Math.round(ASSUMED.assumed_horse_package_day_cents * ASSUMED.assumed_horse_cancel_share_under_48h);
    lines.push({ label: 'Horse package canceled inside 48 hours', cents });
    findings.push({
      code: 'BOOK.HORSES_CANCELED',
      severity: 'open',
      title: 'The horses are paid for whether or not they work',
      detail: 'Animal contracts rarely allow late cancellation. The package is a sunk day; the question is only whether it is also a wasted one.',
      source: 'Animal contract · assumed_horse_cancel_share_under_48h',
      costCents: cents,
      dueDay: null,
    });
  }
  if (lostScenes.some((s) => s.needs.includes('water_safety'))) {
    lines.push({ label: 'Water safety team canceled', cents: ASSUMED.assumed_water_safety_day_cents });
  }
  return { lines, findings };
}

/*
  Feasibility is about whether the pages get shot, not about what it costs.
  A block finding makes an option infeasible. A scene with no home, or a
  finding that says "this happens only if something uncertain happens", makes
  it partial. An expensive option is still a feasible one; the price is
  printed next to it.
*/
const PARTIAL_CODES = new Set(['COVER.PREP_COMPRESSED', 'COVER.EXTRAS_SHORT_NOTICE', 'REST.CAST_CLAUSE', 'SU.ASSUMED']);

function feasibilityOf(findings: readonly Finding[], unplaced: readonly Unplaced[]): Feasibility {
  if (findings.some((f) => f.severity === 'block')) return 'infeasible';
  if (unplaced.length > 0 || findings.some((f) => PARTIAL_CODES.has(f.code))) return 'partial';
  return 'feasible';
}

/*
  The order a production office actually makes the calls: the people with
  animals and background first, because they are the hardest to unwind;
  then the second AD calls the cast and emails their agents; then the
  departments; then the sheet, last, because the sheet is always last.
*/
const NOTICE_TIMES = {
  horses: '18:45',
  extras: '18:45',
  agents: '19:00',
  transport: '19:30',
  locations: '19:30',
  catering: '19:45',
  sheet: '19:55',
} as const;

function standardNotices(lostScenes: readonly Scene[], releasedCast: readonly number[], addedCast: readonly number[]): Notice[] {
  const out: Notice[] = [];
  if (releasedCast.length > 0) {
    out.push({ who: '2nd AD', what: `Call and release ${releasedCast.map((n) => `${n} ${castByNumber(n).character}`).join(', ')} from tomorrow. Agents by email.`, by: NOTICE_TIMES.agents });
  }
  if (addedCast.length > 0) {
    out.push({ who: '2nd AD', what: `Call ${addedCast.map((n) => `${n} ${castByNumber(n).character}`).join(', ')} for tomorrow; not previously scheduled. Agents by email.`, by: NOTICE_TIMES.agents });
  }
  if (lostScenes.some((s) => s.needs.includes('horses'))) {
    out.push({ who: 'Head wrangler', what: 'Cancel the package for tomorrow. Confirm the next mounted day.', by: NOTICE_TIMES.horses });
  }
  const extras = Math.max(0, ...lostScenes.map((s) => s.extras));
  if (extras > 0) {
    out.push({ who: 'Background coordinator', what: `Release ${extras} background for tomorrow.`, by: NOTICE_TIMES.extras });
  }
  return out;
}

/* ---------------------------------------------------------------------------
   The cover search: every future stage day, checked as tomorrow's cover.
   --------------------------------------------------------------------------- */

export function coverCandidates(ctx: ReslotContext): CoverCandidate[] {
  const out: CoverCandidate[] = [];
  for (const d of SHOOT_DAYS) {
    if (d.day <= ctx.lostDay) continue;
    const loc = locationById(d.locationId);
    if (loc.kind !== 'stage') continue;
    const reasons: string[] = [];
    let worst: Feasibility = 'feasible';
    const bump = (f: Feasibility) => {
      if (f === 'infeasible') worst = 'infeasible';
      else if (f === 'partial' && worst !== 'infeasible') worst = 'partial';
    };

    const open = locationOpenOn(d.locationId, ctx.lostDay);
    if (!open.ok) {
      reasons.push(open.reason);
      bump('infeasible');
    }
    for (const n of castIn(d.scenes)) {
      const a = castAvailableOn(n, ctx.lostDay);
      if (!a.ok) {
        reasons.push(a.reason);
        bump('infeasible');
      }
    }
    const scenes = d.scenes.map(sceneByNumber);
    const prep = Math.max(0, ...scenes.map((s) => s.prepDays));
    if (prep > 0) {
      reasons.push(`needs ${prep} prep day${prep === 1 ? '' : 's'} of dressing; there are none. Overnight at overtime, or not at all.`);
      bump('partial');
    }
    const extras = Math.max(0, ...scenes.map((s) => s.extras));
    if (extras > 0) {
      reasons.push(`needs ${extras} background at less than 24 hours' notice. The engine will not promise a fill rate.`);
      bump('partial');
    }
    if (worst === 'feasible') reasons.push('set built, cast available, nothing to prep, nothing to book');
    out.push({ day: d.day, locationId: d.locationId, scenes: d.scenes, eighths: dayEighths(d), feasibility: worst, reasons });
  }
  return out;
}

function bestCover(candidates: readonly CoverCandidate[]): CoverCandidate | null {
  const order: Record<Feasibility, number> = { feasible: 0, partial: 1, infeasible: 2 };
  const ranked = [...candidates].sort((a, b) => order[a.feasibility] - order[b.feasibility] || a.day - b.day);
  const c = ranked[0];
  return c && c.feasibility !== 'infeasible' ? c : null;
}

/** Findings and lines a partial cover candidate carries. */
function coverCaveats(chosen: CoverCandidate, ctx: ReslotContext): { findings: Finding[]; costLines: { label: string; cents: number }[]; unpriced: string[] } {
  const findings: Finding[] = [];
  const costLines: { label: string; cents: number }[] = [];
  const unpriced: string[] = [];
  const scenes = chosen.scenes.map(sceneByNumber);
  if (scenes.some((s) => s.prepDays > 0)) {
    costLines.push({ label: 'Overnight set dressing', cents: ASSUMED.assumed_overnight_dressing_cents });
    findings.push({
      code: 'COVER.PREP_COMPRESSED',
      severity: 'review',
      title: `${dayLabel(chosen.day)}'s set needs prep that has not happened`,
      detail: 'Two days of dressing done tonight by an art department that has already worked a full day. It is possible. It is not free and it is not certain.',
      source: `Breakdown · scenes ${chosen.scenes.join(', ')} · prep_days`,
      costCents: ASSUMED.assumed_overnight_dressing_cents,
      dueDay: ctx.lostDay,
    });
  }
  if (scenes.some((s) => s.extras > 0)) {
    unpriced.push("Background at under 24 hours' notice: the fill rate is unknowable tonight and the engine will not invent one.");
    findings.push({
      code: 'COVER.EXTRAS_SHORT_NOTICE',
      severity: 'review',
      title: `${Math.max(...scenes.map((s) => s.extras))} background at under 24 hours' notice`,
      detail: 'The background coordinator will get some of them. How many is not knowable at 18:10, and a feast for sixty shot with twenty is a different scene.',
      source: `Breakdown · scenes ${chosen.scenes.join(', ')} · background`,
      costCents: null,
      dueDay: ctx.lostDay,
    });
  }
  return { findings, costLines, unpriced };
}

function coverNotices(ctx: ReslotContext, lostScenes: readonly Scene[], tomorrowScenes: readonly string[], coverLocationId: string): Notice[] {
  const originalCast = castIn(lostScenes.map((s) => s.number));
  const newCast = castIn(tomorrowScenes);
  const released = originalCast.filter((n) => !newCast.includes(n));
  const added = newCast.filter((n) => !originalCast.includes(n));
  const lostLoc = locationById(shootDay(ctx.lostDay).locationId);
  const notices: Notice[] = [
    ...standardNotices(lostScenes, released, added),
    { who: 'Transportation captain', what: `Base call at the studio. No shuttles to ${lostLoc.name}.`, by: NOTICE_TIMES.transport },
    { who: 'Location manager', what: `${lostLoc.name} permit day ${ctx.lostDay} goes unused. Confirm the window still closes on day ${lostLoc.permitTo}.`, by: NOTICE_TIMES.locations },
    { who: 'Catering', what: 'Headcount drops: no background, no wranglers. Studio canteen.', by: NOTICE_TIMES.catering },
    { who: 'Everyone', what: 'Revised call sheet, second issue.', by: NOTICE_TIMES.sheet },
  ];
  if (tomorrowScenes.map(sceneByNumber).some((s) => s.needs.includes('sfx_fire'))) {
    notices.push({ who: 'Fire officer', what: `Practical fire on ${locationById(coverLocationId).name} tomorrow.`, by: NOTICE_TIMES.transport });
  }
  return notices;
}

function noCoverOption(id: string, kind: ReslotOption['kind'], title: string, lostScenes: readonly Scene[], candidates: CoverCandidate[], ctx: ReslotContext): ReslotOption {
  return {
    id,
    kind,
    title,
    summary: 'No stage day in the remaining schedule can be pulled forward.',
    feasibility: 'infeasible',
    candidates,
    tomorrow: null,
    split: null,
    placements: [],
    unplaced: lostScenes.map((s) => ({ scene: s.number, reason: 'no cover available' })),
    findings: [{
      code: 'COVER.NONE',
      severity: 'block',
      title: 'No cover set',
      detail: 'Every future stage day fails on set readiness or cast availability.',
      source: 'Stripboard · stage days after today',
      costCents: null,
      dueDay: ctx.lostDay,
    }],
    costCents: null,
    costLines: [],
    unpriced: [],
    notices: [],
    opensDay: null,
  };
}

/* ---------------------------------------------------------------------------
   Option: cover set
   --------------------------------------------------------------------------- */

function coverSetOption(ctx: ReslotContext, lostScenes: readonly Scene[]): ReslotOption {
  const candidates = coverCandidates(ctx);
  const chosen = bestCover(candidates);
  if (!chosen) return noCoverOption('cover', 'cover_set', 'Shoot a cover set tomorrow', lostScenes, candidates, ctx);

  const caveats = coverCaveats(chosen, ctx);
  const absorbed = absorb(lostScenes, sameLocationDaysAfter(ctx.lostDay), ctx);
  const cancel = cancellationLines(lostScenes);
  const findings: Finding[] = [...caveats.findings, ...absorbed.findings, ...cancel.findings];
  const costLines = [...caveats.costLines, ...cancel.lines, ...absorbed.costLines];

  findings.push({
    code: 'COVER.DAY_OPENS',
    severity: 'review',
    title: `${dayLabel(chosen.day)} opens`,
    detail: `Its scenes shoot tomorrow, so ${dayLabel(chosen.day)} has nothing on it. Hold it as a cover day for the exterior blocks still to come, or pull ${dayLabel(chosen.day + 1)} forward. That is a first assistant director's call, not an engine's.`,
    source: `Stripboard · ${dayLabel(chosen.day)}`,
    costCents: null,
    dueDay: chosen.day - 1,
  });

  return {
    id: 'cover',
    kind: 'cover_set',
    title: `Shoot ${dayLabel(chosen.day)}'s stage scenes tomorrow`,
    summary: `${locationById(chosen.locationId).name} is built and its cast are available. The lost scenes move into the remaining permit days.`,
    feasibility: feasibilityOf(findings, absorbed.unplaced),
    candidates,
    tomorrow: { locationId: chosen.locationId, scenes: chosen.scenes, unitCall: '07:00', plannedWrap: '17:00' },
    split: null,
    placements: absorbed.placements,
    unplaced: absorbed.unplaced,
    findings,
    costCents: caveats.unpriced.length > 0 ? null : sum(costLines),
    costLines,
    unpriced: caveats.unpriced,
    notices: coverNotices(ctx, lostScenes, chosen.scenes, chosen.locationId),
    opensDay: chosen.day,
  };
}

/* ---------------------------------------------------------------------------
   Option: split day — cover set until it clears, then the location.
   --------------------------------------------------------------------------- */

function splitDayOption(ctx: ReslotContext, lostScenes: readonly Scene[]): ReslotOption {
  const candidates = coverCandidates(ctx);
  const chosen = bestCover(candidates);
  const lostLoc = locationById(shootDay(ctx.lostDay).locationId);
  const light = daylightFor(ctx.lostDay);
  const f = ctx.forecast;

  if (!chosen) return noCoverOption('split', 'split_day', 'Split the day', lostScenes, candidates, ctx);

  if (!f.clearsAt) {
    return {
      id: 'split',
      kind: 'split_day',
      title: 'Split the day: stage until it clears, then the location',
      summary: 'The forecast has no window. There is nothing to split.',
      feasibility: 'infeasible',
      tomorrow: null,
      split: null,
      placements: [],
      unplaced: lostScenes.map((s) => ({ scene: s.number, reason: 'no clearing forecast' })),
      findings: [{
        code: 'SPLIT.NO_WINDOW',
        severity: 'block',
        title: 'No window in the forecast',
        detail: `${f.summary} A split day needs an afternoon. The feed does not offer one.`,
        source: f.source,
        costCents: null,
        dueDay: ctx.lostDay,
      }],
      costCents: null,
      costLines: [],
      unpriced: [],
      notices: [],
      opensDay: null,
    };
  }

  // The afternoon: what can shoot at the location once it clears.
  const arriveMin = hhmmToMinutes(f.clearsAt);
  const moveAt = minutesToHhmm(arriveMin - lostLoc.travelMinutes);
  const pmStart = arriveMin + 30;
  const pmEnd = hhmmToMinutes(light.sunset) + 30;
  const pmCapacity = Math.floor(((pmEnd - pmStart) / 60) * ASSUMED.assumed_eighths_per_hour);
  const findings: Finding[] = [];
  const pmScenes: Scene[] = [];
  const leftover: Scene[] = [];
  let pmUsed = 0;
  const afternoonOrder = [...lostScenes].sort((a, b) => (a.time === 'DUSK' ? 1 : 0) - (b.time === 'DUSK' ? 1 : 0));
  for (const sc of afternoonOrder) {
    if (sc.time === 'DAWN') {
      leftover.push(sc);
      continue;
    }
    if (f.waterUnsafe && sc.needs.includes('water_safety')) {
      leftover.push(sc);
      continue;
    }
    if (pmUsed + sc.eighths > pmCapacity) {
      leftover.push(sc);
      continue;
    }
    pmScenes.push(sc);
    pmUsed += sc.eighths;
  }
  if (f.waterUnsafe && lostScenes.some((s) => s.needs.includes('water_safety'))) {
    findings.push({
      code: 'SPLIT.WATER_UNSAFE',
      severity: 'review',
      title: 'Scenes in the water do not shoot tomorrow whatever the sky does',
      detail: `${lostLoc.id === 'FORD' ? 'The river is rising' : 'The sea state is rough'}, and it stays that way after the rain stops. Anyone in the water is the safety lead's call, and the engine defers to it. Only the scenes at the edge go on the afternoon.`,
      source: `${f.source} · breakdown · water`,
      costCents: null,
      dueDay: ctx.lostDay,
    });
  }

  if (pmScenes.length === 0) {
    findings.push({
      code: 'SPLIT.NOTHING_PM',
      severity: 'block',
      title: 'Nothing from the lost day can shoot in the afternoon',
      detail: 'Every scene is either at dawn, in the water, or too long for the window. A split day with nothing after the move is the cover-set option with a drive attached.',
      source: 'Breakdown · time_of_day · water',
      costCents: null,
      dueDay: ctx.lostDay,
    });
  }

  // The morning: as much of the cover day as fits before the unit has to leave.
  const amCall = '07:00';
  const leaveMin = arriveMin - lostLoc.travelMinutes;
  const amHours = (leaveMin - 30 - (hhmmToMinutes(amCall) + 30)) / 60;
  const amCapacity = Math.floor(amHours * ASSUMED.assumed_eighths_per_hour);
  const amScenes: string[] = [];
  const stays: string[] = [];
  let amUsed = 0;
  for (const n of chosen.scenes) {
    const sc = sceneByNumber(n);
    if (amUsed + sc.eighths <= amCapacity) {
      amScenes.push(n);
      amUsed += sc.eighths;
    } else {
      stays.push(n);
    }
  }
  const caveats = coverCaveats(chosen, ctx);
  findings.push(...caveats.findings);

  // The whole day: 07:00 to dusk-plus-thirty is long.
  const dayHours = (pmEnd - hhmmToMinutes(amCall)) / 60;
  const ot = round1(Math.max(0, dayHours - ASSUMED.assumed_base_hours));
  const costLines: { label: string; cents: number }[] = [...caveats.costLines, { label: 'Company move, mid-day', cents: ASSUMED.assumed_company_move_cents }];
  if (ot > 0) {
    costLines.push({ label: `Tomorrow runs ${ot} hrs over (move plus dusk)`, cents: overtimeCents(ot) });
    findings.push({
      code: 'OT.SPLIT_DAY',
      severity: ot > 2 ? 'review' : 'open',
      title: `Tomorrow runs ${ot} hrs over`,
      detail: `${clock(amCall)} call on stage, wrap out by ${clock(moveAt)}, ${lostLoc.travelMinutes} minutes' drive, ready at ${clock(minutesToHhmm(pmStart))}, dusk at ${clock(light.sunset)}. About ${ASSUMED.assumed_company_move_hours} hours of the day are the move, and nobody shoots during a move.`,
      source: 'assumed_company_move_hours · assumed_base_hours · daylight',
      costCents: overtimeCents(ot),
      dueDay: ctx.lostDay,
    });
  }
  findings.push({
    code: 'SPLIT.MOVE',
    severity: 'open',
    title: `Company move at ${clock(moveAt)}`,
    detail: `Two locations, two set-ups, one lunch somewhere in between. The move costs the day about ${ASSUMED.assumed_company_move_hours} hours and the office two shuttle runs.`,
    source: 'assumed_company_move_hours · assumed_company_move_cents',
    costCents: ASSUMED.assumed_company_move_cents,
    dueDay: ctx.lostDay,
  });

  // Whatever did not shoot in the afternoon is absorbed; whatever the cover
  // day keeps stays where it was.
  const absorbed = absorb(leftover, sameLocationDaysAfter(ctx.lostDay), ctx);
  const cancel = cancellationLines(leftover.filter((s) => !pmScenes.some((p) => p.number === s.number)));
  findings.push(...absorbed.findings, ...cancel.findings);
  costLines.push(...cancel.lines, ...absorbed.costLines);
  if (stays.length > 0) {
    findings.push({
      code: 'SPLIT.COVER_KEEPS',
      severity: 'open',
      title: `${dayLabel(chosen.day)} keeps ${stays.length} scene${stays.length === 1 ? '' : 's'}`,
      detail: `Scenes ${stays.join(', ')} did not fit before the move and stay on ${dayLabel(chosen.day)}, which becomes a short day. Pull something into it or hold it as cover.`,
      source: `Stripboard · ${dayLabel(chosen.day)}`,
      costCents: null,
      dueDay: chosen.day - 1,
    });
  }

  const pmCast = castIn(pmScenes.map((s) => s.number));
  const amCast = castIn(amScenes);
  const originalCast = castIn(lostScenes.map((s) => s.number));
  const tomorrowCast = [...new Set([...amCast, ...pmCast])];
  const released = originalCast.filter((n) => !tomorrowCast.includes(n));
  const added = tomorrowCast.filter((n) => !originalCast.includes(n));
  const notices: Notice[] = [
    ...standardNotices(lostScenes.filter((s) => !pmScenes.includes(s)), released, added),
    { who: 'Transportation captain', what: `Stage call, then a company move at ${clock(moveAt)} to ${lostLoc.name}. Two runs.`, by: NOTICE_TIMES.transport },
    { who: 'Location manager', what: `${lostLoc.name} in use from ${clock(f.clearsAt)}. Confirm access and the water safety lead's afternoon call.`, by: NOTICE_TIMES.locations },
    { who: 'Catering', what: `Lunch on stage before the move. Craft service at ${lostLoc.name}.`, by: NOTICE_TIMES.catering },
    { who: 'Everyone', what: 'Revised call sheet, second issue.', by: NOTICE_TIMES.sheet },
  ];

  const unpriced = [...caveats.unpriced];
  return {
    id: 'split',
    kind: 'split_day',
    title: 'Split the day: stage until it clears, then the location',
    summary: `${locationById(chosen.locationId).name} from ${clock(amCall)}, a move at ${clock(moveAt)}, and ${pmScenes.length} of ${lostScenes.length} lost scene${lostScenes.length === 1 ? '' : 's'} at ${lostLoc.name} once it clears.`,
    feasibility: feasibilityOf(findings, absorbed.unplaced),
    candidates,
    tomorrow: { locationId: chosen.locationId, scenes: amScenes, unitCall: amCall, plannedWrap: moveAt },
    split: { locationId: lostLoc.id, scenes: pmScenes.map((s) => s.number), moveAt },
    placements: absorbed.placements,
    unplaced: absorbed.unplaced,
    findings,
    costCents: unpriced.length > 0 ? null : sum(costLines),
    costLines,
    unpriced,
    notices,
    opensDay: stays.length === 0 ? chosen.day : null,
  };
}

/* ---------------------------------------------------------------------------
   Option: second unit takes the wides
   --------------------------------------------------------------------------- */

function secondUnitOption(ctx: ReslotContext, lostScenes: readonly Scene[]): ReslotOption {
  const candidates = coverCandidates(ctx);
  const chosen = bestCover(candidates);
  if (!chosen) return noCoverOption('second', 'second_unit', 'Second unit takes the wides', lostScenes, candidates, ctx);

  const eligible = lostScenes.filter((s) => s.secondUnit);
  const rest = lostScenes.filter((s) => !s.secondUnit);
  const findings: Finding[] = [];
  const costLines: { label: string; cents: number }[] = [];
  const placements: Placement[] = [];
  const unplaced: Unplaced[] = [];

  findings.push({
    code: 'SU.ASSUMED',
    severity: 'review',
    title: 'A second unit is assumed to exist',
    detail: `The engine assumes a second unit contracted from ${dayLabel(ASSUMED.assumed_second_unit_from_day)} to ${dayLabel(ASSUMED.assumed_second_unit_to_day)}, with its own camera and doubles for the principals. If there is no second unit, this option is the cover-set option plus a hire.`,
    source: 'assumed_second_unit_from_day · assumed_second_unit_to_day',
    costCents: null,
    dueDay: null,
  });

  if (eligible.length === 0) {
    findings.push({
      code: 'SU.NOTHING_ELIGIBLE',
      severity: 'block',
      title: 'Nothing on the lost day is second-unit work',
      detail: 'Every scene has a principal speaking to camera. A second unit shoots wides, action and inserts with doubles; it does not shoot faces.',
      source: 'Breakdown · second_unit',
      costCents: null,
      dueDay: ctx.lostDay,
    });
  }

  // Find the second unit's day: the earliest same-location day after the
  // lost one, inside the permit window and the unit's contract, that has room.
  const cap = ASSUMED.assumed_second_unit_capacity_eighths;
  const days = sameLocationDaysAfter(ctx.lostDay).filter((d) => d >= ASSUMED.assumed_second_unit_from_day && d <= ASSUMED.assumed_second_unit_to_day);
  let suDay: number | null = null;
  const taken: Scene[] = [];
  const spill: Scene[] = [];
  for (const d of days) {
    if (!locationOpenOn(shootDay(d).locationId, d).ok) continue;
    if (eligible.some((s) => s.time === 'DAWN') && dayState(d).hasDawn) continue;
    suDay = d;
    break;
  }
  if (suDay === null && eligible.length > 0) {
    findings.push({
      code: 'SU.NO_DAY',
      severity: 'review',
      title: 'No day for the second unit inside the permit window',
      detail: 'The second unit needs the location open and its contract running. Neither holds on any remaining day here.',
      source: 'Location agreement · assumed_second_unit_from_day',
      costCents: null,
      dueDay: ctx.lostDay,
    });
    spill.push(...eligible);
  } else if (suDay !== null) {
    let used = 0;
    for (const sc of [...eligible].sort((a, b) => b.eighths - a.eighths)) {
      if (used + sc.eighths <= cap) {
        taken.push(sc);
        used += sc.eighths;
      } else {
        spill.push(sc);
      }
    }
    const st = dayState(suDay);
    costLines.push({ label: `Second unit day, ${dayLabel(suDay)}`, cents: ASSUMED.assumed_second_unit_day_cost_cents });
    const principals = castIn(taken.map((s) => s.number)).filter((n) => castByNumber(n).contractTo - castByNumber(n).contractFrom >= 10);
    if (principals.length > 0) {
      costLines.push({ label: `${principals.length} double${principals.length === 1 ? '' : 's'} for the day`, cents: principals.length * ASSUMED.assumed_double_day_cents });
      findings.push({
        code: 'SU.DOUBLES',
        severity: 'open',
        title: `Doubles for ${principals.map((n) => `${n} ${castByNumber(n).character}`).join(', ')}`,
        detail: 'The second unit shoots the wides and the action. Any close-up of a principal in these scenes still needs the main unit, on another day, and that is a conversation with the director tonight.',
        source: 'Breakdown · second_unit · cast',
        costCents: principals.length * ASSUMED.assumed_double_day_cents,
        dueDay: suDay - 1,
      });
    }
    if (taken.some((s) => s.needs.includes('horses')) && !st.hasHorses) {
      costLines.push({ label: `Horse package added to ${dayLabel(suDay)}`, cents: ASSUMED.assumed_horse_package_day_cents });
    }
    if (taken.some((s) => s.needs.includes('water_safety')) && !st.hasWater) {
      costLines.push({ label: `Water safety team added to ${dayLabel(suDay)}`, cents: ASSUMED.assumed_water_safety_day_cents });
    }
    for (const sc of taken) {
      placements.push({ scene: sc.number, fromDay: ctx.lostDay, toDay: suDay, overtimeHours: 0, unit: 'second', reason: `Second unit, ${dayLabel(suDay)}, alongside the main unit. No overtime on the main unit.` });
    }
  }

  // Everything else the main unit absorbs.
  const absorbed = absorb([...rest, ...spill], sameLocationDaysAfter(ctx.lostDay), ctx);
  placements.push(...absorbed.placements);
  unplaced.push(...absorbed.unplaced);
  const caveats = coverCaveats(chosen, ctx);
  const cancel = cancellationLines(lostScenes);
  findings.push(...caveats.findings, ...absorbed.findings, ...cancel.findings);
  costLines.push(...caveats.costLines, ...cancel.lines, ...absorbed.costLines);
  findings.push({
    code: 'COVER.DAY_OPENS',
    severity: 'review',
    title: `${dayLabel(chosen.day)} opens`,
    detail: `Its scenes shoot tomorrow, so ${dayLabel(chosen.day)} has nothing on it. Hold it as a cover day, or pull ${dayLabel(chosen.day + 1)} forward.`,
    source: `Stripboard · ${dayLabel(chosen.day)}`,
    costCents: null,
    dueDay: chosen.day - 1,
  });

  const unpriced = [...caveats.unpriced];
  return {
    id: 'second',
    kind: 'second_unit',
    title: 'Cover set tomorrow; second unit takes the wides',
    summary: suDay !== null
      ? `Main unit on ${locationById(chosen.locationId).name}. Second unit shoots ${taken.map((s) => s.number).join(', ')} at ${locationById(shootDay(ctx.lostDay).locationId).name} on ${dayLabel(suDay)} with doubles. The rest is absorbed.`
      : 'Main unit on the cover set. No day for a second unit inside the window.',
    feasibility: feasibilityOf(findings, unplaced),
    candidates,
    tomorrow: { locationId: chosen.locationId, scenes: chosen.scenes, unitCall: '07:00', plannedWrap: '17:00' },
    split: null,
    placements,
    unplaced,
    findings,
    costCents: unpriced.length > 0 ? null : sum(costLines),
    costLines,
    unpriced,
    notices: [
      ...coverNotices(ctx, lostScenes, chosen.scenes, chosen.locationId),
      ...(suDay !== null ? [{ who: 'Second unit director', what: `${taken.map((s) => `Sc ${s.number}`).join(', ')} on ${dayLabel(suDay)}. Doubles and the head wrangler to be confirmed by tomorrow's wrap.`, by: NOTICE_TIMES.transport }] : []),
    ],
    opensDay: chosen.day,
  };
}

/* ---------------------------------------------------------------------------
   Option: cancel and absorb
   --------------------------------------------------------------------------- */

function cancelAbsorbOption(ctx: ReslotContext, lostScenes: readonly Scene[]): ReslotOption {
  const absorbed = absorb(lostScenes, sameLocationDaysAfter(ctx.lostDay), ctx);
  const cancel = cancellationLines(lostScenes);
  const canceledDay = Math.round(ASSUMED.assumed_unit_day_cost_cents * ASSUMED.assumed_canceled_day_pay_share);
  const findings: Finding[] = [
    {
      code: 'CANCEL.DAY_PAID',
      severity: 'review',
      title: 'The unit is paid for a day it does not shoot',
      detail: `Crew called inside 24 hours are paid whether or not they work. ${dayLabel(ctx.lostDay)} costs a full day and produces no pages.`,
      source: 'Crew agreement · assumed_canceled_day_pay_share',
      costCents: canceledDay,
      dueDay: ctx.lostDay,
    },
    ...absorbed.findings,
    ...cancel.findings,
  ];
  const costLines = [{ label: 'Canceled day, crew paid', cents: canceledDay }, ...cancel.lines, ...absorbed.costLines];
  const originalCast = castIn(lostScenes.map((s) => s.number));
  return {
    id: 'cancel',
    kind: 'cancel_absorb',
    title: 'Cancel the day and absorb the pages',
    summary: `No call. The ${lostScenes.length} scene${lostScenes.length === 1 ? '' : 's'} spread across the remaining permit days as overtime.`,
    feasibility: feasibilityOf(findings, absorbed.unplaced),
    tomorrow: null,
    split: null,
    placements: absorbed.placements,
    unplaced: absorbed.unplaced,
    findings,
    costCents: sum(costLines),
    costLines,
    unpriced: [],
    notices: [
      ...standardNotices(lostScenes, originalCast, []),
      { who: 'Everyone', what: 'No call tomorrow. Day canceled.', by: NOTICE_TIMES.sheet },
    ],
    opensDay: null,
  };
}

/* ---------------------------------------------------------------------------
   Option: the rest day
   --------------------------------------------------------------------------- */

function restDayOption(ctx: ReslotContext, lostScenes: readonly Scene[]): ReslotOption {
  const lost = shootDay(ctx.lostDay);
  const loc = locationById(lost.locationId);
  const saturday = SHOOT_DAYS.filter((d) => d.day >= ctx.lostDay && restDayAfter(d.day) !== null).map((d) => d.day)[0];
  const sunday = saturday !== undefined ? restDayAfter(saturday) : null;
  const findings: Finding[] = [];
  const costLines: { label: string; cents: number }[] = [];
  const unpriced: string[] = [];
  const onSunday: Scene[] = [];
  const elsewhere: Scene[] = [];

  if (!sunday || saturday === undefined) {
    findings.push({ code: 'REST.NONE', severity: 'block', title: 'No rest day inside the schedule', detail: '', source: 'Calendar', costCents: null, dueDay: null });
  } else if (!loc.sundaysAllowed) {
    findings.push({ code: 'REST.PERMIT', severity: 'block', title: `${loc.name} permit does not allow Sunday filming`, detail: 'The agreement says weekdays and Saturdays. A Sunday is a renegotiation with a landowner, tonight.', source: 'Location agreement · sundaysAllowed', costCents: null, dueDay: null });
  } else if (loc.permitTo !== null && saturday + 1 > loc.permitTo) {
    findings.push({ code: 'REST.PERMIT_CLOSED', severity: 'block', title: 'The permit closes before the rest day', detail: `The window ends on day ${loc.permitTo}; the Sunday falls after it.`, source: 'Location agreement · permitTo', costCents: null, dueDay: null });
  } else {
    for (const sc of lostScenes) {
      const blockers: string[] = [];
      for (const n of sc.cast) {
        const c = castByNumber(n);
        if (c.restDayClause) blockers.push(`${c.number} ${c.character} has no-seventh-day terms`);
        if (c.minor && !ASSUMED.assumed_minor_sundays) blockers.push(`${c.number} ${c.character} is a child; assumed no Sunday work`);
      }
      if (blockers.length > 0) {
        elsewhere.push(sc);
        findings.push({
          code: 'REST.CAST_CLAUSE',
          severity: 'review',
          title: `Sc ${sc.number} cannot shoot on Sunday: ${blockers.join('; ')}`,
          detail: 'It still has to shoot somewhere.',
          source: 'Cast contracts · restDayClause · assumed_minor_sundays',
          costCents: null,
          dueDay: null,
        });
      } else {
        onSunday.push(sc);
      }
    }

    const premium = Math.round(ASSUMED.assumed_unit_day_cost_cents * ASSUMED.assumed_seventh_day_multiplier);
    costLines.push({ label: `${longDate(sunday)} at seventh-day rate`, cents: premium });
    findings.push({
      code: 'REST.SEVENTH_DAY',
      severity: 'review',
      title: 'A seventh consecutive day, at double time',
      detail: 'Monday to Saturday plus Sunday. The engine assumes a paid canceled day counts as a worked day under the crew agreement; if it does not, this is a sixth day and the premium is smaller. The agreement decides, not the engine.',
      source: 'Crew agreement · assumed_seventh_day_multiplier',
      costCents: premium,
      dueDay: saturday,
    });
    if (loc.assumed_day_fee_cents !== null) {
      const uplift = Math.round(loc.assumed_day_fee_cents * loc.assumed_sunday_uplift);
      costLines.push({ label: `${loc.name} Sunday fee`, cents: uplift });
    }
    findings.push({
      code: 'REST.NEXT_WEEK',
      severity: 'review',
      title: `${dayLabel(saturday + 1)} follows seven worked days`,
      detail: 'Some agreements require a rest day after six. If this one does, the Monday moves, and that cost is not in this figure.',
      source: 'Crew agreement',
      costCents: null,
      dueDay: saturday + 1,
    });
    unpriced.push("Whether Monday survives a worked Sunday depends on the crew agreement's rest-day language, which the engine does not hold.");
  }

  const canceledDay = Math.round(ASSUMED.assumed_unit_day_cost_cents * ASSUMED.assumed_canceled_day_pay_share);
  costLines.unshift({ label: 'Canceled day, crew paid', cents: canceledDay });
  const cancel = cancellationLines(lostScenes);
  costLines.push(...cancel.lines);
  findings.push(...cancel.findings);

  const absorbed = absorb(elsewhere, sameLocationDaysAfter(ctx.lostDay), ctx);
  findings.push(...absorbed.findings);
  costLines.push(...absorbed.costLines);

  const placements: Placement[] = [
    // A rest day is not a production day. It sits between two of them, and
    // `saturday + 0.5` is how the schedule addresses it.
    ...onSunday.map((sc) => ({ scene: sc.number, fromDay: ctx.lostDay, toDay: saturday !== undefined ? saturday + 0.5 : ctx.lostDay, overtimeHours: 0, unit: 'main' as const, reason: 'Shoots on the rest day.' })),
    ...absorbed.placements,
  ];

  const originalCast = castIn(lostScenes.map((s) => s.number));
  return {
    id: 'rest',
    kind: 'rest_day',
    title: 'Cancel tomorrow and shoot on the rest day',
    summary: sunday && findings.every((f) => f.severity !== 'block')
      ? `${longDate(sunday)} at ${loc.name}. ${onSunday.length === lostScenes.length ? `All ${lostScenes.length} scenes can shoot on it.` : onSunday.length === 0 ? 'None of the scenes can shoot on it.' : `Only Sc ${onSunday.map((sc) => sc.number).join(', ')} can shoot on it; the rest are barred by a contract clause or by the child's hours.`}`
      : 'No usable rest day inside the permit window.',
    feasibility: feasibilityOf(findings, absorbed.unplaced) === 'infeasible' ? 'infeasible' : 'partial',
    tomorrow: null,
    split: null,
    placements,
    unplaced: absorbed.unplaced,
    findings,
    costCents: null,
    costLines,
    unpriced,
    notices: [
      ...standardNotices(lostScenes, originalCast, []),
      { who: 'Everyone', what: 'No call tomorrow. Day canceled. Sunday call to follow.', by: NOTICE_TIMES.sheet },
    ],
    opensDay: null,
  };
}

/* ---------------------------------------------------------------------------
   Option: day eighty
   --------------------------------------------------------------------------- */

function dayEightyOption(ctx: ReslotContext, lostScenes: readonly Scene[]): ReslotOption {
  const findings: Finding[] = [];
  const lost = shootDay(ctx.lostDay);
  const loc = locationById(lost.locationId);
  const lastDay = SHOOT_DAYS[SHOOT_DAYS.length - 1]!.day;
  const outOfContract = castIn(lostScenes.map((s) => s.number)).filter((n) => castByNumber(n).contractTo <= lastDay);

  findings.push({
    code: 'D80.NO_DAY',
    severity: 'block',
    title: `There is no ${dayLabel(lastDay + 1)}`,
    detail: `The schedule is ${lastDay} days. Cast contracts, crew deal memos, the stage lease and every location permit end on or before it. Adding a day is not a scheduling move; it is ${outOfContract.length} cast renegotiations and a few hundred crew ones.`,
    source: 'Cast contracts · crew deal memos · stage lease',
    costCents: null,
    dueDay: null,
  });
  findings.push({
    code: 'D80.PERMIT',
    severity: 'block',
    title: `${loc.name} permit ends on day ${loc.permitTo}`,
    detail: `These scenes are set at ${loc.name}. On ${dayLabel(lastDay + 1)} it is not the production's to shoot at any price the engine could name.`,
    source: 'Location agreement · permitTo',
    costCents: null,
    dueDay: null,
  });

  return {
    id: 'd80',
    kind: 'day_eighty',
    title: 'Add a day at the end',
    summary: `The instinctive answer. ${dayLabel(lastDay + 1)} does not exist, and the engine will not price one.`,
    feasibility: 'infeasible',
    tomorrow: null,
    split: null,
    placements: [],
    unplaced: lostScenes.map((s) => ({ scene: s.number, reason: `no ${dayLabel(lastDay + 1)}` })),
    findings,
    costCents: null,
    costLines: [],
    unpriced: [
      `Extending ${outOfContract.length} cast contract${outOfContract.length === 1 ? '' : 's'} past ${dayLabel(lastDay)} is a negotiation, not a rate.`,
      'Extending the crew is a few hundred conversations, some of which end in a no.',
    ],
    notices: [],
    opensDay: null,
  };
}

/**
 * The six things a producer can do tonight, priced, in order of price, with
 * the ones that cannot be priced at the end where they belong.
 */
export function planLostDay(ctx: ReslotContext = DEFAULT_RESLOT_CONTEXT): ReslotOption[] {
  const lostScenes = shootDay(ctx.lostDay).scenes.map(sceneByNumber);
  const options = [
    coverSetOption(ctx, lostScenes),
    splitDayOption(ctx, lostScenes),
    secondUnitOption(ctx, lostScenes),
    cancelAbsorbOption(ctx, lostScenes),
    restDayOption(ctx, lostScenes),
    dayEightyOption(ctx, lostScenes),
  ];
  const order: Record<Feasibility, number> = { feasible: 0, partial: 1, infeasible: 2 };
  return options.sort((a, b) => {
    const fa = order[a.feasibility];
    const fb = order[b.feasibility];
    if (fa !== fb) return fa - fb;
    const ca = a.costCents ?? Number.POSITIVE_INFINITY;
    const cb = b.costCents ?? Number.POSITIVE_INFINITY;
    if (ca !== cb) return ca - cb;
    return sum(a.costLines) - sum(b.costLines);
  });
}

/** The lowest priced sum an option can show, even when the total is unpriceable. */
export function pricedSoFar(o: ReslotOption): number {
  return sum(o.costLines);
}

export function optionSeverity(o: ReslotOption) {
  return worstSeverity(o.findings);
}
