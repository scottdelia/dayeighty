import { describe, expect, it } from 'vitest';
import { LIVE_PAGE_MAX_CHARS, buildLiveBreakdownRequest, factsFromQuotes, pageShapeProblem, parseModelReply } from '../index';

/* ===========================================================================
   THE MODEL BOUNDARY, DOOR TWO

   The live reader accepts a page the reader pastes. That is the one place
   arbitrary text meets the model, so the shape check is tested at its edges.
   =========================================================================== */

const PAGE = 'EXT. HILLFORT, GATE — DAWN\n\nA column of riders waits below the gate. THE SMITH opens it from inside.';

describe('what a pasted page may be', () => {
  it('accepts a page that starts with a slugline', () => {
    expect(pageShapeProblem(PAGE)).toBeNull();
    const req = buildLiveBreakdownRequest(PAGE);
    expect(Object.keys(req).sort()).toEqual(['contract', 'pages']);
    expect(req.pages).toEqual([PAGE]);
  });

  it('accepts INT./EXT. and I/E sluglines', () => {
    expect(pageShapeProblem('INT./EXT. CAR — DAY\n\nThey drive.')).toBeNull();
    expect(pageShapeProblem('I/E CAR — DAY\n\nThey drive.')).toBeNull();
  });
});

describe('what it may not be', () => {
  it('refuses text with no slugline', () => {
    expect(pageShapeProblem('Maelor rides to the ford.')).toMatch(/slugline/);
    expect(() => buildLiveBreakdownRequest('Maelor rides to the ford.')).toThrow(/slugline/);
  });

  it('refuses a page carrying an email address', () => {
    expect(pageShapeProblem(`${PAGE}\n\nagent: jane.doe@example.com`)).toMatch(/email/);
  });

  it('refuses a page carrying a rate, however it is written', () => {
    expect(pageShapeProblem(`${PAGE}\n\nCYNAN $25,000`)).toMatch(/rate|amount/);
    expect(pageShapeProblem(`${PAGE}\n\n12,000 GBP`)).toMatch(/rate|amount/);
    expect(pageShapeProblem(`${PAGE}\n\nper day`)).toMatch(/rate|amount/);
  });

  it('refuses a phone number, a passport, a crew identifier, and a document that is not a scene', () => {
    expect(pageShapeProblem(`${PAGE}\n\n+36 30 123 4567`)).toMatch(/phone/);
    expect(pageShapeProblem(`${PAGE}\n\npassport on file`)).toMatch(/identity/);
    expect(pageShapeProblem(`${PAGE}\n\nCR-1A2B3C`)).toMatch(/identifier/);
    expect(pageShapeProblem(`${PAGE}\n\nDeal memo attached`)).toMatch(/production document/);
  });

  it('refuses the empty, the enormous, and the non-string', () => {
    expect(pageShapeProblem('   ')).toMatch(/empty/);
    expect(pageShapeProblem(`EXT. X — DAY\n\n${'a'.repeat(LIVE_PAGE_MAX_CHARS)}`)).toMatch(/longer/);
    expect(() => buildLiveBreakdownRequest(null)).toThrow();
    expect(() => buildLiveBreakdownRequest({ text: PAGE })).toThrow();
  });
});

describe('turning quotes into spans', () => {
  it('finds a quote on the page and lights it', () => {
    const facts = factsFromQuotes(PAGE, { facts: [{ key: 'cast', value: '21 THE SMITH', conf: 0.9, quote: 'THE SMITH' }] });
    expect(facts[0]!.span).toEqual({ start: PAGE.indexOf('THE SMITH'), end: PAGE.indexOf('THE SMITH') + 'THE SMITH'.length });
  });

  it('keeps an inferred fact as inferred', () => {
    const facts = factsFromQuotes(PAGE, { facts: [{ key: 'locked_to_light', value: 'yes', conf: 0.8, quote: null }] });
    expect(facts[0]!.span).toBeNull();
  });

  it('downgrades a quote that is not on the page rather than lighting the wrong words', () => {
    const facts = factsFromQuotes(PAGE, { facts: [{ key: 'animals', value: 'horses', conf: 0.95, quote: 'thirty horses' }] });
    expect(facts[0]!.span).toBeNull();
    expect(facts[0]!.conf).toBeLessThanOrEqual(0.5);
    expect(facts[0]!.note).toMatch(/not on the page/);
  });

  it('clamps confidence and drops facts with no key or value', () => {
    const facts = factsFromQuotes(PAGE, { facts: [{ key: 'set', value: 'HILLFORT', conf: 7, quote: 'HILLFORT' }, { key: '', value: 'x', conf: 0.5, quote: null }] });
    expect(facts).toHaveLength(1);
    expect(facts[0]!.conf).toBe(1);
  });

  it('refuses a response with no facts array', () => {
    expect(() => factsFromQuotes(PAGE, { nope: [] })).toThrow(/facts array/);
  });
});

describe('the terminal path: a reply pasted back', () => {
  const facts = { facts: [{ key: 'int_ext', value: 'EXT', conf: 0.99, quote: 'EXT.', note: null }] };
  const reply = {
    id: 'msg_01',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-5',
    content: [{ type: 'text', text: JSON.stringify(facts) }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 812, output_tokens: 140 },
  };

  it('reads the whole reply curl printed, with the model and the token counts', () => {
    const r = parseModelReply(JSON.stringify(reply));
    expect(r.model).toBe('claude-sonnet-5');
    expect(r.inTokens).toBe(812);
    expect(r.outTokens).toBe(140);
    expect(r.refusal).toBeNull();
    expect(factsFromQuotes(PAGE, r.output)[0]?.span).toEqual({ start: 0, end: 4 });
  });

  it('reads a bare facts object too', () => {
    const r = parseModelReply(JSON.stringify(facts));
    expect(r.model).toBeNull();
    expect(factsFromQuotes(PAGE, r.output)).toHaveLength(1);
  });

  it('carries a refusal instead of inventing facts', () => {
    const r = parseModelReply(JSON.stringify({ ...reply, content: [], stop_reason: 'refusal', stop_details: { explanation: 'not a script' } }));
    expect(r.refusal).toBe('not a script');
    expect(r.output).toBeNull();
  });

  it('turns an API error into a sentence and refuses fragments and non-JSON', () => {
    expect(() => parseModelReply(JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }))).toThrow(/invalid x-api-key/);
    expect(() => parseModelReply('not json')).toThrow(/not JSON/);
    expect(() => parseModelReply('[1,2]')).toThrow(/not an object/);
    expect(() => parseModelReply(JSON.stringify({ ...reply, content: [{ type: 'text', text: 'plain prose' }] }))).toThrow(/not the JSON/);
    expect(() => parseModelReply(JSON.stringify({ ...reply, content: [] }))).toThrow(/no text/);
  });
});
