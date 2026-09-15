import { describe, expect, it } from 'vitest';
import { CAST, CAST_FIELD_NAMES, CREW_FIELD_NAMES, MOMENTS, allBreakdowns, buildBreakdownRequest, generateCrew, inspectModelBoundary, shootDay } from '../index';

/* ===========================================================================
   THE MODEL BOUNDARY

   The page tells the reader that no crew record and no cast contract reaches
   a language model. These tests are what make that a property of the system
   rather than a sentence in a footer. If someone later widens the boundary to
   take "just the cast list, it's easier", the build fails here.
   =========================================================================== */

const PAGE = allBreakdowns()[0]!.text;

describe('what may cross the boundary', () => {
  it('accepts scene page text', () => {
    const req = buildBreakdownRequest([PAGE]);
    expect(req.pages).toHaveLength(1);
    expect(req.contract).toContain('You will never be given crew records');
  });

  it('carries nothing but the contract and the pages', () => {
    const req = buildBreakdownRequest([PAGE]);
    expect(Object.keys(req).sort()).toEqual(['contract', 'pages']);
  });
});

describe('what may not', () => {
  it('refuses a crew record', () => {
    const [m] = generateCrew({ asOfDay: MOMENTS.crewUp.day });
    expect(() => buildBreakdownRequest([m])).toThrow(/Only scene page text/);
  });

  it('refuses a cast contract, which is the one record with a rate on it', () => {
    expect(() => buildBreakdownRequest([CAST[0]])).toThrow(/Only scene page text/);
  });

  it('refuses an arbitrary string, so a rate or a name cannot get through by being renamed', () => {
    expect(() => buildBreakdownRequest(['jane.doe@example.com'])).toThrow(/not a page in the script/);
    expect(() => buildBreakdownRequest(['MAELOR · $25,000 per day'])).toThrow(/not a page in the script/);
  });

  it('refuses null, numbers and objects', () => {
    expect(() => buildBreakdownRequest([null])).toThrow();
    expect(() => buildBreakdownRequest([42])).toThrow();
    expect(() => buildBreakdownRequest([{ text: PAGE }])).toThrow();
  });
});

describe('the boundary report the page renders', () => {
  const forbidden = [...CREW_FIELD_NAMES, ...CAST_FIELD_NAMES].filter((k) => k !== 'number');
  const tomorrow = shootDay(MOMENTS.lostDay.day + 1);

  it('finds no crew or cast field anywhere in the outbound payload', () => {
    const report = inspectModelBoundary(tomorrow.scenes, forbidden);
    expect(report.forbiddenKeysFound).toEqual([]);
    expect(report.pagesSent).toBe(tomorrow.scenes.length);
  });

  it('reports the payload shape it actually built', () => {
    expect(inspectModelBoundary(tomorrow.scenes, forbidden).payloadKeys.sort()).toEqual(['contract', 'pages']);
  });
});

describe('the guard lists themselves', () => {
  it('name every field a crew record actually has', () => {
    const crew = generateCrew({ asOfDay: MOMENTS.crewUp.day });
    for (const m of crew) for (const key of Object.keys(m)) expect(CREW_FIELD_NAMES).toContain(key);
  });

  it('hold no name, email, phone, passport, nationality, address or bank field to leak in the first place', () => {
    const forbidden = ['name', 'firstName', 'lastName', 'email', 'phone', 'passport', 'nationality', 'address', 'bank', 'iban', 'agent'];
    for (const f of forbidden) {
      expect(CREW_FIELD_NAMES as readonly string[]).not.toContain(f);
      expect(CAST_FIELD_NAMES as readonly string[]).not.toContain(f);
    }
  });
});
