import { describe, expect, it } from 'vitest';
import {
  PRODUCTION,
  SCENES,
  SHOOT_DAYS,
  buildWrapReport,
  castAvailableOn,
  dayToDate,
  daysBetweenDays,
  formatEighths,
  formatUsd,
  locationOpenOn,
  restDayAfter,
  sceneByNumber,
  weekdayOf,
} from '../index';

/* ===========================================================================
   THE CALENDAR, THE STRIPBOARD, AND WRAP

   The stripboard tests are invariants over the generated season: every scene
   on a day is at that day's location, inside its permit window, with every
   actor under contract. If the generator ever breaks one of those, the demo
   would be arguing from a schedule no first assistant director would sign.
   =========================================================================== */

describe('the calendar', () => {
  it('starts on a Monday and skips Sundays', () => {
    expect(dayToDate(1)).toBe('2027-02-01');
    expect(weekdayOf(dayToDate(1))).toBe('Mon');
    expect(weekdayOf(dayToDate(6))).toBe('Sat');
    expect(dayToDate(7)).toBe('2027-02-08');
    expect(weekdayOf(dayToDate(79))).toBe('Mon');
  });

  it('counts prep back from Day 1 with no day 0', () => {
    expect(dayToDate(-1)).toBe('2027-01-31');
    expect(() => dayToDate(0)).toThrow();
    expect(daysBetweenDays(-7, 1)).toBe(7);
    expect(weekdayOf(dayToDate(-7))).toBe('Mon');
  });

  it('knows which Saturdays have a Sunday after them', () => {
    expect(restDayAfter(48)).toBe('2027-03-28');
    expect(restDayAfter(47)).toBeNull();
  });
});

describe('formatting', () => {
  it('prints eighths the way a breakdown sheet does', () => {
    expect(formatEighths(12)).toBe('1 4/8');
    expect(formatEighths(8)).toBe('1');
    expect(formatEighths(6)).toBe('6/8');
  });

  it('never prints an unknown as zero', () => {
    expect(formatUsd(null)).toBe('—');
    expect(formatUsd(18_000_000)).toBe('$180,000.00');
    expect(formatUsd(18_000_000, { compact: true })).toBe('$180k');
  });
});

describe('the stripboard', () => {
  it('has seventy-nine contiguous shoot days', () => {
    expect(SHOOT_DAYS).toHaveLength(PRODUCTION.shootDays);
    SHOOT_DAYS.forEach((d, i) => expect(d.day).toBe(i + 1));
  });

  it('has no duplicate scene numbers', () => {
    const nums = SCENES.map((s) => s.number);
    expect(new Set(nums).size).toBe(nums.length);
  });

  it('puts every scene at its day\'s location, inside the permit window, with every actor under contract', () => {
    for (const d of SHOOT_DAYS) {
      expect(locationOpenOn(d.locationId, d.day).ok).toBe(true);
      for (const n of d.scenes) {
        const sc = sceneByNumber(n);
        expect(sc.locationId).toBe(d.locationId);
        for (const c of sc.cast) expect(castAvailableOn(c, d.day).ok).toBe(true);
      }
    }
  });

  it('schedules no scene twice', () => {
    const all = SHOOT_DAYS.flatMap((d) => d.scenes);
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('wrap', () => {
  const report = buildWrapReport({ asOfDay: 79 });

  it('blocks on the things that block: unverified media and licensed weapons, neither of which is a fee', () => {
    const blocks = report.findings.filter((f) => f.severity === 'block');
    expect(blocks.map((f) => f.code)).toContain('MEDIA.LTO_PENDING');
    expect(blocks.map((f) => f.code)).toContain('RENT.R6.LICENSED');
    for (const b of blocks) {
      expect(b.costCents).toBeNull();
      expect(b.perDayCents).toBeNull();
    }
  });

  it('sums a per-day exposure only from things that accrue per day', () => {
    const expected = report.findings.reduce((n, f) => n + (f.perDayCents ?? 0), 0);
    expect(report.exposurePerDayCents).toBe(expected);
    expect(report.exposurePerDayCents).toBeGreaterThan(0);
  });

  it('lists deadlines in order and loses none', () => {
    const days = report.deadlines.map((d) => d.day);
    expect([...days].sort((a, b) => a - b)).toEqual(days);
    const dated = report.findings.filter((f) => f.dueDay !== null).length;
    expect(report.deadlines.reduce((n, d) => n + d.items.length, 0)).toBe(dated);
  });

  it('refuses to generate a credit roll, because it holds no names', () => {
    expect(report.cannotCompute.map((c) => c.what)).toContain('The credit roll');
  });

  it('is the same report every time', () => {
    expect(buildWrapReport({ asOfDay: 79 })).toEqual(report);
  });
});
