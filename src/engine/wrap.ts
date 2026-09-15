import type { WrapCategory, WrapFinding, WrapReport } from './types';
import { CAST } from './cast';
import { LOCATIONS } from './locations';
import { ASSUMED, PRODUCTION, calendarDaysBetween, dayLabel, dayToDate, shortDate } from './production';
import { DEFAULT_SEED, mulberry32 } from './rng';
import { CREW_COUNT } from './crew';

/* ===========================================================================
   WRAP — WHAT DAY EIGHTY OWES

   On the last day everyone disappears, never to stand in one place again.
   The production does not disappear with them. It owes rental houses their
   gear, locations their restoration, three hundred people their final pay,
   an insurer its paperwork and a bond company its footage, on dates, with
   fees. Every one of those dates is derivable from data the production
   already holds. Nobody has time to derive them during the shoot, which is
   why this file does it on day 79 from the same records the other views use.

   The counts below are invented from the fixed seed. The rules are not.
   =========================================================================== */

interface Rental {
  id: string;
  vendor: string;
  category: string;
  itemsOut: number;
  returnByDay: number;
  /** Per day late, whole order. null where the exposure is not a fee. */
  assumed_late_fee_cents_per_day: number | null;
  licensed: boolean;
}

const RENTALS: readonly Rental[] = [
  { id: 'R1', vendor: 'Camera rental house', category: 'Camera package', itemsOut: 212, returnByDay: 81, assumed_late_fee_cents_per_day: 240_000, licensed: false },
  { id: 'R2', vendor: 'Lighting supplier', category: 'Lighting and generators', itemsOut: 1140, returnByDay: 82, assumed_late_fee_cents_per_day: 310_000, licensed: false },
  { id: 'R3', vendor: 'Grip supplier', category: 'Grip trucks and crane', itemsOut: 38, returnByDay: 82, assumed_late_fee_cents_per_day: 190_000, licensed: false },
  { id: 'R4', vendor: 'Radio rental', category: 'Radios', itemsOut: 260, returnByDay: 80, assumed_late_fee_cents_per_day: 208_000, licensed: false },
  { id: 'R5', vendor: 'Costume house', category: 'Period costume rentals', itemsOut: 480, returnByDay: 84, assumed_late_fee_cents_per_day: 65_000, licensed: false },
  { id: 'R6', vendor: 'Licensed armorer', category: 'Weapons', itemsOut: 96, returnByDay: 80, assumed_late_fee_cents_per_day: null, licensed: true },
  { id: 'R7', vendor: 'Vehicle rental', category: 'Unit vehicles', itemsOut: 24, returnByDay: 81, assumed_late_fee_cents_per_day: 336_000, licensed: false },
];

export interface WrapContext {
  asOfDay: number;
  seed?: number;
}

export const DEFAULT_WRAP_CONTEXT: WrapContext = { asOfDay: 79 };

/** Calendar days after the last shoot day. Day 80 is the day after day 79. */
function wrapDayDate(day: number): string {
  const last = dayToDate(PRODUCTION.shootDays);
  const d = new Date(`${last}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + (day - PRODUCTION.shootDays));
  return d.toISOString().slice(0, 10);
}

export { wrapDayDate };

export function buildWrapReport(ctx: WrapContext = DEFAULT_WRAP_CONTEXT): WrapReport {
  const rng = mulberry32((ctx.seed ?? DEFAULT_SEED) + 80);
  const f: WrapFinding[] = [];
  const cannot: { what: string; why: string }[] = [];

  /* ------------------------------ RENTALS ----------------------------- */
  for (const r of RENTALS) {
    const returned = Math.floor(r.itemsOut * (0.05 + rng() * 0.2));
    const outstanding = r.itemsOut - returned;
    if (r.licensed) {
      f.push({
        category: 'rentals',
        code: `RENT.${r.id}.LICENSED`,
        severity: 'block',
        title: `${r.category}: ${outstanding} items must be back in the licensed vault by ${dayLabel(r.returnByDay)}`,
        detail: 'Not a fee. A licensing breach, and the license is the armorer\'s, personally. Every weapon signed out is signed back in, counted twice, by two people.',
        source: `Armory log · ${r.vendor}`,
        costCents: null,
        perDayCents: null,
        dueDay: r.returnByDay,
      });
      continue;
    }
    f.push({
      category: 'rentals',
      code: `RENT.${r.id}.DUE`,
      severity: r.returnByDay <= ctx.asOfDay + 1 ? 'review' : 'open',
      title: `${r.category}: ${outstanding} of ${r.itemsOut} still out, due ${dayLabel(r.returnByDay)}`,
      detail: `${r.vendor}. After the return date the whole order accrues at the daily rate until the last item is checked in, and one missing ${r.id === 'R1' ? 'lens' : r.id === 'R4' ? 'walkie' : r.id === 'R5' ? 'cloak' : 'item'} keeps the meter running on the whole order.`,
      source: `Rental agreement · ${r.vendor} · assumed_late_fee_cents_per_day`,
      costCents: null,
      perDayCents: r.assumed_late_fee_cents_per_day,
      dueDay: r.returnByDay,
    });
  }

  /* ----------------------------- LOCATIONS ---------------------------- */
  for (const loc of LOCATIONS) {
    if (loc.kind !== 'practical' || loc.depositCents === null || loc.permitTo === null) continue;
    const state = rng();
    const dueDay = PRODUCTION.shootDays + 14;
    if (state < 0.3) {
      f.push({
        category: 'locations',
        code: `LOC.${loc.id}.DAMAGE`,
        severity: 'review',
        title: `${loc.name}: open damage report against a ${fmt(loc.depositCents)} deposit`,
        detail: `Restoration is due by ${dayLabel(dueDay)}. Until the owner signs off, the deposit is theirs to argue about, and the person who walked the site on day ${loc.permitTo} has already flown home.`,
        source: `Location agreement · ${loc.name} · deposit`,
        costCents: loc.depositCents,
        perDayCents: null,
        dueDay,
      });
    } else if (state < 0.6) {
      f.push({
        category: 'locations',
        code: `LOC.${loc.id}.SIGNOFF`,
        severity: 'open',
        title: `${loc.name}: restoration done, sign-off not received`,
        detail: `Deposit of ${fmt(loc.depositCents)} is returnable on sign-off. Chase it; deposits that are not chased are not returned.`,
        source: `Location agreement · ${loc.name}`,
        costCents: loc.depositCents,
        perDayCents: null,
        dueDay,
      });
    }
  }

  /* ------------------------------- PEOPLE ----------------------------- */
  const timesheetsOpen = 30 + Math.floor(rng() * 30);
  const disputes = 3 + Math.floor(rng() * 6);
  const floats = 15 + Math.floor(rng() * 15);
  const floatCents = floats * (40_000 + Math.floor(rng() * 90_000));
  const roomsNoTravel = 25 + Math.floor(rng() * 30);
  const finalPayDay = PRODUCTION.shootDays + 3;
  f.push({
    category: 'people',
    code: 'PAY.TIMESHEETS',
    severity: 'review',
    title: `${timesheetsOpen} final-week time cards not yet approved`,
    detail: `The final pay run closes ${dayLabel(finalPayDay)}. Anything not approved by then is paid late to people who have already left the country, and ${disputes} of them are disputed.`,
    source: 'Payroll vendor · final week',
    costCents: null,
    perDayCents: null,
    dueDay: finalPayDay,
  });
  f.push({
    category: 'people',
    code: 'PAY.DISPUTES',
    severity: 'open',
    title: `${disputes} time card disputes open`,
    detail: `Assumed ${ASSUMED.assumed_time_card_dispute_days} working days each to close. The deal memo is the reference; where there is no signed deal memo, there is no reference.`,
    source: 'Payroll vendor · disputes · assumed_time_card_dispute_days',
    costCents: null,
    perDayCents: null,
    dueDay: finalPayDay + ASSUMED.assumed_time_card_dispute_days,
  });
  f.push({
    category: 'people',
    code: 'CASH.FLOATS',
    severity: 'review',
    title: `${floats} petty cash advances open, ${fmt(floatCents)} unreconciled`,
    detail: `Receipts or cash back by ${dayLabel(PRODUCTION.shootDays + 2)}. After that the advance is a personal debt on somebody\'s file and a line the auditor asks about.`,
    source: 'Accounting · petty cash log',
    costCents: floatCents,
    perDayCents: null,
    dueDay: PRODUCTION.shootDays + 2,
  });
  f.push({
    category: 'people',
    code: 'HOTEL.BLOCK_ENDS',
    severity: 'review',
    title: `${roomsNoTravel} traveling crew without confirmed travel home; hotel block ends ${dayLabel(PRODUCTION.shootDays + 2)}`,
    detail: `Rooms past the block are at rack rate, per room, per night, and the unit is no longer paying for the ones it has left. Flights first, then rooms.`,
    source: 'Travel coordinator · hotel agreement · assumed_hotel_overrun_room_night_cents',
    costCents: null,
    perDayCents: roomsNoTravel * ASSUMED.assumed_hotel_overrun_room_night_cents,
    dueDay: PRODUCTION.shootDays + 2,
  });
  f.push({
    category: 'people',
    code: 'NDA.SURVIVES',
    severity: 'clear',
    title: `${CREW_COUNT} NDAs remain in force`,
    detail: 'They do not end at wrap. Nothing to do tonight; something to remember when the first behind-the-scenes photo appears.',
    source: 'Onboarding tracker · nda',
    costCents: null,
    perDayCents: null,
    dueDay: null,
  });

  /* -------------------------------- MEDIA ----------------------------- */
  const unverified = [PRODUCTION.shootDays - 1, PRODUCTION.shootDays];
  f.push({
    category: 'media',
    code: 'MEDIA.LTO_PENDING',
    severity: 'block',
    title: `${unverified.length} shoot days not yet checksum-verified to tape`,
    detail: `Days ${unverified.join(' and ')} are on shuttle drives and nowhere else. Until both copies verify, the negative of two days of a series exists in one place, and the completion bond will not sign off on that.`,
    source: 'Data manager · LTO log',
    costCents: null,
    perDayCents: null,
    dueDay: PRODUCTION.shootDays + 1,
  });
  f.push({
    category: 'media',
    code: 'MEDIA.CHAIN',
    severity: 'open',
    title: '2 of 6 shuttle drives not yet signed in at the post house',
    detail: 'Chain of custody is a signature at each end. A drive in a courier van has neither.',
    source: 'Data manager · drive log',
    costCents: null,
    perDayCents: null,
    dueDay: PRODUCTION.shootDays + 2,
  });
  cannot.push({
    what: 'What is on the cards',
    why: 'Only the checksum knows. A file count is not a verification, and the engine will not report one as if it were.',
  });

  /* -------------------------------- CAST ------------------------------ */
  const wrapIso = wrapDayDate(PRODUCTION.shootDays + 1);
  for (const c of CAST) {
    if (!c.optionExpires) continue;
    const days = calendarDaysBetween(wrapIso, c.optionExpires);
    f.push({
      category: 'cast',
      code: `CAST.${c.number}.OPTION`,
      severity: days <= 30 ? 'review' : 'open',
      title: `${c.number} ${c.character}: series option lapses in ${days} days`,
      detail: `${shortDate(c.optionExpires)}. Exercise it, extend it or let it go. The one thing that cannot happen is nothing, because nothing is a decision too, made by the calendar.`,
      source: `Cast contract · ${c.number} · optionExpires`,
      costCents: null,
      perDayCents: null,
      dueDay: null,
    });
  }
  cannot.push({
    what: 'Cost of exercising an option',
    why: 'A next-season rate is in the contract, and the contract is in the vendor\'s system, not this one. The engine holds a day rate for scheduling and nothing else.',
  });

  /* -------------------------------- MONEY ----------------------------- */
  const invoices = 1_200 + Math.floor(rng() * 400);
  const missing = 15 + Math.floor(rng() * 20);
  const incidents = 2 + Math.floor(rng() * 3);
  f.push({
    category: 'money',
    code: 'REBATE.DOCS',
    severity: 'review',
    title: `${missing} of ${invoices} local-spend invoices missing from the incentive file`,
    detail: `If the host country\'s program applies, an assumed ${Math.round(ASSUMED.assumed_rebate_rate * 100)} percent of qualifying spend comes back, on audit, and an audit is only as good as its worst-documented invoice.`,
    source: 'Accounting · incentive file · assumed_rebate_rate',
    costCents: null,
    perDayCents: null,
    dueDay: PRODUCTION.shootDays + 30,
  });
  f.push({
    category: 'money',
    code: 'INSURANCE.OPEN',
    severity: 'review',
    title: `${incidents} incident reports open with the insurer`,
    detail: 'Each has a reporting deadline. A claim reported late is a claim declined, and the witnesses are on planes.',
    source: 'Production insurance · incident log',
    costCents: null,
    perDayCents: null,
    dueDay: PRODUCTION.shootDays + 7,
  });
  cannot.push({
    what: 'The incentive amount',
    why: 'Which program applies, at what rate, on which spend, is a matter of the host country and the production\'s legal structure. The engine names a rate and names it assumed.',
  });
  cannot.push({
    what: 'The credit roll',
    why: `This system holds ${CREW_COUNT} surrogate identifiers and no names. Credits are a join to the payroll vendor and a spelling check by a human who knows the people. Neither can be done from here, and that is by design.`,
  });

  /* ------------------------------ ROLL-UP ----------------------------- */
  const byCategory: Record<WrapCategory, WrapFinding[]> = { rentals: [], locations: [], people: [], media: [], cast: [], money: [] };
  for (const x of f) byCategory[x.category].push(x);

  const deadlineMap = new Map<number, WrapFinding[]>();
  for (const x of f) {
    if (x.dueDay === null) continue;
    const arr = deadlineMap.get(x.dueDay) ?? [];
    arr.push(x);
    deadlineMap.set(x.dueDay, arr);
  }
  const deadlines = [...deadlineMap.entries()].sort((a, b) => a[0] - b[0]).map(([day, items]) => ({ day, items }));

  return {
    asOfDay: ctx.asOfDay,
    findings: f,
    exposurePerDayCents: f.reduce((n, x) => n + (x.perDayCents ?? 0), 0),
    cannotCompute: cannot,
    byCategory,
    deadlines,
  };
}

function fmt(cents: number): string {
  return `$${Math.floor(cents / 100).toLocaleString('en-US')}`;
}
