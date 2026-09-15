import { describe, expect, it } from 'vitest';
import {
  CREW_COUNT,
  GATES,
  MOMENTS,
  PRODUCTION,
  adjudicateAll,
  adjudicateCrew,
  daysBetweenDays,
  generateCrew,
  summarizeDepartments,
} from '../index';
import type { CrewMember } from '../index';

/* ===========================================================================
   CLEARANCE

   Boundary-focused: the interesting cases are the ones sitting exactly on a
   lead time, because that is where a board tells someone they are fine when
   they are not.
   =========================================================================== */

const NOW = MOMENTS.crewUp.day;

function person(over: Partial<CrewMember>): CrewMember {
  return {
    id: 'CR-TEST00',
    department: 'Camera',
    role: 'Camera operator',
    isHead: false,
    isKey: false,
    residency: 'traveling',
    startsOnDay: 1,
    gates: { deal_memo: true, nda: true, safety_induction: true, right_to_work: true },
    soft: {},
    minor: false,
    ...over,
  };
}

describe('lead time against days remaining', () => {
  const lead = GATES.right_to_work.assumed_lead_days;

  it('exactly enough days is not blocked', () => {
    // Find a start day that is exactly `lead` calendar days from now.
    let start = 1;
    while (daysBetweenDays(NOW, start) < lead) start += 1;
    expect(daysBetweenDays(NOW, start)).toBe(lead);
    const a = adjudicateCrew(person({ startsOnDay: start, gates: { right_to_work: false } }), { asOfDay: NOW });
    expect(a.verdict).toBe('EXPOSED');
    expect(a.findings[0]!.code).toBe('GATE.RIGHT_TO_WORK.THIRD_PARTY');
  });

  it('one day short is blocked', () => {
    let start = 1;
    while (daysBetweenDays(NOW, start) < lead - 1) start += 1;
    expect(daysBetweenDays(NOW, start)).toBe(lead - 1);
    const a = adjudicateCrew(person({ startsOnDay: start, gates: { right_to_work: false } }), { asOfDay: NOW });
    expect(a.verdict).toBe('BLOCKED');
    expect(a.findings[0]!.code).toBe('GATE.RIGHT_TO_WORK.CANNOT_CLOSE');
    expect(a.findings[0]!.detail).toContain('Short by 1');
  });

  it('a lead-time override changes the verdict, because it is an assumption', () => {
    const a = adjudicateCrew(person({ startsOnDay: 1, gates: { right_to_work: false } }), { asOfDay: NOW, leadDays: { right_to_work: 2 } });
    expect(a.verdict).toBe('EXPOSED');
  });
});

describe('already working', () => {
  it('an open gate on someone already on the clock is a block, whoever owns the gate', () => {
    const a = adjudicateCrew(person({ startsOnDay: -14, gates: { nda: false } }), { asOfDay: NOW });
    expect(a.alreadyWorking).toBe(true);
    expect(a.verdict).toBe('BLOCKED');
    expect(a.findings[0]!.code).toBe('GATE.NDA.WORKING_WITHOUT');
  });
});

describe('the other tiers', () => {
  it('a production-owned gate with time to spare is open, not exposed', () => {
    const a = adjudicateCrew(person({ startsOnDay: 7, gates: { safety_induction: false } }), { asOfDay: NOW });
    expect(a.verdict).toBe('OPEN');
  });

  it('every hard gate closed is cleared, and soft items do not change that', () => {
    const a = adjudicateCrew(person({ soft: { radio: false, accommodation: false } }), { asOfDay: NOW });
    expect(a.verdict).toBe('CLEARED');
    expect(a.softOpen).toEqual(['radio', 'accommodation']);
  });

  it('there is no day 0 to start on', () => {
    expect(() => daysBetweenDays(NOW, 0)).toThrow(/no day 0/);
  });
});

describe('the generated crew', () => {
  const crew = generateCrew({ asOfDay: NOW });
  const adj = adjudicateAll(crew, { asOfDay: NOW });

  it('is three hundred six people, and the same three hundred six every time', () => {
    expect(crew).toHaveLength(CREW_COUNT);
    expect(CREW_COUNT).toBe(PRODUCTION.crewTarget);
    expect(generateCrew({ asOfDay: NOW })).toEqual(crew);
  });

  it('has exactly one child, and the child cannot be on set on his start day at the assumed lead time', () => {
    const minors = crew.filter((m) => m.minor);
    expect(minors).toHaveLength(1);
    expect(adj.get(minors[0]!.id)!.verdict).toBe('BLOCKED');
  });

  it('has an armorer working without a verified license', () => {
    const armorer = crew.find((m) => m.department === 'Armory' && m.isHead)!;
    const a = adj.get(armorer.id)!;
    expect(a.alreadyWorking).toBe(true);
    expect(a.findings.map((f) => f.code)).toContain('GATE.WEAPONS_LICENSE.WORKING_WITHOUT');
  });

  it('blocks a department whose head is blocked', () => {
    const depts = summarizeDepartments(crew, adj, 7);
    const animals = depts.find((d) => d.department === 'Animals')!;
    expect(animals.headVerdict).toBe('BLOCKED');
    expect(animals.findings.map((f) => f.code)).toContain('DEPT.HEAD_BLOCKED');
  });

  it('blocks fewer people when the consulate is faster', () => {
    const slow = [...adjudicateAll(crew, { asOfDay: NOW, leadDays: { right_to_work: 14 } }).values()].filter((a) => a.verdict === 'BLOCKED').length;
    const fast = [...adjudicateAll(crew, { asOfDay: NOW, leadDays: { right_to_work: 1 } }).values()].filter((a) => a.verdict === 'BLOCKED').length;
    expect(fast).toBeLessThan(slow);
  });
});
