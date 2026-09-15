import type {
  CrewAdjudication,
  CrewMember,
  CrewVerdict,
  DepartmentSummary,
  Finding,
  GateKey,
  GateSpec,
  Severity,
  SoftKey,
} from './types';
import { CREW_VERDICT_SEVERITY, worstSeverity } from './types';
import { dayLabel, daysBetweenDays } from './production';

/* ===========================================================================
   CLEARANCE — WHO CAN BE ON SET, AND WHO CANNOT

   No model runs in this file. Given the same crew record and the same moment
   it returns the same verdict, every time, and every finding says where it is
   observable from and by when it has to be resolved.

   The question the board answers is not "is the paperwork done". It is "will
   this person be able to work on the first day they are needed", which is a
   question about lead times and calendars. A missing orientation the night
   before is an open item. A missing work permit the night before is a
   blocked person, because a consulate does not work nights.
   =========================================================================== */

export const GATES: Record<GateKey, GateSpec> = {
  deal_memo: {
    key: 'deal_memo',
    label: 'Deal memo signed',
    owner: 'production',
    assumed_lead_days: 1,
    note: 'Rate, role, dates, and the terms everything else refers back to. Without it every time card is a negotiation.',
  },
  nda: {
    key: 'nda',
    label: 'NDA signed',
    owner: 'production',
    assumed_lead_days: 0,
    note: 'Signed at the door if it has to be. It survives wrap; see the wrap report.',
  },
  right_to_work: {
    key: 'right_to_work',
    label: 'Work authorization verified',
    owner: 'third_party',
    assumed_lead_days: 10,
    note: 'A permit, a visa or a registration, depending on passport and host country. Issued by a government office on its own timetable.',
  },
  local_tax_form: {
    key: 'local_tax_form',
    label: 'Local tax registration',
    owner: 'production',
    assumed_lead_days: 1,
    note: 'What the payroll vendor needs before the first pay run.',
  },
  safety_induction: {
    key: 'safety_induction',
    label: 'Safety orientation attended',
    owner: 'production',
    assumed_lead_days: 1,
    note: 'Runs every morning at base camp. Nobody on set without it; nobody blocked by it unless they were due yesterday.',
  },
  stunt_risk_assessment: {
    key: 'stunt_risk_assessment',
    label: 'Stunt risk assessment approved by insurer',
    owner: 'third_party',
    assumed_lead_days: 3,
    note: 'The coordinator writes it; the production insurer approves it. No approved assessment, no stunt, and no performer on it.',
  },
  license_check: {
    key: 'license_check',
    label: "Driver's license verified by insurer",
    owner: 'third_party',
    assumed_lead_days: 2,
    note: 'The fleet policy names who may drive. A driver not on it is not insured.',
  },
  weapons_license: {
    key: 'weapons_license',
    label: 'Weapons license verified',
    owner: 'third_party',
    assumed_lead_days: 5,
    note: 'Verified with the licensing authority, not by looking at the card.',
  },
  minor_permit: {
    key: 'minor_permit',
    label: "Minor's work permit",
    owner: 'third_party',
    assumed_lead_days: 14,
    note: 'Issued by a labor or education authority. Lead times vary by country and are never short.',
  },
  studio_teacher: {
    key: 'studio_teacher',
    label: 'Studio teacher assigned',
    owner: 'production',
    assumed_lead_days: 2,
    note: 'A certified studio teacher on set every day the minor works.',
  },
  animal_handler_cert: {
    key: 'animal_handler_cert',
    label: 'Animal handler certificate',
    owner: 'third_party',
    assumed_lead_days: 7,
    note: 'Required by the animal welfare monitor before any animal works.',
  },
};

export const SOFT_LABELS: Record<SoftKey, string> = {
  contact_verified: 'Contact verified for call sheet distribution',
  accommodation: 'Hotel booked',
  travel: 'Travel booked',
  radio: 'Radio issued',
  gear: 'Gear issued',
};

export interface ClearanceContext {
  /** The moment the board is evaluated at. */
  asOfDay: number;
  /** Lead-day overrides, for the sliders. Every override is still an assumption. */
  leadDays?: Partial<Record<GateKey, number>>;
}

function leadFor(key: GateKey, ctx: ClearanceContext): number {
  return ctx.leadDays?.[key] ?? GATES[key].assumed_lead_days;
}

/**
 * Adjudicate one crew record.
 *
 * `daysUntilStart` is calendar days from the evaluation moment to the first
 * set day. A gate whose lead time exceeds that cannot close in time, whoever
 * is chasing it, and that is the definition of BLOCKED here.
 */
export function adjudicateCrew(m: CrewMember, ctx: ClearanceContext): CrewAdjudication {
  const daysUntilStart = daysBetweenDays(ctx.asOfDay, m.startsOnDay);
  const alreadyWorking = daysUntilStart <= 0;
  const findings: Finding[] = [];
  const openGates: GateKey[] = [];

  for (const key of Object.keys(m.gates) as GateKey[]) {
    if (m.gates[key]) continue;
    openGates.push(key);
    const spec = GATES[key];
    const lead = leadFor(key, ctx);

    if (alreadyWorking) {
      findings.push({
        code: `GATE.${key.toUpperCase()}.WORKING_WITHOUT`,
        severity: 'block',
        title: `${spec.label.replace(/ (signed|verified|attended|assigned).*$/, '')}: working without it`,
        detail:
          `On set since ${dayLabel(m.startsOnDay)} with this open. ` +
          (spec.owner === 'third_party'
            ? `It is in a third party's hands and takes about ${lead} day${lead === 1 ? '' : 's'}. Every day worked meanwhile is a day the production cannot defend.`
            : 'The production can close it itself, today, and should have before the first call.'),
        source: `Onboarding tracker · ${key}`,
        costCents: null,
        dueDay: ctx.asOfDay,
      });
      continue;
    }

    if (lead > daysUntilStart) {
      findings.push({
        code: `GATE.${key.toUpperCase()}.CANNOT_CLOSE`,
        severity: 'block',
        title: `${spec.label}: cannot close before ${dayLabel(m.startsOnDay)}`,
        detail:
          `Lead time is ${lead} day${lead === 1 ? '' : 's'}; this person is needed in ${daysUntilStart}. ` +
          `Short by ${lead - daysUntilStart}. Either the start date moves, the role is covered locally, or the day is shot without them.`,
        source: `Onboarding tracker · ${key} · assumed_lead_days`,
        costCents: null,
        dueDay: m.startsOnDay,
      });
      continue;
    }

    if (spec.owner === 'third_party') {
      findings.push({
        code: `GATE.${key.toUpperCase()}.THIRD_PARTY`,
        severity: 'review',
        title: `${spec.label}: with a third party`,
        detail:
          `Fits in the ${daysUntilStart} day${daysUntilStart === 1 ? '' : 's'} available if it started today, with ${daysUntilStart - lead} to spare. ` +
          'Nobody in the office can make it go faster. Chase it, and have a fallback by the day it stops fitting.',
        source: `Onboarding tracker · ${key}`,
        costCents: null,
        dueDay: m.startsOnDay - lead,
      });
      continue;
    }

    findings.push({
      code: `GATE.${key.toUpperCase()}.OPEN`,
      severity: 'open',
      title: `${spec.label}: open`,
      detail: `Closeable inside the production in ${lead} day${lead === 1 ? '' : 's'}, with ${daysUntilStart - lead} to spare. Someone has to do it.`,
      source: `Onboarding tracker · ${key}`,
      costCents: null,
      dueDay: m.startsOnDay - lead,
    });
  }

  const severity = worstSeverity(findings);
  const verdict: CrewVerdict =
    severity === 'block' ? 'BLOCKED' : severity === 'review' ? 'EXPOSED' : severity === 'open' ? 'OPEN' : 'CLEARED';

  const softOpen = (Object.keys(m.soft) as SoftKey[]).filter((k) => m.soft[k] === false);

  return {
    crewId: m.id,
    verdict,
    severity: CREW_VERDICT_SEVERITY[verdict],
    daysUntilStart,
    alreadyWorking,
    findings,
    openGates,
    softOpen,
  };
}

export function adjudicateAll(crew: readonly CrewMember[], ctx: ClearanceContext): Map<string, CrewAdjudication> {
  const out = new Map<string, CrewAdjudication>();
  for (const m of crew) out.set(m.id, adjudicateCrew(m, ctx));
  return out;
}

/**
 * Roll people up into departments.
 *
 * Two department-level rules, because a department is not just the sum of
 * its people: a department whose head cannot work cannot sign off its own
 * work, and a department of any size with no cleared second has one person
 * between it and a very bad day.
 */
export function summarizeDepartments(
  crew: readonly CrewMember[],
  adj: ReadonlyMap<string, CrewAdjudication>,
  horizonDay: number,
): DepartmentSummary[] {
  const groups = new Map<string, CrewMember[]>();
  for (const m of crew) {
    const g = groups.get(m.department) ?? [];
    g.push(m);
    groups.set(m.department, g);
  }

  const out: DepartmentSummary[] = [];
  for (const [department, members] of groups) {
    const tally: Record<CrewVerdict, number> = { BLOCKED: 0, EXPOSED: 0, OPEN: 0, CLEARED: 0 };
    const needed = members.filter((m) => m.startsOnDay <= horizonDay);
    for (const m of needed) tally[adj.get(m.id)!.verdict] += 1;

    const head = members.find((m) => m.isHead);
    const key = members.find((m) => m.isKey);
    const headVerdict = head ? adj.get(head.id)!.verdict : null;
    const keyCleared = key ? adj.get(key.id)!.verdict === 'CLEARED' : null;

    // The gate that is doing the most damage, not the one that is merely most
    // common. A hundred open inductions are a morning's work; one open work
    // permit is a person who is not on set.
    const weight: Record<Severity, number> = { block: 1000, review: 10, open: 1, clear: 0 };
    const blockerScore = new Map<GateKey, { score: number; count: number }>();
    for (const m of needed) {
      const a = adj.get(m.id)!;
      for (const f of a.findings) {
        const gate = f.code.split('.')[1]?.toLowerCase() as GateKey | undefined;
        if (!gate || !(gate in GATES)) continue;
        const row = blockerScore.get(gate) ?? { score: 0, count: 0 };
        row.score += weight[f.severity];
        row.count += 1;
        blockerScore.set(gate, row);
      }
    }
    let topBlocker: { gate: GateKey; count: number } | null = null;
    let topScore = 0;
    for (const [gate, row] of blockerScore) {
      if (row.score > topScore) {
        topScore = row.score;
        topBlocker = { gate, count: row.count };
      }
    }

    const findings: Finding[] = [];
    if (head && headVerdict === 'BLOCKED') {
      findings.push({
        code: 'DEPT.HEAD_BLOCKED',
        severity: 'block',
        title: `${head.role} cannot be on set for ${dayLabel(head.startsOnDay)}`,
        detail:
          `A department without its head on its first day cannot sign off its own work, and this one has ${members.length} people waiting on that signature.`,
        source: `Crew list · ${department} · head`,
        costCents: null,
        dueDay: head.startsOnDay,
      });
    }
    if (members.length >= 8 && head && key && !keyCleared && headVerdict !== 'BLOCKED') {
      findings.push({
        code: 'DEPT.NO_SECOND',
        severity: 'review',
        title: `No cleared second in ${department}`,
        detail:
          `${members.length} people and one cleared person who can run them. If the ${head.role.toLowerCase()} is ill on ${dayLabel(head.startsOnDay)}, nobody is.`,
        source: `Crew list · ${department} · key`,
        costCents: null,
        dueDay: key.startsOnDay,
      });
    }
    const neededCount = needed.length;
    if (neededCount >= 4 && tally.BLOCKED / neededCount > 0.25) {
      findings.push({
        code: 'DEPT.BLOCKED_SHARE',
        severity: 'review',
        title: `${tally.BLOCKED} of ${neededCount} needed by ${dayLabel(horizonDay)} cannot be on set`,
        detail: 'More than a quarter of the department. The day can probably be shot; the question is whether it can be shot safely at this headcount, and that is a call for the head of department, tonight.',
        source: `Crew list · ${department}`,
        costCents: null,
        dueDay: horizonDay,
      });
    }

    const memberSeverities: { severity: Severity }[] = needed.map((m) => ({ severity: adj.get(m.id)!.severity }));
    out.push({
      department,
      headcount: members.length,
      neededByHorizon: neededCount,
      tally,
      headVerdict,
      keyCleared,
      topBlocker,
      findings,
      severity: worstSeverity([...findings, ...memberSeverities]),
    });
  }

  return out;
}

/** Which open gates are blocking the most people, across the unit. */
export function blockerPareto(
  crew: readonly CrewMember[],
  adj: ReadonlyMap<string, CrewAdjudication>,
  horizonDay: number,
): { gate: GateKey; blocked: number; exposed: number; open: number }[] {
  const acc = new Map<GateKey, { blocked: number; exposed: number; open: number }>();
  for (const m of crew) {
    if (m.startsOnDay > horizonDay) continue;
    const a = adj.get(m.id)!;
    for (const f of a.findings) {
      const gate = f.code.split('.')[1]?.toLowerCase() as GateKey | undefined;
      if (!gate || !(gate in GATES)) continue;
      const row = acc.get(gate) ?? { blocked: 0, exposed: 0, open: 0 };
      if (f.severity === 'block') row.blocked += 1;
      else if (f.severity === 'review') row.exposed += 1;
      else row.open += 1;
      acc.set(gate, row);
    }
  }
  return [...acc.entries()]
    .map(([gate, r]) => ({ gate, ...r }))
    .sort((a, b) => b.blocked - a.blocked || b.exposed - a.exposed || b.open - a.open);
}

/**
 * Cumulative arrivals against cumulative clearances, by production day.
 *
 * The gap between the two lines is the board's whole argument: it is the
 * number of people who are supposed to be on set and cannot be.
 */
export function arrivalCurve(
  crew: readonly CrewMember[],
  adj: ReadonlyMap<string, CrewAdjudication>,
  fromDay: number,
  toDay: number,
): { day: number; arriving: number; needed: number; cleared: number }[] {
  const out: { day: number; arriving: number; needed: number; cleared: number }[] = [];
  let needed = 0;
  let cleared = 0;
  for (let d = fromDay; d <= toDay; d += 1) {
    if (d === 0) continue;
    const arriving = crew.filter((m) => m.startsOnDay === d);
    needed += arriving.length;
    cleared += arriving.filter((m) => adj.get(m.id)!.verdict === 'CLEARED').length;
    out.push({ day: d, arriving: arriving.length, needed, cleared });
  }
  return out;
}
