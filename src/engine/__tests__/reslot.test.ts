import { describe, expect, it } from 'vitest';
import {
  ASSUMED,
  DEFAULT_RESLOT_CONTEXT,
  callSheetForOption,
  castByNumber,
  coverCandidates,
  diffCallSheets,
  locationById,
  losableDays,
  lostDayContext,
  originalCallSheet,
  overtimeCents,
  planLostDay,
  sceneByNumber,
  shootDay,
} from '../index';

/* ===========================================================================
   THE LOST DAY

   The solver is greedy and small. The tests are about the constraints it
   checks, because those are the things a paper schedule gets wrong at 19:40.
   =========================================================================== */

const CTX = DEFAULT_RESLOT_CONTEXT;
const options = planLostDay(CTX);
const by = (kind: string) => options.find((o) => o.kind === kind)!;
const cover = by('cover_set');
const split = by('split_day');
const second = by('second_unit');
const cancel = by('cancel_absorb');
const rest = by('rest_day');
const d80 = by('day_eighty');
const ford = locationById('FORD');

describe('the six options', () => {
  it('are all present, feasible ones first, the unpriceable one last', () => {
    expect(options).toHaveLength(6);
    const order = options.map((o) => o.feasibility);
    const rank = { feasible: 0, partial: 1, infeasible: 2 } as const;
    for (let i = 1; i < order.length; i += 1) expect(rank[order[i]!]).toBeGreaterThanOrEqual(rank[order[i - 1]!]);
    expect(options[options.length - 1]!.kind).toBe('day_eighty');
    expect(d80.costCents).toBeNull();
  });

  it('are the same six options every time', () => {
    expect(planLostDay(CTX)).toEqual(options);
  });

  it('price the cover set below canceling the day', () => {
    expect(cover.costCents!).toBeLessThan(cancel.costCents!);
  });
});

describe('cover set', () => {
  it('pulls forward the forest house, not the scriptorium, and says why', () => {
    expect(cover.feasibility).toBe('feasible');
    expect(cover.tomorrow?.scenes).toEqual(['101', '102', '103']);
    expect(cover.opensDay).toBe(58);
    const c = coverCandidates(CTX);
    expect(c.find((x) => x.day === 52)!.feasibility).toBe('infeasible');
    expect(c.find((x) => x.day === 52)!.reasons.join(' ')).toContain('PADARN');
    expect(c.find((x) => x.day === 55)!.feasibility).toBe('partial');
    expect(c.find((x) => x.day === 58)!.feasibility).toBe('feasible');
  });

  it('finds a home for every ford scene inside the permit window', () => {
    expect(cover.unplaced).toEqual([]);
    expect(cover.placements.map((p) => p.scene).sort()).toEqual(['61', '62', '63', '64']);
    for (const p of cover.placements) {
      expect(p.toDay).toBeGreaterThan(CTX.lostDay);
      expect(p.toDay).toBeLessThanOrEqual(ford.permitTo!);
      expect(p.unit).toBe('main');
    }
  });

  it('does not put a dawn on a day that already has one', () => {
    const p = cover.placements.find((x) => x.scene === '61')!;
    const existing = shootDay(p.toDay).scenes.map(sceneByNumber);
    expect(existing.some((s) => s.time === 'DAWN')).toBe(false);
    expect(p.toDay).not.toBe(50);
  });

  it('keeps an actor off a day he is contractually elsewhere', () => {
    const p = cover.placements.find((x) => x.scene === '62')!;
    expect(sceneByNumber('62').cast).toContain(12);
    expect(castByNumber(12).unavailableDays).toContain(48);
    expect(p.toDay).not.toBe(48);
  });

  it('calls the child late rather than early on the dusk scene', () => {
    expect(cover.findings.map((f) => f.code)).toContain('MINOR.LATE_CALL');
  });

  it('prices the day it opens as a decision, not a number', () => {
    const f = cover.findings.find((x) => x.code === 'COVER.DAY_OPENS')!;
    expect(f.costCents).toBeNull();
    expect(f.severity).toBe('review');
  });
});

describe('the split day', () => {
  it('shoots the stage in the morning and the dusk scene at the ford after it clears', () => {
    expect(CTX.forecast.clearsAt).not.toBeNull();
    expect(split.feasibility).toBe('feasible');
    expect(split.tomorrow?.locationId).toBe('STAGE_D');
    expect(split.split?.locationId).toBe('FORD');
    expect(split.split?.scenes).toEqual(['64']);
  });

  it('keeps everyone out of the water while the river is up, whatever the sky does', () => {
    expect(CTX.forecast.waterUnsafe).toBe(true);
    expect(split.split?.scenes).not.toContain('61');
    expect(split.split?.scenes).not.toContain('62');
    expect(split.split?.scenes).not.toContain('63');
    expect(split.findings.map((f) => f.code)).toContain('SPLIT.WATER_UNSAFE');
  });

  it('charges for the move and absorbs the rest', () => {
    expect(split.costLines.some((l) => l.label.startsWith('Company move'))).toBe(true);
    expect(split.placements.map((p) => p.scene).sort()).toEqual(['61', '62', '63']);
  });

  it('has nothing to split when the forecast has no window', () => {
    const noWindow = losableDays().map(lostDayContext).find((c) => c.forecast.clearsAt === null);
    expect(noWindow).toBeDefined();
    const o = planLostDay(noWindow!).find((x) => x.kind === 'split_day')!;
    expect(o.feasibility).toBe('infeasible');
    expect(o.findings[0]!.code).toBe('SPLIT.NO_WINDOW');
  });
});

describe('the second unit', () => {
  it('takes the eligible scenes with doubles and leaves the faces to the main unit', () => {
    const su = second.placements.filter((p) => p.unit === 'second').map((p) => p.scene).sort();
    expect(su).toEqual(['61', '63']);
    expect(second.placements.find((p) => p.scene === '62')!.unit).toBe('main');
    expect(second.findings.map((f) => f.code)).toContain('SU.DOUBLES');
  });

  it('says out loud that the second unit is an assumption', () => {
    expect(second.findings.map((f) => f.code)).toContain('SU.ASSUMED');
    expect(second.feasibility).toBe('partial');
    expect(second.costLines.some((l) => l.label.startsWith('Second unit day'))).toBe(true);
  });
});

describe('cancel and absorb', () => {
  it('pays for the day and says so', () => {
    const f = cancel.findings.find((x) => x.code === 'CANCEL.DAY_PAID')!;
    expect(f.costCents).toBe(Math.round(ASSUMED.assumed_unit_day_cost_cents * ASSUMED.assumed_canceled_day_pay_share));
    expect(cancel.tomorrow).toBeNull();
  });
});

describe('the rest day', () => {
  it('keeps the actor with a rest-day clause and the child off Sunday, and shoots what it can', () => {
    const sunday = rest.placements.filter((p) => !Number.isInteger(p.toDay)).map((p) => p.scene);
    expect(sunday).toEqual(['63']);
    expect(rest.feasibility).toBe('partial');
    expect(rest.findings.map((f) => f.code)).toContain('REST.SEVENTH_DAY');
  });

  it('refuses to total a figure that depends on the crew agreement', () => {
    expect(rest.costCents).toBeNull();
    expect(rest.unpriced.length).toBeGreaterThan(0);
    expect(rest.costLines.length).toBeGreaterThan(0);
  });
});

describe('day eighty', () => {
  it('does not exist', () => {
    expect(d80.feasibility).toBe('infeasible');
    expect(d80.unplaced.map((u) => u.scene).sort()).toEqual(['61', '62', '63', '64']);
    expect(d80.findings.map((f) => f.code)).toEqual(['D80.NO_DAY', 'D80.PERMIT']);
    expect(d80.costLines).toEqual([]);
  });
});

describe('any exterior day', () => {
  it('can be lost, and every option stays inside the permit window', () => {
    for (const day of losableDays()) {
      const ctx = lostDayContext(day);
      const opts = planLostDay(ctx);
      expect(opts).toHaveLength(6);
      const loc = locationById(shootDay(day).locationId);
      for (const o of opts) {
        for (const p of o.placements) {
          if (!Number.isInteger(p.toDay)) continue;
          expect(p.toDay).toBeGreaterThan(day);
          if (loc.permitTo !== null && sceneByNumber(p.scene).locationId === loc.id) expect(p.toDay).toBeLessThanOrEqual(loc.permitTo);
        }
        expect(o.costLines.every((l) => Number.isInteger(l.cents))).toBe(true);
      }
    }
  });

  it('never prices day eighty', () => {
    for (const day of losableDays()) {
      const o = planLostDay(lostDayContext(day)).find((x) => x.kind === 'day_eighty')!;
      expect(o.costCents).toBeNull();
      expect(o.feasibility).toBe('infeasible');
    }
  });
});

describe('overtime arithmetic', () => {
  const hourly = ASSUMED.assumed_unit_day_cost_cents / ASSUMED.assumed_base_hours;
  it('is zero at zero', () => expect(overtimeCents(0)).toBe(0));
  it('is time and a half for the first two hours', () => expect(overtimeCents(2)).toBe(Math.round(hourly * 2 * ASSUMED.assumed_ot_multiplier_1)));
  it('is double beyond two', () => expect(overtimeCents(3)).toBe(Math.round(hourly * (2 * ASSUMED.assumed_ot_multiplier_1 + 1 * ASSUMED.assumed_ot_multiplier_2))));
});

describe('the call sheet', () => {
  const issued = originalCallSheet(CTX.lostDay);
  const revised = callSheetForOption(cover, CTX.lostDay);
  const none = callSheetForOption(cancel, CTX.lostDay);
  const splitSheet = callSheetForOption(split, CTX.lostDay);

  it('as issued has a dawn call and four scenes', () => {
    expect(issued.revision).toBe('ISSUED');
    expect(issued.unitCall).toBe('04:45');
    expect(issued.scenes.map((s) => s.number)).toEqual(['61', '62', '63', '64']);
  });

  it('revised for the cover set moves the unit to the stage and releases five actors', () => {
    expect(revised.revision).toBe('REVISED');
    expect(revised.canceled).toBe(false);
    expect(revised.scenes.map((s) => s.number)).toEqual(['101', '102', '103']);
    const diff = diffCallSheets(issued, revised);
    expect(diff.castReleased).toEqual([3, 7, 12, 14, 15]);
    expect(diff.castAdded).toEqual([]);
    expect(diff.bookingsCanceled).toContain('30 background');
  });

  it('for a split day carries a company move and the afternoon scene', () => {
    expect(splitSheet.move).not.toBeNull();
    expect(splitSheet.move!.locationId).toBe('FORD');
    expect(splitSheet.move!.scenes.map((s) => s.number)).toEqual(['64']);
    // One row per actor: MAELOR keeps the morning pickup and a remark; only the child arrives for the afternoon.
    expect(splitSheet.move!.cast.map((c) => c.number)).toEqual([9]);
    expect(splitSheet.cast.find((c) => c.number === 1)?.remark).toContain('Sc 64');
    expect(diffCallSheets(issued, splitSheet).scenesRemoved).toEqual(['61', '62', '63']);
  });

  it('for a canceled day has no scenes and says so', () => {
    expect(none.canceled).toBe(true);
    expect(none.scenes).toEqual([]);
    expect(none.notes[0]).toContain('Day canceled');
  });
});
