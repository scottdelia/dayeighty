import type { CrewMember, GateKey, Residency, SoftKey } from './types';
import { CAST } from './cast';
import { DEFAULT_SEED, chance, mulberry32, pick, surrogateId } from './rng';

/* ===========================================================================
   THE CREW

   EVERY CREW RECORD IN THIS DEMO IS FABRICATED HERE, at runtime, from a fixed
   seed. There is no name, email, phone, passport, nationality or bank field in
   the record type, so there is none in the output. Nobody who has ever worked
   on any production is represented, and nobody needed to be: the engine
   decides who can be on set from gates and dates, not from who someone is.

   The department structure is the ordinary shape of a period drama unit of
   this size. The counts are round numbers chosen to sum to three hundred
   six. The gate states are random within stated probabilities, with a handful
   of specific cases pinned so the demo always has something to say.
   =========================================================================== */

interface DepartmentSpec {
  name: string;
  count: number;
  head: string | null;
  key: string | null;
  roles: readonly string[];
  /** First set day for the department's core. Individuals vary around it. */
  startsOnDay: number;
  /** Share of the department that flew in rather than being hired locally. */
  travelingShare: number;
  /** Role-specific hard gates that apply to everyone in the department except the head and key. */
  extraGates: readonly GateKey[];
}

export const DEPARTMENTS: readonly DepartmentSpec[] = [
  { name: 'Production office', count: 12, head: 'Unit production manager', key: 'Production coordinator', roles: ['Assistant production coordinator', 'Production secretary', 'Office PA', 'Travel coordinator'], startsOnDay: -21, travelingShare: 0.5, extraGates: [] },
  { name: 'Assistant directors', count: 8, head: 'First assistant director', key: 'Second assistant director', roles: ['Second second assistant director', 'Key set PA', 'Set PA'], startsOnDay: -14, travelingShare: 0.6, extraGates: [] },
  { name: 'Accounting', count: 6, head: 'Production accountant', key: 'First assistant accountant', roles: ['Payroll accountant', 'Accounting clerk', 'Cashier'], startsOnDay: -21, travelingShare: 0.3, extraGates: [] },
  { name: 'Locations', count: 10, head: 'Location manager', key: 'Key assistant location manager', roles: ['Assistant location manager', 'Location assistant', 'Location PA'], startsOnDay: -21, travelingShare: 0.2, extraGates: [] },
  { name: 'Construction', count: 32, head: 'Construction coordinator', key: 'Construction foreman', roles: ['Carpenter', 'Scenic painter', 'Rigger', 'Plasterer', 'Laborer'], startsOnDay: -21, travelingShare: 0.1, extraGates: [] },
  { name: 'Art department', count: 16, head: 'Production designer', key: 'Supervising art director', roles: ['Art director', 'Set designer', 'Draftsperson', 'Art department assistant', 'Graphic designer'], startsOnDay: -21, travelingShare: 0.4, extraGates: [] },
  { name: 'Set decoration', count: 14, head: 'Set decorator', key: 'Leadman', roles: ['Set dresser', 'Buyer', 'Draper'], startsOnDay: -14, travelingShare: 0.3, extraGates: [] },
  { name: 'Props', count: 12, head: 'Property master', key: 'On-set props', roles: ['Prop maker', 'Props assistant', 'Props buyer'], startsOnDay: -10, travelingShare: 0.3, extraGates: [] },
  { name: 'Costume', count: 22, head: 'Costume designer', key: 'Costume supervisor', roles: ['Costume assistant', 'Cutter', 'Ager/dyer', 'Background costumer', 'Set costumer'], startsOnDay: -14, travelingShare: 0.4, extraGates: [] },
  { name: 'Hair & makeup', count: 14, head: 'Makeup department head', key: 'Key makeup artist', roles: ['Makeup artist', 'Hair stylist', 'Background makeup', 'Prosthetics artist'], startsOnDay: -7, travelingShare: 0.5, extraGates: [] },
  { name: 'Camera', count: 18, head: 'Director of photography', key: 'First assistant camera', roles: ['Camera operator', 'Second assistant camera', 'Loader', 'DIT', 'Video assist', 'Steadicam operator'], startsOnDay: -3, travelingShare: 0.7, extraGates: [] },
  { name: 'Grip', count: 16, head: 'Key grip', key: 'Best boy grip', roles: ['Dolly grip', 'Grip', 'Crane technician'], startsOnDay: -3, travelingShare: 0.3, extraGates: [] },
  { name: 'Electric', count: 20, head: 'Gaffer', key: 'Best boy electric', roles: ['Electrician', 'Generator operator', 'Rigging electrician', 'Board operator'], startsOnDay: -3, travelingShare: 0.3, extraGates: [] },
  { name: 'Sound', count: 5, head: 'Production sound mixer', key: 'Boom operator', roles: ['Sound assistant', 'Playback operator'], startsOnDay: -1, travelingShare: 0.6, extraGates: [] },
  { name: 'Stunts', count: 14, head: 'Stunt coordinator', key: 'Assistant stunt coordinator', roles: ['Stunt performer', 'Stunt rigger', 'Riding double'], startsOnDay: -5, travelingShare: 0.6, extraGates: ['stunt_risk_assessment'] },
  { name: 'Special effects', count: 8, head: 'SFX supervisor', key: 'Senior SFX technician', roles: ['SFX technician', 'Pyrotechnician'], startsOnDay: -7, travelingShare: 0.5, extraGates: [] },
  { name: 'VFX on set', count: 3, head: 'VFX supervisor', key: 'VFX data wrangler', roles: ['VFX coordinator'], startsOnDay: -1, travelingShare: 0.7, extraGates: [] },
  { name: 'Transportation', count: 20, head: 'Transportation coordinator', key: 'Transportation captain', roles: ['Unit driver', 'Van driver', 'Truck driver', 'Cast driver'], startsOnDay: -7, travelingShare: 0.1, extraGates: ['license_check'] },
  { name: 'Catering', count: 10, head: 'Catering manager', key: 'Head chef', roles: ['Chef', 'Catering assistant', 'Craft service'], startsOnDay: -2, travelingShare: 0.1, extraGates: [] },
  { name: 'Medical & safety', count: 4, head: 'Safety officer', key: 'Set medic', roles: ['Second medic', 'Fire safety officer'], startsOnDay: -1, travelingShare: 0.5, extraGates: [] },
  { name: 'Armory', count: 4, head: 'Armorer', key: 'Assistant armorer', roles: ['Armory assistant'], startsOnDay: -9, travelingShare: 0.5, extraGates: ['weapons_license'] },
  { name: 'Animals', count: 6, head: 'Head wrangler', key: 'Wrangler', roles: ['Wrangler', 'Groom'], startsOnDay: -2, travelingShare: 0.3, extraGates: ['animal_handler_cert'] },
  { name: 'Background', count: 4, head: 'Background coordinator', key: 'Background PA', roles: ['Background PA'], startsOnDay: -7, travelingShare: 0.2, extraGates: [] },
  { name: 'Post & dailies', count: 4, head: 'Post-production supervisor', key: 'Dailies colorist', roles: ['Data manager', 'Dailies operator'], startsOnDay: -1, travelingShare: 0.5, extraGates: [] },
];

export const CAST_DEPARTMENT = 'Cast';

/** How many people the specs above produce, cast included. */
export const CREW_COUNT = DEPARTMENTS.reduce((n, d) => n + d.count, 0) + CAST.length;

/**
 * Probability a gate is already closed, by whether the person has started.
 *
 * People who are already working have mostly been processed; people arriving
 * next week mostly have not. Third-party gates lag everything else, because
 * nobody in the office can hurry a consulate.
 */
const P_CLOSED: Record<GateKey, { started: number; notStarted: number }> = {
  deal_memo: { started: 0.99, notStarted: 0.84 },
  nda: { started: 0.99, notStarted: 0.8 },
  right_to_work: { started: 0.985, notStarted: 0.7 },
  local_tax_form: { started: 0.98, notStarted: 0.74 },
  safety_induction: { started: 0.995, notStarted: 0.25 },
  stunt_risk_assessment: { started: 0.9, notStarted: 0.5 },
  license_check: { started: 0.95, notStarted: 0.66 },
  weapons_license: { started: 0.9, notStarted: 0.6 },
  minor_permit: { started: 0.8, notStarted: 0.45 },
  studio_teacher: { started: 0.9, notStarted: 0.6 },
  animal_handler_cert: { started: 0.92, notStarted: 0.7 },
};

const P_SOFT: Record<SoftKey, number> = {
  contact_verified: 0.92,
  accommodation: 0.86,
  travel: 0.9,
  radio: 0.7,
  gear: 0.78,
};

export interface GenerateCrewOptions {
  seed?: number;
  /** The moment the gate states are a snapshot of. */
  asOfDay: number;
}

function gatesFor(residency: Residency, extra: readonly GateKey[], minor: boolean): GateKey[] {
  const g: GateKey[] = ['deal_memo', 'nda', 'safety_induction'];
  g.push(residency === 'traveling' ? 'right_to_work' : 'local_tax_form');
  g.push(...extra);
  if (minor) g.push('minor_permit', 'studio_teacher');
  return g;
}

export function generateCrew(opts: GenerateCrewOptions): CrewMember[] {
  const rng = mulberry32(opts.seed ?? DEFAULT_SEED);
  const crew: CrewMember[] = [];

  const make = (
    department: string,
    role: string,
    flags: { isHead: boolean; isKey: boolean; minor: boolean },
    startsOnDay: number,
    residency: Residency,
    extra: readonly GateKey[],
  ): CrewMember => {
    const started = startsOnDay <= opts.asOfDay;
    const gates: Partial<Record<GateKey, boolean>> = {};
    for (const key of gatesFor(residency, extra, flags.minor)) {
      const p = P_CLOSED[key];
      gates[key] = chance(rng, started ? p.started : p.notStarted);
    }
    const soft: Partial<Record<SoftKey, boolean>> = {
      contact_verified: chance(rng, P_SOFT.contact_verified),
      radio: chance(rng, P_SOFT.radio),
      gear: chance(rng, P_SOFT.gear),
    };
    if (residency === 'traveling') {
      soft.accommodation = chance(rng, P_SOFT.accommodation);
      soft.travel = chance(rng, P_SOFT.travel);
    }
    return {
      id: surrogateId(rng, 'CR'),
      department,
      role,
      isHead: flags.isHead,
      isKey: flags.isKey,
      residency,
      startsOnDay,
      gates,
      soft,
      minor: flags.minor,
    };
  };

  for (const d of DEPARTMENTS) {
    for (let i = 0; i < d.count; i += 1) {
      const isHead = i === 0 && d.head !== null;
      const isKey = i === 1 && d.key !== null;
      const role = isHead ? d.head! : isKey ? d.key! : pick(rng, d.roles);
      const residency: Residency = isHead
        ? chance(rng, 0.7) ? 'traveling' : 'local'
        : chance(rng, d.travelingShare) ? 'traveling' : 'local';
      // Heads and keys start with the department; the rest arrive in a wave
      // around it, some a few days later.
      const jitter = isHead || isKey ? 0 : Math.floor(rng() * 4);
      const startsOnDay = clampDay(d.startsOnDay + jitter);
      crew.push(make(d.name, role, { isHead, isKey, minor: false }, startsOnDay, residency, isHead || isKey ? [] : d.extraGates));
    }
  }

  for (const c of CAST) {
    const residency: Residency = chance(rng, 0.8) ? 'traveling' : 'local';
    const role = c.minor ? 'Principal cast (minor)' : c.contractTo - c.contractFrom < 10 ? 'Day player' : 'Principal cast';
    crew.push(make(CAST_DEPARTMENT, role, { isHead: false, isKey: false, minor: c.minor }, c.contractFrom, residency, []));
  }

  pinCases(crew);
  return crew;
}

/** Day 0 does not exist. A jittered start that lands on it moves to Day 1. */
function clampDay(d: number): number {
  return d === 0 ? 1 : d;
}

/*
  Pinned cases. Random gate states make a plausible board; these make a
  legible one. Each is the kind of thing that actually happens, and each is
  reproduced exactly on every run.
*/
function pinCases(crew: CrewMember[]): void {
  const find = (department: string, pred: (m: CrewMember) => boolean): CrewMember | undefined =>
    crew.find((m) => m.department === department && pred(m));

  // The armorer has been on the clock for two days without a verified license.
  const armorer = find('Armory', (m) => m.isHead);
  if (armorer) {
    for (const k of Object.keys(armorer.gates) as GateKey[]) armorer.gates[k] = true;
    armorer.gates.weapons_license = false;
  }

  // The three leads are cleared. A board on which the lead cannot work on
  // Day 1 is a board nobody believes, and it is also the one case that would
  // have been fixed before anyone built a board.
  const leads = crew.filter((m) => m.department === CAST_DEPARTMENT && m.startsOnDay === 1).slice(0, 3);
  for (const m of leads) for (const k of Object.keys(m.gates) as GateKey[]) m.gates[k] = true;

  // The head wrangler's certificate has not come back. Horses on day 7.
  const wrangler = find('Animals', (m) => m.isHead);
  if (wrangler) {
    wrangler.gates.animal_handler_cert = false;
    wrangler.gates.deal_memo = true;
    wrangler.gates.nda = true;
    wrangler.gates.safety_induction = true;
  }

  // The child's permit: fourteen days from an authority, and he is needed on day 12.
  const minor = find(CAST_DEPARTMENT, (m) => m.minor);
  if (minor) {
    minor.gates.minor_permit = false;
    minor.gates.studio_teacher = true;
    minor.gates.deal_memo = true;
    minor.gates.nda = true;
  }

  // A traveling camera operator whose paperwork is in a queue nobody controls.
  const op = find('Camera', (m) => !m.isHead && !m.isKey && m.residency === 'traveling');
  if (op) {
    op.gates.right_to_work = false;
    op.gates.deal_memo = true;
    op.gates.nda = true;
  }

  // The director of photography is cleared. A board on which the DP is blocked
  // is a board nobody believes.
  const dp = find('Camera', (m) => m.isHead);
  if (dp) for (const k of Object.keys(dp.gates) as GateKey[]) dp.gates[k] = true;
  const firstAd = find('Assistant directors', (m) => m.isHead);
  if (firstAd) for (const k of Object.keys(firstAd.gates) as GateKey[]) firstAd.gates[k] = true;
}
