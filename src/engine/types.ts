/* ===========================================================================
   DOMAIN MODEL

   Three disciplines are enforced by the type system rather than by good
   intentions:

   1. MONEY IS INTEGER CENTS. Never a float. `formatUsd` is the only place cents
      become a string.

   2. `null` MEANS UNKNOWN. It never means zero. Every cost field is
      `number | null`, so arithmetic on an unknown has to be handled explicitly
      at every call site. An engine that quietly treats "we cannot price this"
      as "$0" produces a confident wrong answer, which looks exactly like an
      answer.

   3. MINIMUM NECESSARY AS A SCHEMA. There is no name, email, phone, passport,
      nationality, address or bank field anywhere in this file. The engines do
      not need them to decide who can be on set, so they never receive them.
      A crew record here is a set of gates and a start day. The join to a human
      being lives in the payroll vendor, behind its own access control, and
      this system never holds it.
   =========================================================================== */

/*
  Severity is tiered by the operational response required, not by how alarming
  the word sounds.

    block   this cannot happen as scheduled, and the schedule does not wait
    review  a human has to make a call before the deadline
    open    closeable inside the production, in time, if someone does it
    clear   as planned
*/
export type Severity = 'block' | 'review' | 'open' | 'clear';

export const SEVERITY_ORDER: Record<Severity, number> = {
  block: 0,
  review: 1,
  open: 2,
  clear: 3,
};

export function worstSeverity(items: readonly { severity: Severity }[]): Severity {
  let s: Severity = 'clear';
  for (const it of items) if (SEVERITY_ORDER[it.severity] < SEVERITY_ORDER[s]) s = it.severity;
  return s;
}

/** One thing the engine found, with where it is observable from. */
export interface Finding {
  code: string;
  severity: Severity;
  title: string;
  detail: string;
  /** Where this is observable from. Every finding cites something. */
  source: string;
  /** Cents at stake, or null where the engine declines to price. Never 0-as-unknown. */
  costCents: number | null;
  /** Production day this has to be resolved by, or null if it is not date-bound. */
  dueDay: number | null;
}

/* ---------------------------------------------------------------------------
   CREW-UP
   --------------------------------------------------------------------------- */

export type Residency = 'local' | 'traveling';

/**
 * A gate is a thing that has to be true before a person can be on set.
 *
 * Hard gates block. Soft items (a radio, a hotel room) are tracked but never
 * block, because a person without a radio can still legally and insurably
 * work, and a board that colors both the same has spent its alarm badly.
 */
export type GateKey =
  | 'deal_memo'
  | 'nda'
  | 'right_to_work'
  | 'local_tax_form'
  | 'safety_induction'
  | 'stunt_risk_assessment'
  | 'license_check'
  | 'weapons_license'
  | 'minor_permit'
  | 'studio_teacher'
  | 'animal_handler_cert';

export type SoftKey = 'contact_verified' | 'accommodation' | 'travel' | 'radio' | 'gear';

export interface GateSpec {
  key: GateKey;
  label: string;
  /** Who has to act. A third party cannot be hurried by anyone in the office. */
  owner: 'production' | 'third_party';
  /** Calendar days from "someone starts this" to "it is done". Assumed. */
  assumed_lead_days: number;
  note: string;
}

export interface CrewMember {
  /** Surrogate. Encodes nothing. Not any vendor's identifier format. */
  id: string;
  department: string;
  role: string;
  isHead: boolean;
  isKey: boolean;
  residency: Residency;
  /** First day this person is needed on set. Negative for prep. There is no day 0. */
  startsOnDay: number;
  /** Only the gates that apply to this person are present. true = closed. */
  gates: Partial<Record<GateKey, boolean>>;
  soft: Partial<Record<SoftKey, boolean>>;
  minor: boolean;
}

/**
 * Every field name a crew record has, as literal strings.
 *
 * This exists for the model boundary and its regression test: an outbound
 * payload is scanned for these keys, and the `satisfies` clause fails the
 * build if a field is added to `CrewMember` and not added here.
 */
export const CREW_FIELD_NAMES = [
  'id',
  'department',
  'role',
  'isHead',
  'isKey',
  'residency',
  'startsOnDay',
  'gates',
  'soft',
  'minor',
] as const satisfies readonly (keyof CrewMember)[];

type _AllCrewFieldsListed = Exclude<keyof CrewMember, (typeof CREW_FIELD_NAMES)[number]> extends never
  ? true
  : ['MISSING FROM CREW_FIELD_NAMES', Exclude<keyof CrewMember, (typeof CREW_FIELD_NAMES)[number]>];
export const _allCrewFieldsListed: _AllCrewFieldsListed = true;

export type CrewVerdict =
  /** An open hard gate cannot close before this person's first set day. */
  | 'BLOCKED'
  /** An open hard gate is in a third party's hands. Time exists; control does not. */
  | 'EXPOSED'
  /** An open hard gate the production can close itself, in time. */
  | 'OPEN'
  /** Every hard gate closed. */
  | 'CLEARED';

export const CREW_VERDICT_SEVERITY: Record<CrewVerdict, Severity> = {
  BLOCKED: 'block',
  EXPOSED: 'review',
  OPEN: 'open',
  CLEARED: 'clear',
};

export interface CrewAdjudication {
  crewId: string;
  verdict: CrewVerdict;
  severity: Severity;
  /** Calendar days from the evaluation moment to the first set day. <= 0 means already working. */
  daysUntilStart: number;
  alreadyWorking: boolean;
  findings: Finding[];
  /** Open hard gates, in the order they should be chased. */
  openGates: GateKey[];
  /** Open soft items. Tracked, never blocking. */
  softOpen: SoftKey[];
}

export interface DepartmentSummary {
  department: string;
  headcount: number;
  neededByHorizon: number;
  tally: Record<CrewVerdict, number>;
  headVerdict: CrewVerdict | null;
  keyCleared: boolean | null;
  topBlocker: { gate: GateKey; count: number } | null;
  findings: Finding[];
  severity: Severity;
}

/* ---------------------------------------------------------------------------
   SCRIPT, CAST, SCHEDULE
   --------------------------------------------------------------------------- */

export type IntExt = 'INT' | 'EXT';
export type TimeOfDay = 'DAWN' | 'DAY' | 'DUSK' | 'NIGHT';

/** Things a scene needs that are booked, built or rigged ahead of the day. */
export type SceneNeed =
  | 'horses'
  | 'horse_falls'
  | 'water_safety'
  | 'sfx_fire'
  | 'sfx_rain'
  | 'feast_dressing'
  | 'crane'
  | 'armory';

export interface Scene {
  /** Script scene number, as printed. A string because "61A" exists. */
  number: string;
  episode: number;
  intExt: IntExt;
  set: string;
  time: TimeOfDay;
  /** Page count in eighths. Never a float. */
  eighths: number;
  /** Cast numbers, as on the breakdown sheet. */
  cast: number[];
  locationId: string;
  extras: number;
  needs: SceneNeed[];
  /** Working days of art/SFX preparation required before the scene can shoot. */
  prepDays: number;
  weatherDependent: boolean;
  /** Shootable by a second unit with doubles: wides, action, inserts. No principal close-ups. */
  secondUnit: boolean;
}

/**
 * A principal cast contract, reduced to what the scheduler needs.
 *
 * `assumed_day_rate_cents` is the one genuinely sensitive figure in this
 * system, and it exists so the boundary test has something real to refuse:
 * a cast record must never cross to a model, and the test proves it.
 */
export interface CastMember {
  number: number;
  character: string;
  contractFrom: number;
  contractTo: number;
  /** Production days on which this actor is contractually elsewhere. */
  unavailableDays: number[];
  minor: boolean;
  /** No seventh consecutive days, by contract. */
  restDayClause: boolean;
  assumed_day_rate_cents: number | null;
  /** ISO date a series option lapses if not exercised, or null. */
  optionExpires: string | null;
}

export const CAST_FIELD_NAMES = [
  'number',
  'character',
  'contractFrom',
  'contractTo',
  'unavailableDays',
  'minor',
  'restDayClause',
  'assumed_day_rate_cents',
  'optionExpires',
] as const satisfies readonly (keyof CastMember)[];

type _AllCastFieldsListed = Exclude<keyof CastMember, (typeof CAST_FIELD_NAMES)[number]> extends never
  ? true
  : ['MISSING FROM CAST_FIELD_NAMES', Exclude<keyof CastMember, (typeof CAST_FIELD_NAMES)[number]>];
export const _allCastFieldsListed: _AllCastFieldsListed = true;

export interface Location {
  id: string;
  name: string;
  kind: 'stage' | 'practical';
  exterior: boolean;
  /** Inclusive production-day window the permit or lease covers. null = standing. */
  permitFrom: number | null;
  permitTo: number | null;
  sundaysAllowed: boolean;
  /** Multiplier on the day fee for a Sunday, where allowed. */
  assumed_sunday_uplift: number;
  /** Stage sets: first day the build is ready to shoot. */
  readyOnDay: number | null;
  travelMinutes: number;
  assumed_day_fee_cents: number | null;
  /** Deposit held against restoration, or null where none / unknown. */
  depositCents: number | null;
}

export interface ShootDay {
  day: number;
  locationId: string;
  scenes: string[];
  /** HH:MM, 24h. */
  unitCall: string;
  plannedWrap: string;
}

/* ---------------------------------------------------------------------------
   BREAKDOWN — what the reader reads out of a scene page
   --------------------------------------------------------------------------- */

/** Character offsets into a scene's text. Half-open: [start, end). */
export interface Span {
  start: number;
  end: number;
}

/**
 * One structured fact read out of a scene page.
 *
 * `span: null` is not a missing value. It marks a fact inferred from what the
 * page does NOT say: a scene with riders and fog is weather-dependent whether
 * or not the writer typed the word "weather". Those are the facts a reader is
 * least likely to check, so they render differently and carry lower confidence.
 */
export interface BreakdownFact {
  key: string;
  value: string;
  /** 0..1, honestly calibrated. */
  conf: number;
  span: Span | null;
  note?: string;
}

export interface SceneBreakdown {
  sceneNumber: string;
  /** The page text, verbatim. The only string that crosses to a model. */
  text: string;
  facts: BreakdownFact[];
}

/* ---------------------------------------------------------------------------
   THE LOST DAY
   --------------------------------------------------------------------------- */

export interface Forecast {
  forDay: number;
  issuedAt: string;
  summary: string;
  /** Inches, forecast total. */
  rainIn: number;
  windMph: number;
  /** Days ahead the feed is willing to commit to. Beyond this, nothing is known. */
  horizonDays: number;
  /** HH:MM the rain is forecast to clear, or null for an all-day washout. */
  clearsAt: string | null;
  /** Whether moving water is unsafe regardless of rain: a rising river stays risen. */
  waterUnsafe: boolean;
  source: string;
}

export type OptionKind = 'cover_set' | 'split_day' | 'second_unit' | 'cancel_absorb' | 'rest_day' | 'day_eighty';

export type Feasibility = 'feasible' | 'partial' | 'infeasible';

export interface Placement {
  scene: string;
  fromDay: number;
  toDay: number;
  overtimeHours: number;
  reason: string;
  /** Which unit shoots it. Main unless a second unit takes it. */
  unit: 'main' | 'second';
}

export interface Unplaced {
  scene: string;
  reason: string;
}

export interface Notice {
  who: string;
  what: string;
  /** HH:MM by which it has to go out tonight. */
  by: string;
}

/** One future stage day considered as tomorrow's cover, and why it was or was not chosen. */
export interface CoverCandidate {
  day: number;
  locationId: string;
  scenes: string[];
  eighths: number;
  feasibility: Feasibility;
  reasons: string[];
}

export interface ReslotOption {
  id: string;
  kind: OptionKind;
  /** Cover-set options only: every stage day considered, in schedule order. */
  candidates?: CoverCandidate[];
  title: string;
  summary: string;
  feasibility: Feasibility;
  /** What shoots tomorrow under this option. Empty = no call. */
  tomorrow: { locationId: string; scenes: string[]; unitCall: string; plannedWrap: string } | null;
  /** Split day only: a company move after the weather clears, and what shoots after it. */
  split: { locationId: string; scenes: string[]; moveAt: string } | null;
  placements: Placement[];
  unplaced: Unplaced[];
  findings: Finding[];
  /** Total priced cost, or null if any component is unpriceable. */
  costCents: number | null;
  /** Priced components, for the receipt. */
  costLines: { label: string; cents: number }[];
  /** Components the engine refuses to price, and why. */
  unpriced: string[];
  notices: Notice[];
  /** A day this option leaves empty, if any. */
  opensDay: number | null;
}

export type Revision = 'ISSUED' | 'REVISED';

export interface CallSheetScene {
  number: string;
  slug: string;
  time: TimeOfDay;
  eighths: number;
  cast: number[];
  intExt: IntExt;
}

export interface CallSheetCast {
  number: number;
  character: string;
  pickup: string;
  makeup: string;
  onSet: string;
  status: 'W' | 'SW' | 'WF';
  minor: boolean;
  /** Beside the name: where the actor goes after the first block of a split day. */
  remark?: string;
}

export interface CallSheet {
  day: number;
  revision: Revision;
  canceled: boolean;
  unitCall: string;
  plannedWrap: string;
  locationId: string;
  weatherLine: string;
  sunrise: string;
  sunset: string;
  scenes: CallSheetScene[];
  cast: CallSheetCast[];
  totalEighths: number;
  headcount: { crew: number; extras: number; horses: number };
  notes: string[];
  advance: { day: number; locationId: string; scenes: string[]; flags: string[] } | null;
  /** A mid-day company move, and what shoots after it. */
  move: { at: string; locationId: string; scenes: CallSheetScene[]; cast: CallSheetCast[] } | null;
}

export interface CallSheetDiff {
  scenesAdded: string[];
  scenesRemoved: string[];
  castAdded: number[];
  castReleased: number[];
  bookingsCanceled: string[];
  catering: { from: number; to: number };
  transport: string;
}

/* ---------------------------------------------------------------------------
   WRAP
   --------------------------------------------------------------------------- */

export type WrapCategory = 'rentals' | 'locations' | 'people' | 'media' | 'cast' | 'money';

export interface WrapFinding extends Finding {
  category: WrapCategory;
  /** Cents per calendar day that accrue if nobody acts, or null. */
  perDayCents: number | null;
}

export interface WrapReport {
  asOfDay: number;
  findings: WrapFinding[];
  exposurePerDayCents: number;
  /** Items the engine refuses to compute, and why. */
  cannotCompute: { what: string; why: string }[];
  byCategory: Record<WrapCategory, WrapFinding[]>;
  deadlines: { day: number; items: WrapFinding[] }[];
}

/* ---------------------------------------------------------------------------
   FORMATTING
   --------------------------------------------------------------------------- */

/** The only place integer cents become a human string. */
export function formatUsd(cents: number | null, opts: { compact?: boolean } = {}): string {
  if (cents === null) return '—';
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  if (opts.compact && abs >= 100_000) {
    const dollars = abs / 100;
    if (dollars >= 1_000_000) return `${sign}$${(dollars / 1_000_000).toFixed(2)}m`;
    return `${sign}$${Math.round(dollars / 1000)}k`;
  }
  return `${sign}$${Math.floor(abs / 100).toLocaleString('en-US')}.${String(abs % 100).padStart(2, '0')}`;
}

/** Eighths of a page, printed the way a breakdown sheet prints them. */
export function formatEighths(e: number): string {
  const whole = Math.floor(e / 8);
  const rem = e % 8;
  if (whole === 0) return `${rem}/8`;
  if (rem === 0) return `${whole}`;
  return `${whole} ${rem}/8`;
}
