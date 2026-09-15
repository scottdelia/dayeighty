import type { BreakdownFact, SceneBreakdown, Span } from './types';

/* ===========================================================================
   BREAKDOWN — THE PROBABILISTIC HALF

   A scene page is prose. A writer typed "Thirty riders cross under fog. Two
   horses lose their footing" at some point in a draft, and in doing so
   encoded a background count, an animal booking, two stunt performers, a
   water safety team and a weather dependency, in English, in a field whose
   schema is `string`. Reading that back out is genuinely hard and genuinely
   model-shaped.

   Deciding whether those riders can be moved to Tuesday is not. It is a
   calendar, a permit window and a contract, it has to be reproducible, and
   an assistant director may have to defend it to a completion bond company.
   That lives in `reslot.ts`, and no model runs there.

   THE BOUNDARY IS THE PRODUCT. Two doors exist between this system and a
   language model, and both accept nothing but scene page text.
   `buildBreakdownRequest` takes pages from the script. `buildLiveBreakdownRequest`
   takes a page the reader pastes, and checks that it is shaped like one and
   carries nothing that is not. Not a crew record, not a cast contract, not a
   call sheet, not a rate. Passing anything else throws. `boundary.test.ts`
   fails the build if that stops being true.

   THE PAGES ARE INVENTED, and so are the people in them. None is from any
   script, book or show.
   =========================================================================== */

export const BREAKDOWN_CONTRACT = `You will be given the text of a single scene from a shooting script and
nothing else. You will never be given crew records, cast contracts, rates,
schedules or call sheets, and you must not ask for any.

Return JSON only, no prose, of the shape:
  { "facts": [ { "key", "value", "conf", "quote", "note"? } ] }

Keys to extract where the page supports them:
  int_ext, set, time_of_day, cast, background, animals, stunts, water,
  fire, weather_dependent, locked_to_light, minor_present, prep_days,
  continuity, props, second_unit

Rules:
- "quote" must be the EXACT words from the page the fact was read from, or
  null if the fact was inferred from what the page implies rather than
  states. Inferred facts are required, not optional: an exterior at dawn is
  locked to the light whether or not the writer says so, and you must say so
  and mark it null.
- "conf" is 0..1 and must be honestly calibrated. Low confidence is useful
  information, not failure.
- Do not infer a shoot date. Do not infer a cost. Pages know neither.`;

/** Half-open character range of `needle` within `text`. Throws if absent. */
function span(text: string, needle: string): Span {
  const start = text.indexOf(needle);
  if (start < 0) {
    // Module-load assertion. A span that does not exist in its own page would
    // render a highlight over the wrong words, which is worse than no highlight.
    throw new Error(`breakdown.ts: span "${needle}" not found in page`);
  }
  return { start, end: start + needle.length };
}

function page(sceneNumber: string, text: string, build: (t: string) => SceneBreakdown['facts']): SceneBreakdown {
  return { sceneNumber, text, facts: build(text) };
}

/* ---------------------------------------------------------------------------
   The pages.
   --------------------------------------------------------------------------- */
const B: SceneBreakdown[] = [
  page(
    '61',
    'EXT. RIVER FORD — DAWN\n\nFog on the water. MAELOR rides into the shallows at the head of THIRTY RIDERS, BRIOC at his shoulder, CYNAN a length behind. The far bank is a rumor. The column goes in to the horses\' chests and the fog closes behind them.',
    (t) => [
      { key: 'int_ext', value: 'EXT', conf: 0.99, span: span(t, 'EXT.') },
      { key: 'set', value: 'RIVER FORD', conf: 0.98, span: span(t, 'RIVER FORD') },
      { key: 'time_of_day', value: 'DAWN', conf: 0.98, span: span(t, 'DAWN') },
      { key: 'cast', value: '1 MAELOR · 3 BRIOC · 7 CYNAN', conf: 0.96, span: span(t, 'MAELOR rides into the shallows at the head of THIRTY RIDERS, BRIOC at his shoulder, CYNAN') },
      { key: 'background', value: '30 riders, mounted', conf: 0.94, span: span(t, 'THIRTY RIDERS') },
      { key: 'animals', value: '33 horses (30 riders, 3 principals)', conf: 0.86, span: span(t, 'rides'), note: 'The page counts riders, not horses. Three principals are also mounted; the head wrangler will want the number, not the sentence.' },
      { key: 'water', value: 'performers in moving water', conf: 0.9, span: span(t, "goes in to the horses' chests"), note: 'A safety diver team is on the call sheet or the scene is not.' },
      { key: 'locked_to_light', value: 'yes — dawn happens once per day', conf: 0.88, span: null, note: 'Inferred. This scene cannot be absorbed into another day as overtime; it needs a morning of its own.' },
      { key: 'weather_dependent', value: 'yes', conf: 0.8, span: span(t, 'Fog on the water'), note: 'Fog is a lighting condition the day cannot promise. The scene shoots in fog or in something that will have to be graded to look like fog.' },
      { key: 'second_unit', value: 'the crossing, with doubles', conf: 0.6, span: null, note: 'Inferred. A wide of a column in fog is a second unit\'s trade. Any close-up of a principal still needs the main unit, and the page does not say how tight the director wants to be.' },
      { key: 'stunts', value: 'none on this page', conf: 0.8, span: null, note: 'Inferred from absence. The falls are in the next scene, in daylight, where a stunt coordinator can see the stones.' },
      { key: 'prep_days', value: 'none stated', conf: 0.5, span: null, note: 'Nothing on the page needs building. Everything on it needs booking.' },
    ],
  ),
  page(
    '62',
    'EXT. RIVER FORD — DAY\n\nThe column halts mid-stream. TANWEN reads the water the way other people read faces. TUDWAL wants to press on; CYNAN wants to turn back. Two horses lose their footing on the stones and go down in the current; their riders come up shouting. MAELOR says nothing and watches the far bank. BRIOC counts the riders twice and gets two different numbers.',
    (t) => [
      { key: 'int_ext', value: 'EXT', conf: 0.99, span: span(t, 'EXT.') },
      { key: 'set', value: 'RIVER FORD', conf: 0.98, span: span(t, 'RIVER FORD') },
      { key: 'time_of_day', value: 'DAY', conf: 0.97, span: span(t, 'DAY') },
      { key: 'cast', value: '1 MAELOR · 2 TANWEN · 3 BRIOC · 7 CYNAN · 12 TUDWAL', conf: 0.95, span: span(t, 'TANWEN reads the water the way other people read faces. TUDWAL wants to press on; CYNAN wants to turn back. Two horses lose their footing on the stones and go down in the current; their riders come up shouting. MAELOR says nothing and watches the far bank. BRIOC') },
      { key: 'stunts', value: '2 horse falls', conf: 0.92, span: span(t, 'Two horses lose their footing on the stones and go down') },
      { key: 'background', value: '30 riders, carried from scene 61', conf: 0.62, span: span(t, 'The column'), note: 'The count is not on this page. It is on the previous one, and continuity says it is the same column. Confidence is held down because a reader who assumes continuity is a reader who books the wrong number.' },
      { key: 'water', value: 'performers in moving water', conf: 0.84, span: span(t, 'mid-stream') },
      { key: 'animals', value: '35 horses', conf: 0.7, span: null, note: 'Inferred from "the column" and "riders". Nobody on the page dismounts.' },
      { key: 'second_unit', value: 'no — five principals, all speaking', conf: 0.85, span: null, note: 'Inferred. This is a dialogue scene with faces in it. The falls could be picked up as inserts by a second unit; the scene is main unit.' },
      { key: 'weather_dependent', value: 'yes', conf: 0.75, span: null, note: 'Inferred from EXT. Continuity with 61 means the weather has to match a scene that has not been shot yet.' },
    ],
  ),
  page(
    '63',
    "EXT. RIVER FORD, FAR BANK — DAY\n\nBRIOC and two SCOUTS haul a drowned cart out of the reeds. What's under the sacking is not cargo.",
    (t) => [
      { key: 'int_ext', value: 'EXT', conf: 0.99, span: span(t, 'EXT.') },
      { key: 'set', value: 'RIVER FORD, FAR BANK', conf: 0.98, span: span(t, 'RIVER FORD, FAR BANK') },
      { key: 'time_of_day', value: 'DAY', conf: 0.97, span: span(t, 'DAY') },
      { key: 'cast', value: '3 BRIOC · 14 FIRST SCOUT · 15 SECOND SCOUT', conf: 0.9, span: span(t, 'BRIOC and two SCOUTS') },
      { key: 'water', value: 'performers at the water margin', conf: 0.72, span: span(t, 'haul a drowned cart out of the reeds'), note: 'Reeds are the water margin. Whether anyone is in the water is a blocking decision, and the safety team is booked either way.' },
      { key: 'props', value: 'cart, sacking, a body double or dummy', conf: 0.66, span: span(t, "What's under the sacking is not cargo."), note: 'The page will not say what is under the sacking. Props will need to know by Tuesday.' },
      { key: 'second_unit', value: 'yes, with a double for BRIOC', conf: 0.7, span: null, note: 'Inferred. No dialogue, two day players, a physical action. The one principal can be doubled from behind.' },
      { key: 'animals', value: 'none on this page', conf: 0.8, span: null, note: 'Inferred from absence. No riders, no horses. This scene can shoot without the horse package.' },
    ],
  ),
  page(
    '64',
    "EXT. RIVER FORD — DUSK\n\nMAELOR alone at the water's edge. The boy IEUAN, eleven, runs the length of the bank to reach him with a message he is too winded to deliver. Maelor waits. The light goes.",
    (t) => [
      { key: 'int_ext', value: 'EXT', conf: 0.99, span: span(t, 'EXT.') },
      { key: 'set', value: 'RIVER FORD', conf: 0.98, span: span(t, 'RIVER FORD') },
      { key: 'time_of_day', value: 'DUSK', conf: 0.98, span: span(t, 'DUSK') },
      { key: 'cast', value: '1 MAELOR · 9 IEUAN', conf: 0.96, span: span(t, "MAELOR alone at the water's edge. The boy IEUAN") },
      { key: 'minor_present', value: 'yes — a child of eleven', conf: 0.95, span: span(t, 'eleven'), note: 'A child\'s day is capped in hours and has a latest wrap. Dusk in late March is inside both, but only just, and only if the call is late.' },
      { key: 'water', value: 'none — at the edge, not in it', conf: 0.8, span: span(t, "at the water's edge"), note: 'Nobody goes in. If the river is up, this scene can still shoot; the ones with people in the water cannot.' },
      { key: 'locked_to_light', value: 'yes — dusk happens once per day', conf: 0.9, span: span(t, 'The light goes.'), note: 'Cannot be absorbed as overtime into a day that already has a dusk scene.' },
      { key: 'background', value: 'none', conf: 0.85, span: span(t, 'alone') },
      { key: 'weather_dependent', value: 'yes', conf: 0.7, span: null, note: 'Inferred from EXT.' },
    ],
  ),
  page(
    '101',
    'INT. FOREST HOUSE — DAY\n\nTANWEN at the loom. MAELOR in the doorway, not yet asked in. She does not look up. "You brought the river with you," she says. He is still wet.',
    (t) => [
      { key: 'int_ext', value: 'INT', conf: 0.99, span: span(t, 'INT.') },
      { key: 'set', value: 'FOREST HOUSE', conf: 0.98, span: span(t, 'FOREST HOUSE') },
      { key: 'time_of_day', value: 'DAY', conf: 0.97, span: span(t, 'DAY') },
      { key: 'cast', value: '2 TANWEN · 1 MAELOR', conf: 0.96, span: span(t, 'TANWEN at the loom. MAELOR') },
      { key: 'continuity', value: 'costume: wet, from the ford', conf: 0.82, span: span(t, 'He is still wet.'), note: 'Costume needs the wet-look double of his ford costume. No water work; a spray bottle.' },
      { key: 'props', value: 'a loom, dressed and working', conf: 0.8, span: span(t, 'the loom') },
      { key: 'weather_dependent', value: 'no', conf: 0.95, span: null, note: 'Inferred from INT. A stage does not care what the sky is doing, which is the whole point of a cover set.' },
      { key: 'background', value: 'none', conf: 0.85, span: null, note: 'Inferred from absence.' },
    ],
  ),
  page(
    '102',
    'INT. FOREST HOUSE — DAY\n\nIEUAN asleep by the fire. TANWEN banks the embers, covers him, and goes out into the rain.',
    (t) => [
      { key: 'int_ext', value: 'INT', conf: 0.99, span: span(t, 'INT.') },
      { key: 'set', value: 'FOREST HOUSE', conf: 0.98, span: span(t, 'FOREST HOUSE') },
      { key: 'time_of_day', value: 'DAY', conf: 0.97, span: span(t, 'DAY') },
      { key: 'cast', value: '9 IEUAN · 2 TANWEN', conf: 0.96, span: span(t, 'IEUAN asleep by the fire. TANWEN') },
      { key: 'minor_present', value: 'yes', conf: 0.9, span: span(t, 'IEUAN asleep'), note: 'Interior, daytime: comfortably inside a child\'s hours if he is called after school.' },
      { key: 'fire', value: 'practical fire on stage', conf: 0.85, span: span(t, 'by the fire'), note: 'A practical fire on a stage puts the fire officer on the call sheet.' },
      { key: 'weather_dependent', value: 'no — the rain is outside the door', conf: 0.8, span: span(t, 'out into the rain'), note: 'A rain rig at the doorway, or a sound effect. SFX would like to know which.' },
    ],
  ),
  page(
    '103',
    'INT. FOREST HOUSE — NIGHT\n\nRain on the thatch. MAELOR and TANWEN at the table, in low voices, so as not to wake the boy.',
    (t) => [
      { key: 'int_ext', value: 'INT', conf: 0.99, span: span(t, 'INT.') },
      { key: 'set', value: 'FOREST HOUSE', conf: 0.98, span: span(t, 'FOREST HOUSE') },
      { key: 'time_of_day', value: 'NIGHT', conf: 0.97, span: span(t, 'NIGHT') },
      { key: 'cast', value: '1 MAELOR · 2 TANWEN', conf: 0.96, span: span(t, 'MAELOR and TANWEN') },
      { key: 'minor_present', value: 'not called — asleep, off camera', conf: 0.55, span: span(t, 'so as not to wake the boy'), note: 'The boy is in the room in the story. Whether he is in the frame is a directing decision, and it decides whether a child is on the call sheet. Ask.' },
      { key: 'weather_dependent', value: 'no — rain is a rig or a sound effect', conf: 0.66, span: span(t, 'Rain on the thatch'), note: 'The page does not say which. SFX would like to know before they load the truck.' },
    ],
  ),
  page(
    '88',
    'INT. ABBEY SCRIPTORIUM — NIGHT\n\nPADARN copying by candlelight. TANWEN at the door with a message. He finishes the line before he looks up.',
    (t) => [
      { key: 'int_ext', value: 'INT', conf: 0.99, span: span(t, 'INT.') },
      { key: 'set', value: 'ABBEY SCRIPTORIUM', conf: 0.98, span: span(t, 'ABBEY SCRIPTORIUM') },
      { key: 'time_of_day', value: 'NIGHT', conf: 0.97, span: span(t, 'NIGHT') },
      { key: 'cast', value: '5 PADARN · 2 TANWEN', conf: 0.96, span: span(t, 'PADARN copying by candlelight. TANWEN') },
      { key: 'fire', value: 'candles, practical', conf: 0.8, span: span(t, 'candlelight'), note: 'Naked flame on a paper-dressed set. Fire officer.' },
      { key: 'props', value: 'the book being copied (hero prop), quills, ink', conf: 0.85, span: span(t, 'copying') },
    ],
  ),
  page(
    '89',
    'INT. ABBEY SCRIPTORIUM — NIGHT (CONTINUOUS)\n\nMAELOR in the doorway, snow on his shoulders. He takes the book from PADARN without asking and reads the last line aloud.',
    (t) => [
      { key: 'int_ext', value: 'INT', conf: 0.99, span: span(t, 'INT.') },
      { key: 'set', value: 'ABBEY SCRIPTORIUM', conf: 0.98, span: span(t, 'ABBEY SCRIPTORIUM') },
      { key: 'time_of_day', value: 'NIGHT', conf: 0.97, span: span(t, 'NIGHT') },
      { key: 'continuity', value: 'continuous with 88 — same day, same setup', conf: 0.93, span: span(t, '(CONTINUOUS)'), note: 'Moving one of these moves both.' },
      { key: 'cast', value: '1 MAELOR · 5 PADARN · 2 TANWEN (present from 88)', conf: 0.88, span: span(t, 'MAELOR in the doorway, snow on his shoulders. He takes the book from PADARN'), note: 'Tanwen is not named on this page. She was in the room at the end of the last one.' },
      { key: 'props', value: 'the book; snow dressing on costume', conf: 0.8, span: span(t, 'snow on his shoulders') },
    ],
  ),
  page(
    '95',
    'INT. GREAT HALL — NIGHT\n\nThe feast. Sixty guests, a boar on the spit, fire the length of the hall. EINION on the high seat, CYNAN beside him. NEST watches from the far end. MAELOR, TANWEN and BRIOC enter late and the hall goes quiet.',
    (t) => [
      { key: 'int_ext', value: 'INT', conf: 0.99, span: span(t, 'INT.') },
      { key: 'set', value: 'GREAT HALL', conf: 0.98, span: span(t, 'GREAT HALL') },
      { key: 'time_of_day', value: 'NIGHT', conf: 0.97, span: span(t, 'NIGHT') },
      { key: 'cast', value: '6 EINION · 7 CYNAN · 10 NEST · 1 MAELOR · 2 TANWEN · 3 BRIOC', conf: 0.95, span: span(t, 'EINION on the high seat, CYNAN beside him. NEST watches from the far end. MAELOR, TANWEN and BRIOC') },
      { key: 'background', value: '60 feast guests', conf: 0.94, span: span(t, 'Sixty guests') },
      { key: 'fire', value: 'open fire, full length of the set', conf: 0.9, span: span(t, 'fire the length of the hall') },
      { key: 'prep_days', value: '2 — feast dressing and food styling', conf: 0.62, span: span(t, 'a boar on the spit'), note: 'Inferred from the dressing. A feast for sixty is two days of set decoration and a food stylist, and none of it is on the page as a number.' },
    ],
  ),
  page(
    '96',
    'INT. GREAT HALL — NIGHT\n\nLater. The hall half-empty and the fire low. CYNAN asks MAELOR a question he does not answer. NEST, from the shadows, hears every word.',
    (t) => [
      { key: 'int_ext', value: 'INT', conf: 0.99, span: span(t, 'INT.') },
      { key: 'set', value: 'GREAT HALL', conf: 0.98, span: span(t, 'GREAT HALL') },
      { key: 'time_of_day', value: 'NIGHT', conf: 0.97, span: span(t, 'NIGHT') },
      { key: 'cast', value: '7 CYNAN · 1 MAELOR · 10 NEST', conf: 0.95, span: span(t, 'CYNAN asks MAELOR a question he does not answer. NEST') },
      { key: 'background', value: 'about 30 — "half-empty"', conf: 0.5, span: span(t, 'half-empty'), note: 'Half of sixty is a guess wearing a number\'s clothes. The director will have a number; the page does not.' },
      { key: 'fire', value: 'fire, continuity from 95, burning low', conf: 0.85, span: span(t, 'the fire low') },
    ],
  ),
];

const BY_SCENE = new Map(B.map((b) => [b.sceneNumber, b]));
const KNOWN_TEXTS = new Set(B.map((b) => b.text));

/**
 * The precomputed breakdown for a hand-written scene.
 *
 * Returns undefined for anything else, and callers must handle that by SAYING
 * SO rather than by falling back to a default. Returning a neighboring
 * scene's facts for a page the reader has never seen is a lie they can see.
 */
export function breakdownFor(sceneNumber: string): SceneBreakdown | undefined {
  return BY_SCENE.get(sceneNumber);
}

export function allBreakdowns(): readonly SceneBreakdown[] {
  return B;
}

export function isKnownSceneText(text: string): boolean {
  return KNOWN_TEXTS.has(text);
}

export const UNSEEN_SCENE_REFUSAL =
  'This page has not been read. The reader returns nothing rather than returning the facts of a scene that looks similar, because a breakdown built from the wrong page books the wrong horses.';

/* ===========================================================================
   THE MODEL BOUNDARY, DOOR ONE: PAGES FROM THE SCRIPT

   Everything above is precomputed so this page runs offline with no key in
   client-side code. The function below is what would cross the wire, and its
   signature is the security control: it takes scene text, it validates that
   is what it got, and there is no parameter through which a crew record, a
   cast contract or a call sheet could travel even by accident.
   =========================================================================== */

export interface BreakdownRequest {
  contract: string;
  /** Scene page text. Nothing else is representable here. */
  pages: string[];
}

/**
 * Build the payload that would be sent to a model.
 *
 * Runtime-validated rather than merely typed, because `unknown` is what
 * actually arrives at a boundary: types are erased at the wire and the caller
 * one refactor from now may not be this file's author.
 *
 * @throws if any element is not a string, or is not a page in the script.
 */
export function buildBreakdownRequest(input: readonly unknown[]): BreakdownRequest {
  const pages: string[] = [];
  for (const item of input) {
    if (typeof item !== 'string') {
      throw new Error(
        `breakdown boundary: refused a ${item === null ? 'null' : typeof item}. ` +
          'Only scene page text crosses this boundary. If you are holding a crew record, a cast ' +
          'contract or a call sheet, you are holding the wrong thing.',
      );
    }
    if (!isKnownSceneText(item)) {
      throw new Error(
        `breakdown boundary: refused "${truncate(item)}" — not a page in the script. ` +
          'Arbitrary strings are refused here so that a field carrying a rate or a name cannot ' +
          'reach a model by being renamed.',
      );
    }
    pages.push(item);
  }
  return { contract: BREAKDOWN_CONTRACT, pages };
}

function truncate(s: string): string {
  return s.length <= 40 ? s : `${s.slice(0, 40)}…`;
}

/**
 * Build the outbound payload for a set of scenes and inspect it for anything
 * that should not be there. The page prints the result; the test asserts it.
 */
export function inspectModelBoundary(sceneNumbers: readonly string[], forbiddenKeys: readonly string[]): {
  payloadKeys: string[];
  pagesSent: number;
  forbiddenKeysFound: string[];
} {
  const pages = sceneNumbers.map((n) => breakdownFor(n)?.text).filter((t): t is string => typeof t === 'string');
  const req = buildBreakdownRequest(pages);
  const json = JSON.stringify(req);
  const found = forbiddenKeys.filter((k) => json.includes(`"${k}"`));
  return { payloadKeys: Object.keys(req), pagesSent: req.pages.length, forbiddenKeysFound: found };
}

/* ===========================================================================
   THE MODEL BOUNDARY, DOOR TWO: A PAGE THE READER PASTES

   The live reader lets someone paste any scene and watch it break down. That
   is the demo's most persuasive moment and its most dangerous door, because
   "any text" is exactly what a boundary must not accept. So this door checks
   shape: the text has to start with a slugline, has to be short enough to be
   a scene, and must not carry an email address, a rate, a phone number, a
   payment or identity term, or a crew identifier. Text that fails is refused
   with the reason, before anything is built.

   This is a shape check, not a content check. It cannot know that a paragraph
   of prose is secretly a contract. It can guarantee that the things a contract
   is made of — amounts, identifiers, contact details — do not pass, and that
   nothing shaped like a record does.
   =========================================================================== */

export const LIVE_PAGE_MAX_CHARS = 4000;

/* INT. / EXT. / INT./EXT. / EXT./INT. / I/E, then at least one word. A page
   that starts "I am" does not match: the bare I is accepted only as I/E. */
const SLUGLINE = /^\s*(INT|EXT|I\s*\/\s*E)\.?(\s*\/\s*(INT|EXT)\.?)?\s+\S/i;

const REFUSALS: readonly { re: RegExp; why: string }[] = [
  { re: /[\w.+-]+@[\w-]+\.[\w.-]+/, why: 'it contains an email address' },
  { re: /[$€£]\s?\d|\b\d[\d,]*(\.\d+)?\s?(USD|EUR|GBP|HUF|CAD|AUD)\b|\bper\s+(day|week|hour|episode)\b/i, why: 'it contains a rate or an amount of money' },
  { re: /(\+|\b)\d[\d\s().-]{8,}\d\b/, why: 'it contains what looks like a phone number' },
  { re: /\b(IBAN|BIC|SWIFT|passport|sort code|routing number|account number|SSN|social security|date of birth|DOB)\b/i, why: 'it contains a payment or identity term' },
  { re: /\bCR-[0-9A-F]{6}\b/, why: 'it contains a crew identifier' },
  { re: /\b(deal memo|day rate|weekly rate|call sheet|timesheet|time card|pickup:|p\/u:)\b/i, why: 'it looks like a production document, not a scene' },
];

/** Why a pasted text may not cross to a model, or null if it may. */
export function pageShapeProblem(text: string): string | null {
  if (text.trim().length === 0) return 'it is empty';
  if (text.length > LIVE_PAGE_MAX_CHARS) return `it is longer than a scene (${text.length} characters; the limit is ${LIVE_PAGE_MAX_CHARS})`;
  if (!SLUGLINE.test(text)) return 'it does not start with a slugline (INT. or EXT.)';
  for (const r of REFUSALS) if (r.re.test(text)) return r.why;
  return null;
}

/**
 * Build the payload for a pasted page.
 *
 * @throws if the input is not a string shaped like a scene page.
 */
export function buildLiveBreakdownRequest(input: unknown): BreakdownRequest {
  if (typeof input !== 'string') {
    throw new Error(`breakdown boundary: refused a ${input === null ? 'null' : typeof input}. Only scene page text crosses this boundary.`);
  }
  const problem = pageShapeProblem(input);
  if (problem) {
    throw new Error(`breakdown boundary: refused the page because ${problem}. Only text shaped like a scene crosses, and nothing that carries a rate, an identifier or a contact detail.`);
  }
  return { contract: BREAKDOWN_CONTRACT, pages: [input] };
}

/**
 * Turn the model's quotes into spans against the page it read.
 *
 * Models are unreliable at character offsets and reliable at quoting, so the
 * contract asks for quotes and this function finds them. A quote that is not
 * on the page is not a span; it is downgraded to an inferred fact with a note
 * saying so, because a highlight over the wrong words is worse than none.
 */
export function factsFromQuotes(text: string, raw: unknown): BreakdownFact[] {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { facts?: unknown }).facts)) {
    throw new Error('breakdown: the reader did not return a facts array');
  }
  const out: BreakdownFact[] = [];
  for (const item of (raw as { facts: unknown[] }).facts) {
    if (!item || typeof item !== 'object') continue;
    const f = item as Record<string, unknown>;
    const key = typeof f.key === 'string' ? f.key.trim() : '';
    const value = typeof f.value === 'string' ? f.value : String(f.value ?? '');
    if (!key || !value) continue;
    const confRaw = typeof f.conf === 'number' ? f.conf : Number(f.conf);
    const conf = Number.isFinite(confRaw) ? Math.max(0, Math.min(1, confRaw)) : 0.5;
    const note = typeof f.note === 'string' && f.note.trim() ? f.note.trim() : undefined;
    const quote = typeof f.quote === 'string' && f.quote.trim() ? f.quote.trim() : null;
    if (quote === null) {
      out.push({ key, value, conf, span: null, note });
      continue;
    }
    const start = text.indexOf(quote);
    if (start < 0) {
      out.push({
        key,
        value,
        conf: Math.min(conf, 0.5),
        span: null,
        note: `${note ? `${note} ` : ''}The reader quoted words that are not on the page ("${quote.slice(0, 40)}${quote.length > 40 ? '…' : ''}"). Treated as inferred, and worth checking.`,
      });
      continue;
    }
    out.push({ key, value, conf, span: { start, end: start + quote.length }, note });
  }
  return out;
}

/* ---------------------------------------------------------------------------
   THE TERMINAL PATH

   Some organizations' settings refuse API calls made from a browser. The
   same request then goes out from the reader's own terminal, and what curl
   prints is pasted back here. The key never touches this page at all.

   This parses either the whole Messages API reply or the bare facts object
   the model returned, and refuses everything else with a plain sentence.
   --------------------------------------------------------------------------- */
export interface PastedReply {
  /** The facts object as the model returned it, before `factsFromQuotes`. Null on a refusal. */
  output: unknown;
  model: string | null;
  inTokens: number | null;
  outTokens: number | null;
  /** The model's stated reason for declining, if it declined. */
  refusal: string | null;
}

export function parseModelReply(raw: string): PastedReply {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.trim());
  } catch {
    throw new Error('That is not JSON. Paste the whole reply the terminal printed, from the first { to the last }.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('The reply is not an object. Paste the whole reply, not a fragment.');
  const r = parsed as Record<string, unknown>;
  if (Array.isArray(r.facts)) return { output: parsed, model: null, inTokens: null, outTokens: null, refusal: null };
  if (r.type === 'error') {
    const err = r.error as Record<string, unknown> | undefined;
    throw new Error(`The API returned an error, not a reading: ${typeof err?.message === 'string' ? err.message : JSON.stringify(r.error)}`);
  }
  const usage = r.usage as Record<string, unknown> | undefined;
  const model = typeof r.model === 'string' ? r.model : null;
  const inTokens = typeof usage?.input_tokens === 'number' ? usage.input_tokens : null;
  const outTokens = typeof usage?.output_tokens === 'number' ? usage.output_tokens : null;
  if (r.stop_reason === 'refusal') {
    const d = r.stop_details as Record<string, unknown> | undefined;
    return { output: null, model, inTokens, outTokens, refusal: typeof d?.explanation === 'string' ? d.explanation : 'no explanation given' };
  }
  const content = Array.isArray(r.content) ? r.content : [];
  const textBlock = content.find((b) => b && typeof b === 'object' && (b as Record<string, unknown>).type === 'text' && typeof (b as Record<string, unknown>).text === 'string') as
    | Record<string, unknown>
    | undefined;
  if (!textBlock) throw new Error('The reply has no text in it to read. Paste the whole reply the terminal printed.');
  let output: unknown;
  try {
    output = JSON.parse(textBlock.text as string);
  } catch {
    throw new Error("The model's text was not the JSON the contract asks for. Nothing was rendered, because rendering a guess is worse than rendering nothing.");
  }
  return { output, model, inTokens, outTokens, refusal: null };
}
