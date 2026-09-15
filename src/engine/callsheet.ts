import type { CallSheet, CallSheetCast, CallSheetDiff, CallSheetScene, Placement, ReslotOption, Revision } from './types';
import { castByNumber } from './cast';
import { locationById } from './locations';
import { ASSUMED, daylightFor, hhmmToMinutes, minutesToHhmm, clock } from './production';
import { SHOOT_DAYS, castIn, sceneByNumber, shootDay, slugOf } from './script';
import { forecastFor } from './reslot';

/* ===========================================================================
   THE CALL SHEET

   The one document every one of three hundred people reads every night. It is
   generated here from the stripboard and the cast list, which means a revised
   one can be generated the same way, from a revised stripboard, in the time it
   takes to click. What it cannot do is decide what goes on it. That is the
   producer's job, and the option they choose is the input.
   =========================================================================== */

/** Unit on set on an ordinary day. Assumed; the crew list has 306 and not all of them are on the floor. */
const ASSUMED_ON_SET_CREW = 214;

function weatherLineFor(day: number, locationId: string): string {
  const loc = locationById(locationId);
  const f = forecastFor(day);
  if (loc.kind === 'stage') return `Stage day. Forecast: ${f.summary} Relevant to the drive in, not to the day.`;
  return `${f.summary} ${f.rainIn.toFixed(1)} in of rain, wind ${f.windMph} mph.${f.clearsAt ? ` Clearing about ${clock(f.clearsAt)}.` : ''}`;
}

/** A split day has two weathers: the stage's, which is none, and the location's after the move. */
function weatherLineForSplit(day: number, fromLocationId: string, toLocationId: string): string {
  const from = locationById(fromLocationId);
  const to = locationById(toLocationId);
  const f = forecastFor(day);
  return `${from.name} until the move. ${to.name} from ${f.clearsAt ? clock(f.clearsAt) : 'the afternoon'}: ${f.summary} ${f.rainIn.toFixed(1)} in of rain, wind ${f.windMph} mph. Wet-weather gear. Water safety lead on the afternoon call.`;
}

function castRows(scenes: readonly CallSheetScene[], firstOnSet: string, travelMinutes: number, day: number): CallSheetCast[] {
  const first = new Map<number, number>();
  let cursor = hhmmToMinutes(firstOnSet);
  for (const sc of scenes) {
    for (const n of sc.cast) if (!first.has(n)) first.set(n, cursor);
    cursor += Math.round((sc.eighths / ASSUMED.assumed_eighths_per_hour) * 60);
  }
  return [...first.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([n, onSetMin]) => {
      const c = castByNumber(n);
      const makeupMin = onSetMin - 90;
      const pickupMin = makeupMin - travelMinutes - 15;
      return {
        number: n,
        character: c.character,
        pickup: minutesToHhmm(pickupMin),
        makeup: minutesToHhmm(makeupMin),
        onSet: minutesToHhmm(onSetMin),
        status: c.contractFrom === day ? 'SW' : c.contractTo === day ? 'WF' : 'W',
        minor: c.minor,
      };
    });
}

function notesFor(sceneNumbers: readonly string[], locationId: string, day: number): string[] {
  const notes: string[] = [];
  const full = sceneNumbers.map(sceneByNumber);
  const loc = locationById(locationId);
  const light = daylightFor(day);
  if (full.some((s) => s.needs.includes('water_safety'))) notes.push('Water safety team on set from crew call. Nobody in the water without the diver.');
  if (full.some((s) => s.needs.includes('horses'))) notes.push('Mounted work. Head wrangler to brief riders at crew call. Farrier on standby.');
  if (full.some((s) => s.needs.includes('horse_falls'))) notes.push('Horse falls: stunt coordinator and animal welfare monitor both on set before the first rehearsal.');
  if (full.some((s) => s.needs.includes('sfx_fire'))) notes.push('Practical fire on set. Fire officer present for the duration.');
  if (full.some((s) => s.needs.includes('sfx_rain'))) notes.push('SFX rain rig or sound effect: confirm with the director at crew call.');
  if (full.some((s) => s.cast.some((n) => castByNumber(n).minor))) {
    notes.push(`Minor on set. Studio teacher on set. Maximum ${ASSUMED.assumed_minor_max_set_hours} hours; latest wrap ${clock(ASSUMED.assumed_minor_latest_wrap)}.`);
  }
  if (full.some((s) => s.time === 'DAWN')) notes.push(`Dawn scene. Sunrise ${light.sunrise}. Camera ready in the dark.`);
  if (full.some((s) => s.time === 'DUSK')) notes.push(`Dusk scene. Sunset ${clock(light.sunset)}. The light goes whether we are ready or not.`);
  if (loc.kind === 'practical') notes.push(`Location ${loc.travelMinutes} minutes from base camp. Shuttles from base camp parking.`);
  else notes.push('Studio. Park at the stages.');
  return notes;
}

function toSheetScenes(numbers: readonly string[]): CallSheetScene[] {
  return numbers.map((n) => {
    const sc = sceneByNumber(n);
    return { number: sc.number, slug: slugOf(sc), time: sc.time, eighths: sc.eighths, cast: sc.cast, intExt: sc.intExt };
  });
}

function headcountFor(sceneNumbers: readonly string[]): CallSheet['headcount'] {
  const full = sceneNumbers.map(sceneByNumber);
  return {
    crew: ASSUMED_ON_SET_CREW,
    extras: Math.max(0, ...full.map((s) => s.extras)),
    horses: full.some((s) => s.needs.includes('horses')) ? 33 : 0,
  };
}

const TIME_RANK: Record<string, number> = { DAWN: 0, DAY: 1, DUSK: 2, NIGHT: 3 };

/** The advance reads the board as it will stand tomorrow night, not as it was issued this afternoon. */
function advanceFor(day: number, placements: readonly Placement[] = []): CallSheet['advance'] {
  const next = SHOOT_DAYS.find((d) => d.day === day + 1);
  if (!next) return null;
  const movedOff = new Set(placements.filter((p) => p.fromDay === next.day).map((p) => p.scene));
  const movedOn = placements.filter((p) => p.toDay === next.day && (p.unit ?? 'main') === 'main').map((p) => p.scene);
  const scenes = [...next.scenes.filter((n) => !movedOff.has(n)), ...movedOn.filter((n) => !next.scenes.includes(n))].sort(
    (a, b) => (TIME_RANK[sceneByNumber(a).time] ?? 1) - (TIME_RANK[sceneByNumber(b).time] ?? 1),
  );
  const full = scenes.map(sceneByNumber);
  const flags: string[] = [];
  if (full.some((sc) => sc.time === 'DAWN')) flags.push('dawn call');
  if (full.some((sc) => sc.needs.includes('horses'))) flags.push('horses');
  if (full.some((sc) => sc.needs.includes('water_safety'))) flags.push('water safety');
  if (full.some((sc) => sc.cast.some((n) => castByNumber(n).minor))) flags.push('minor');
  return { day: next.day, locationId: next.locationId, scenes, flags };
}

function addMinutes(hhmm: string, min: number): string {
  return minutesToHhmm(hhmmToMinutes(hhmm) + min);
}

/** The call sheet as issued this afternoon, before the forecast turned. */
export function originalCallSheet(day: number): CallSheet {
  const d = shootDay(day);
  const scenes = toSheetScenes(d.scenes);
  const loc = locationById(d.locationId);
  const light = daylightFor(day);
  return {
    day,
    revision: 'ISSUED',
    canceled: false,
    unitCall: d.unitCall,
    plannedWrap: d.plannedWrap,
    locationId: d.locationId,
    weatherLine: weatherLineFor(day, d.locationId),
    sunrise: light.sunrise,
    sunset: light.sunset,
    scenes,
    cast: castRows(scenes, addMinutes(d.unitCall, 30), loc.travelMinutes, day),
    totalEighths: scenes.reduce((n, s) => n + s.eighths, 0),
    headcount: headcountFor(d.scenes),
    notes: notesFor(d.scenes, d.locationId, day),
    advance: advanceFor(day),
    move: null,
  };
}

/** The call sheet the chosen option produces. */
export function callSheetForOption(option: ReslotOption, day: number, revision: Revision = 'REVISED'): CallSheet {
  const base = originalCallSheet(day);
  if (!option.tomorrow) {
    return {
      ...base,
      revision,
      canceled: true,
      unitCall: '—',
      plannedWrap: '—',
      scenes: [],
      cast: [],
      totalEighths: 0,
      headcount: { crew: 0, extras: 0, horses: 0 },
      notes: [
        option.kind === 'rest_day'
          ? 'No call tomorrow. Day canceled. A Sunday call sheet will follow separately.'
          : 'No call tomorrow. Day canceled.',
        'The scenes have been re-slotted; see the revised stripboard.',
      ],
      move: null,
    };
  }

  const t = option.tomorrow;
  const scenes = toSheetScenes(t.scenes);
  const loc = locationById(t.locationId);
  const light = daylightFor(day);
  const notes = ['Second issue. Supersedes the prelim issued 4:40 PM.', ...notesFor(t.scenes, t.locationId, day)];

  let move: CallSheet['move'] = null;
  let plannedWrap = t.plannedWrap;
  let headcount = headcountFor(t.scenes);
  let cast = castRows(scenes, addMinutes(t.unitCall, 30), loc.travelMinutes, day);
  let weatherLine = weatherLineFor(day, t.locationId);
  if (option.split) {
    const to = locationById(option.split.locationId);
    const arrive = addMinutes(option.split.moveAt, to.travelMinutes);
    const pmScenes = toSheetScenes(option.split.scenes);
    // One row per actor. Someone in both blocks keeps the morning pickup and a remark; the afternoon table lists only the new arrivals.
    const amNumbers = new Set(cast.map((c) => c.number));
    cast = cast.map((c) => {
      const later = pmScenes.filter((sc) => sc.cast.includes(c.number)).map((sc) => sc.number);
      return later.length > 0 ? { ...c, remark: `then with the company to ${to.name} for Sc ${later.join(', ')}` } : c;
    });
    move = {
      at: option.split.moveAt,
      locationId: option.split.locationId,
      scenes: pmScenes,
      cast: castRows(pmScenes, addMinutes(arrive, 30), to.travelMinutes, day).filter((c) => !amNumbers.has(c.number)),
    };
    weatherLine = weatherLineForSplit(day, t.locationId, option.split.locationId);
    plannedWrap = addMinutes(light.sunset, 30);
    const pmHead = headcountFor(option.split.scenes);
    headcount = { crew: headcount.crew, extras: Math.max(headcount.extras, pmHead.extras), horses: Math.max(headcount.horses, pmHead.horses) };
    notes.splice(1, 0, `Company move at ${clock(option.split.moveAt)} to ${to.name}. Wrap out of ${loc.name} by ${clock(option.split.moveAt)}; ${to.travelMinutes} minutes' drive.`);
    notes.push(...notesFor(option.split.scenes, option.split.locationId, day).filter((n) => !notes.includes(n)));
  }

  return {
    day,
    revision,
    canceled: false,
    unitCall: t.unitCall,
    plannedWrap,
    locationId: t.locationId,
    weatherLine,
    sunrise: light.sunrise,
    sunset: light.sunset,
    scenes,
    cast,
    totalEighths: scenes.reduce((n, s) => n + s.eighths, 0) + (move ? move.scenes.reduce((n, s) => n + s.eighths, 0) : 0),
    headcount,
    notes,
    advance: advanceFor(day, option.placements),
    move,
  };
}

export function diffCallSheets(a: CallSheet, b: CallSheet): CallSheetDiff {
  const aScenes = a.scenes.map((s) => s.number);
  const bScenes = [...b.scenes, ...(b.move?.scenes ?? [])].map((s) => s.number);
  const aCast = castIn(aScenes);
  const bCast = castIn(bScenes);
  const bookings: string[] = [];
  if (a.headcount.extras > 0 && b.headcount.extras === 0) bookings.push(`${a.headcount.extras} background`);
  if (a.headcount.horses > 0 && b.headcount.horses === 0) bookings.push(`${a.headcount.horses} horses and wranglers`);
  const aFull = aScenes.map(sceneByNumber);
  const bFull = bScenes.map(sceneByNumber);
  if (aFull.some((s) => s.needs.includes('water_safety')) && !bFull.some((s) => s.needs.includes('water_safety'))) {
    bookings.push(b.move && b.move.locationId === a.locationId ? 'water safety dive team (the lead stays for the afternoon)' : 'water safety team');
  }
  const catering = {
    from: a.headcount.crew + a.headcount.extras + (a.headcount.horses > 0 ? 8 : 0),
    to: b.headcount.crew + b.headcount.extras + (b.headcount.horses > 0 ? 8 : 0),
  };
  const transport = b.canceled
    ? 'No company move. Vehicles released.'
    : b.move
      ? `Unit starts at ${locationById(b.locationId).name} and moves at ${clock(b.move.at)} to ${locationById(b.move.locationId).name}. Two shuttle runs.`
      : a.locationId === b.locationId
        ? 'No change.'
        : `Company moves from ${locationById(a.locationId).name} to ${locationById(b.locationId).name}. ${locationById(b.locationId).kind === 'stage' ? 'No location shuttles.' : ''}`.trim();
  return {
    scenesAdded: bScenes.filter((n) => !aScenes.includes(n)),
    scenesRemoved: aScenes.filter((n) => !bScenes.includes(n)),
    castAdded: bCast.filter((n) => !aCast.includes(n)),
    castReleased: aCast.filter((n) => !bCast.includes(n)),
    bookingsCanceled: bookings,
    catering,
    transport,
  };
}
