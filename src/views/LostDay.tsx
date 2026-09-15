import { useEffect, useMemo, useState } from 'react';
import { CloudRain, Check, ChevronDown } from 'lucide-react';
import {
  ASSUMED,
  CREW_FIELD_NAMES,
  CAST_FIELD_NAMES,
  PRODUCTION,
  breakdownFor,
  callSheetForOption,
  castByNumber,
  dayLabel,
  dayToDate,
  describeLostDay,
  diffCallSheets,
  formatEighths,
  formatUsd,
  inspectModelBoundary,
  locationById,
  longDate,
  losableDays,
  lostDayContext,
  originalCallSheet,
  planLostDay,
  restDayAfter,
  sceneByNumber,
  shootDay,
  shortDate,
  slugOf,
  clock,
} from '../engine';
import type { ReslotOption, Scene } from '../engine';
import { Card, CardHead, Chip, Eyebrow, FEAS_LABEL, FEAS_SEV, FindingList, SEV_DOT, Unknown } from '../components/ui';
import { FactList, SpannedPage } from '../components/SpannedText';
import Stripboard from '../components/Stripboard';
import type { Move } from '../components/Stripboard';
import CallSheetCard from '../components/CallSheetCard';
import LiveReader from '../components/LiveReader';

const FORBIDDEN_KEYS = [...CREW_FIELD_NAMES, ...CAST_FIELD_NAMES].filter((k) => k !== 'number');
const LOSABLE = losableDays();

function words(n: number): string {
  const w = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  return w[n] ?? String(n);
}

export default function LostDay({ lostDay, onLostDayChange }: { lostDay: number; onLostDayChange: (d: number) => void }) {
  const ctx = useMemo(() => lostDayContext(lostDay), [lostDay]);
  const tomorrow = shootDay(lostDay);
  const about = useMemo(() => describeLostDay(lostDay), [lostDay]);
  const [sceneTab, setSceneTab] = useState<string>(tomorrow.scenes[0]!);
  const [lit, setLit] = useState<number | null>(null);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [showCandidates, setShowCandidates] = useState(false);

  useEffect(() => {
    setSceneTab(shootDay(lostDay).scenes[0]!);
    setChosenId(null);
    setLit(null);
  }, [lostDay]);

  const options = useMemo(() => planLostDay(ctx), [ctx]);
  const chosen = chosenId ? options.find((o) => o.id === chosenId) ?? null : null;
  const original = useMemo(() => originalCallSheet(lostDay), [lostDay]);
  const revised = useMemo(() => (chosen ? callSheetForOption(chosen, lostDay) : null), [chosen, lostDay]);
  const diff = useMemo(() => (revised ? diffCallSheets(original, revised) : null), [original, revised]);
  const boundary = useMemo(() => inspectModelBoundary(tomorrow.scenes, FORBIDDEN_KEYS), [tomorrow.scenes]);

  const moves: Move[] = useMemo(() => {
    if (!chosen) return [];
    const out: Move[] = chosen.placements.map((p) => ({ scene: p.scene, fromDay: p.fromDay, toDay: p.toDay, unit: p.unit }));
    if (chosen.tomorrow) {
      const from = chosen.opensDay ?? coverDayOf(chosen);
      if (from !== null) for (const n of chosen.tomorrow.scenes) out.push({ scene: n, fromDay: from, toDay: lostDay });
    }
    return out;
  }, [chosen, lostDay]);

  const boardDays = useMemo(() => {
    const out: number[] = [];
    for (let d = Math.max(1, lostDay - 1); d <= Math.min(PRODUCTION.shootDays, lostDay + 13); d += 1) out.push(d);
    return out;
  }, [lostDay]);

  const breakdown = breakdownFor(sceneTab);
  const lostScenes = tomorrow.scenes.map(sceneByNumber);
  const coverOpt = options.find((o) => o.kind === 'cover_set');
  const evalDay = lostDay - 1;
  const permitNote = about.permitTo !== null ? `a permit that closes on ${dayLabel(about.permitTo)}` : 'a standing set';
  const loc = locationById(tomorrow.locationId);

  const cover = options.find((o) => o.kind === 'cover_set' && o.tomorrow !== null) ?? null;
  const coverName = cover?.tomorrow ? locationById(cover.tomorrow.locationId).name.replace(/^Stage [A-Z]\d? · /, '').toLowerCase() : 'the cover set';
  const coverScenes = cover?.tomorrow && cover.tomorrow.scenes.length > 0
    ? cover.tomorrow.scenes.length === 1
      ? `, scene ${cover.tomorrow.scenes[0]}`
      : `, scenes ${cover.tomorrow.scenes[0]} to ${cover.tomorrow.scenes[cover.tomorrow.scenes.length - 1]}`
    : '';

  return (
    <div className="animate-rise">
      {/* ------------------------------- HERO ------------------------------- */}
      <header className="mx-auto max-w-7xl px-5 pb-8 pt-8 lg:px-8 lg:pt-12">
        <Eyebrow>
          6:10 PM · {dayLabel(evalDay)} of {PRODUCTION.shootDays} · {longDate(dayToDate(evalDay))} · the call sheet is due at 8:00 PM · {PRODUCTION.titleMark} · {PRODUCTION.nature}
        </Eyebrow>
        <h1 className="mt-3 max-w-[22ch] font-display text-[2.4rem] leading-[1.05] text-ink sm:text-[3rem]">
          Tomorrow is a washout. The call sheet goes out at eight.
        </h1>
        <p className="mt-5 max-w-[64ch] text-[16px] leading-relaxed text-body">
          {dayLabel(lostDay)} is an exterior at {about.locationName.toLowerCase()}: {about.sceneCount} scenes, {formatEighths(about.eighths)} pages
          {about.extras ? `, ${about.extras} background` : ''}
          {about.horses ? ', a horse package' : ''}
          {about.water ? ', people in the water' : ''}
          {about.dawn ? ', a dawn' : ''}
          {about.dusk ? ', a dusk' : ''}
          {about.minor ? ', a child' : ''}, and {permitNote}. The forecast turned at half past five.
        </p>
      </header>

      <div className="mx-auto max-w-7xl px-5 pb-16 lg:px-8">
        {/* --------------------------- FORECAST + PRELIM --------------------------- */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <Card className="lg:col-span-4">
            <CardHead title="The forecast" sub="Issued 5:30 PM. An input, not a prediction." right={<CloudRain className="h-4 w-4 text-accent" aria-hidden />} />
            <div className="px-5 py-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Eyebrow>Rain</Eyebrow>
                  <div className="tnum mt-1 font-display text-2xl text-ink">{ctx.forecast.rainIn.toFixed(1)} in</div>
                </div>
                <div>
                  <Eyebrow>Wind</Eyebrow>
                  <div className="tnum mt-1 font-display text-2xl text-ink">{ctx.forecast.windMph} mph</div>
                </div>
                <div>
                  <Eyebrow>Clears</Eyebrow>
                  <div className="tnum mt-1 font-display text-2xl text-ink">{ctx.forecast.clearsAt ? clock(ctx.forecast.clearsAt) : '—'}</div>
                </div>
              </div>
              <p className="mt-3 text-[13.5px] leading-relaxed text-body">{ctx.forecast.summary}</p>
              <p className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-muted">
                Horizon {ctx.forecast.horizonDays} days. The engine does not predict weather; it takes the feed as given.
              </p>
            </div>
          </Card>

          <Card className="lg:col-span-8">
            <CardHead
              title={`Prelim · issued 4:40 PM · ${dayLabel(lostDay)}`}
              sub={`${about.locationName} · crew call ${clock(tomorrow.unitCall)} · ${formatEighths(about.eighths)} pages`}
              right={<Chip sev="open">Prelim</Chip>}
            />
            <ul className="divide-y divide-line">
              {lostScenes.map((sc) => (
                <li key={sc.number} className="flex items-start gap-4 px-5 py-3">
                  <span className="tnum w-8 shrink-0 font-semibold text-ink">{sc.number}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-ink">{slugOf(sc)}</div>
                    <div className="mt-0.5 text-2xs text-muted">
                      {formatEighths(sc.eighths)} pp · cast {sc.cast.map((n) => `${n} ${castByNumber(n).character}`).join(', ')}
                      {sc.extras ? ` · ${sc.extras} background` : ''}
                      {sc.needs.length ? ` · ${sc.needs.map((n) => n.replace('_', ' ')).join(', ')}` : ''}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    {sc.time === 'DAWN' || sc.time === 'DUSK' ? <Chip sev="review">locked to {sc.time.toLowerCase()}</Chip> : null}
                    {sc.cast.some((n) => castByNumber(n).minor) ? <Chip sev="review">minor</Chip> : null}
                    {sc.secondUnit ? <Chip sev="open">2nd unit eligible</Chip> : null}
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-line px-5 py-3 text-xs text-muted">
              {about.permitTo !== null ? (
                <>
                  Permit at {about.locationName.toLowerCase()}: days {loc.permitFrom}–{about.permitTo}.
                  {loc.sundaysAllowed ? ` Sundays allowed at ${loc.assumed_sunday_uplift}× the day fee.` : ' No Sundays.'} Whatever does not shoot tomorrow has{' '}
                  {words(about.daysLeftInPermit)} more day{about.daysLeftInPermit === 1 ? '' : 's'} here to shoot in.
                </>
              ) : (
                'A standing set with no permit window.'
              )}
            </div>
          </Card>
        </div>

        {/* ----------------------------- THE READING (collapsed) ----------------------------- */}
        <details className="card mt-5 group">
          <summary className="card-head cursor-pointer select-none list-none">
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight text-ink">6:20 PM · The pages, read</h2>
              <p className="mt-0.5 text-xs text-muted">Four script pages, broken down to facts. Hover a fact to highlight the line it came from. A fact with no highlight was inferred from what the page leaves out, and says so.</p>
            </div>
            <ChevronDown className="h-4 w-4 text-muted transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="flex flex-wrap gap-1.5 border-b border-line p-3">
            {tomorrow.scenes.map((n) => {
              const on = sceneTab === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setSceneTab(n);
                    setLit(null);
                  }}
                  aria-pressed={on}
                  className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-all ${on ? 'border-ink bg-ink text-paper' : 'border-line bg-surface text-body hover:border-line-strong'}`}
                >
                  Sc {n} · {sceneByNumber(n).time}
                </button>
              );
            })}
          </div>
          {breakdown ? (
            <div className="grid grid-cols-1 lg:grid-cols-12">
              <div className="border-b border-line p-5 lg:col-span-7 lg:border-b-0 lg:border-r">
                <Eyebrow>
                  Page · Ep {sceneByNumber(sceneTab).episode} · Sc {sceneTab} · invented
                </Eyebrow>
                <div className="mt-3">
                  <SpannedPage text={breakdown.text} facts={breakdown.facts} lit={lit} onLit={setLit} />
                </div>
              </div>
              <div className="lg:col-span-5">
                <FactList facts={breakdown.facts} lit={lit} onLit={setLit} />
              </div>
            </div>
          ) : (
            <StructuredBreakdown scene={sceneByNumber(sceneTab)} />
          )}
          <div className="border-t border-line bg-sunken/60 px-5 py-3 text-xs text-muted">
            Crew records and cast contracts at the model: <span className="tnum font-semibold text-ink">{boundary.forbiddenKeysFound.length}</span>. Measured, not asserted: the
            outbound payload was built with the same function the working version would call and scanned for {FORBIDDEN_KEYS.length} field names. It carries{' '}
            {boundary.payloadKeys.join(' and ')}: {boundary.pagesSent} page{boundary.pagesSent === 1 ? '' : 's'}, nothing else.
          </div>
        </details>

        {/* ------------------------------ OPTIONS ------------------------------ */}
        <div className="mt-10">
          <Eyebrow>6:40 PM · priced against the contracts, the permit, the child's hours and the turnaround</Eyebrow>
          <h2 className="mt-1 font-display text-2xl text-ink">Six things a producer can do tonight</h2>
          <p className="mt-1.5 max-w-[70ch] text-[15px] text-body">In order of price, with what breaks under each. Choose one and the call sheet reissues.</p>

          <Card className="mt-4 bg-sunken/40">
            <div className="grid grid-cols-1 gap-x-8 gap-y-4 px-5 py-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <div className="md:border-r md:border-line md:pr-6">
                <Eyebrow>6:55 PM</Eyebrow>
                <p className="mt-1 font-display text-[17px] text-ink">The producer chooses.</p>
                <p className="text-xs text-muted">The engine prices. It does not choose. Two questions it cannot price, and the choice turns on them.</p>
              </div>
              <div>
                <Eyebrow>Question one</Eyebrow>
                <p className="mt-1 text-[15px] text-ink">Is {coverName} tomorrow worth more to the picture than {about.locationName.toLowerCase()} in tomorrow's weather?</p>
                <div className="mt-2 h-px w-full bg-line-strong" aria-hidden />
              </div>
              <div>
                <Eyebrow>Question two</Eyebrow>
                <p className="mt-1 text-[15px] text-ink">Have the cast rehearsed {coverName}{coverScenes}?</p>
                <div className="mt-2 h-px w-full bg-line-strong" aria-hidden />
              </div>
            </div>
          </Card>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {options.map((o, i) => (
              <OptionCard key={o.id} o={o} rank={i + 1} chosen={chosenId === o.id} onChoose={() => setChosenId(chosenId === o.id ? null : o.id)} />
            ))}
          </div>
        </div>

        {/* ---------------------------- CONSEQUENCES --------------------------- */}
        <div className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <Eyebrow>{chosen ? '7:05 PM · the strips move' : 'the stripboard, as it stands'}</Eyebrow>
              <h2 className="mt-1 font-display text-2xl text-ink">{chosen ? `If you choose: ${chosen.title.toLowerCase()}` : 'Fifteen days of strips'}</h2>
              <p className="mt-1.5 max-w-[70ch] text-[15px] text-body">
                {chosen
                  ? 'The strips move, the notices go out in order, and the sheet reissues last.'
                  : `Today, ${dayLabel(boardDays[0]!)}, through ${dayLabel(boardDays[boardDays.length - 1]!)}. The salmon strips are tomorrow. Choose an option above to see where they go.`}
              </p>
            </div>
            {chosen ? (
              <div className="flex items-center gap-3">
                <Chip sev={FEAS_SEV[chosen.feasibility]}>{FEAS_LABEL[chosen.feasibility]}</Chip>
                <span className="tnum font-display text-2xl text-ink">{chosen.costCents === null ? <Unknown>not fully priced</Unknown> : formatUsd(chosen.costCents)}</span>
              </div>
            ) : null}
          </div>

          <Card className="mt-4 p-4">
            <Stripboard
              days={boardDays}
              lostDay={lostDay}
              moves={moves}
              kept={chosen?.split?.scenes ?? []}
              canceledTomorrow={chosen !== null && chosen.tomorrow === null}
              opensDay={chosen?.opensDay ?? null}
              placements={chosen?.placements ?? []}
            />
          </Card>

          {chosen ? (
            <div className="mt-5 grid grid-cols-1 items-start gap-5 xl:grid-cols-12">
              <div className="space-y-5 xl:col-span-5">
                <Card>
                  <CardHead title="6:45 to 7:55 PM · the notices, in order" sub="Who, what, and by when. The sheet is last." />
                  <ul className="divide-y divide-line">
                    {chosen.notices.length === 0 ? <li className="px-5 py-4 text-sm text-muted">Nothing to send, because nothing can happen.</li> : null}
                    {[...chosen.notices].sort((a, b) => a.by.localeCompare(b.by)).map((n, i) => (
                      <li key={i} className="flex items-start gap-3 px-5 py-2.5">
                        <span className="tnum w-16 shrink-0 font-mono text-xs text-ink">{clock(n.by)}</span>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-ink">{n.who}</div>
                          <div className="text-xs text-body">{n.what}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>

                <Card>
                  <CardHead title="Where the pages go" sub="Each lost scene, its new home, and what it costs the day it lands on." />
                  <ul className="divide-y divide-line">
                    {chosen.split
                      ? chosen.split.scenes.map((n) => (
                          <li key={n} className="flex items-start gap-3 px-5 py-3">
                            <span className="tnum w-8 shrink-0 font-semibold text-ink">{n}</span>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm text-ink">Stays on {dayLabel(lostDay)}, after the move</div>
                              <div className="mt-0.5 text-xs text-muted">Shoots at {locationById(chosen.split!.locationId).name} once it clears.</div>
                            </div>
                          </li>
                        ))
                      : null}
                    {chosen.placements.map((p) => (
                      <li key={p.scene} className="flex items-start gap-3 px-5 py-3">
                        <span className="tnum w-8 shrink-0 font-semibold text-ink">{p.scene}</span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-ink">
                            → {Number.isInteger(p.toDay) ? `${dayLabel(p.toDay)} · ${shortDate(dayToDate(p.toDay))}` : `Rest day · ${shortDate(restDayAfter(Math.floor(p.toDay)) ?? '')}`}
                            {p.unit === 'second' ? <span className="ml-2 rounded-sm bg-ink px-1.5 py-px text-2xs text-paper">2nd unit</span> : null}
                          </div>
                          <div className="mt-0.5 text-xs text-muted">{p.reason}</div>
                        </div>
                        {p.overtimeHours > 0 ? <span className="tnum shrink-0 text-xs font-medium text-review-deep">+{p.overtimeHours} hrs</span> : null}
                      </li>
                    ))}
                    {chosen.unplaced.map((u) => (
                      <li key={u.scene} className="flex items-start gap-3 px-5 py-3">
                        <span className="tnum w-8 shrink-0 font-semibold text-block-deep">{u.scene}</span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-block-deep">No home</div>
                          <div className="mt-0.5 text-xs text-muted">{u.reason}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>

                <details className="card group">
                  <summary className="card-head cursor-pointer select-none list-none">
                    <div>
                      <h2 className="text-[15px] font-semibold tracking-tight text-ink">The receipt</h2>
                      <p className="mt-0.5 text-xs text-muted">Every priced line, in assumed rates, USD. Nothing here is a total of anything unpriced.</p>
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted transition-transform group-open:rotate-180" aria-hidden />
                  </summary>
                  <ul className="divide-y divide-line px-5">
                    {chosen.costLines.map((l, i) => (
                      <li key={i} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                        <span className="text-body">{l.label}</span>
                        <span className="tnum text-ink">{formatUsd(l.cents)}</span>
                      </li>
                    ))}
                    <li className="flex items-baseline justify-between gap-3 py-2.5 text-sm font-semibold">
                      <span className="text-ink">{chosen.costCents === null ? 'Priced so far' : 'Total'}</span>
                      <span className="tnum text-ink">{formatUsd(chosen.costLines.reduce((n, l) => n + l.cents, 0))}</span>
                    </li>
                  </ul>
                  {chosen.unpriced.length > 0 ? (
                    <div className="border-t border-line bg-review-wash/60 px-5 py-3">
                      <Eyebrow className="text-review-deep">Not priced, and why</Eyebrow>
                      <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-body">
                        {chosen.unpriced.map((u, i) => (
                          <li key={i}>{u}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </details>
              </div>
              <div className="space-y-5 xl:col-span-7">
                <div>
                  <Eyebrow>7:52 PM · the sheet, last</Eyebrow>
                </div>
                <CallSheetCard sheet={revised ?? original} diff={diff} />
              </div>
            </div>
          ) : null}
        </div>

        {/* ------------------------ WHAT IT WILL NOT COMPUTE ------------------------ */}
        <Card className="mt-10">
          <CardHead title="What the engine will not compute" sub="Stated because the omissions are the design." />
          <ul className="grid grid-cols-1 gap-x-8 gap-y-3 px-5 py-4 text-[13.5px] leading-relaxed text-body md:grid-cols-2">
            <li>
              <strong className="font-semibold text-ink">Which option to take.</strong> The two questions above the grid are the ones the decision turns on, and
              neither is a number.
            </li>
            <li>
              <strong className="font-semibold text-ink">Weather beyond the feed's horizon.</strong> The engine will not say whether next week is dry, and an
              option that depends on next week being dry says so.
            </li>
            <li>
              <strong className="font-semibold text-ink">Whether the water is safe.</strong> A rising river is the safety lead's call. The engine carries the
              call; it does not make it.
            </li>
            <li>
              <strong className="font-semibold text-ink">A fill rate for background at short notice.</strong> The coordinator will get some of them. How many
              is a phone call, not a formula.
            </li>
            <li>
              <strong className="font-semibold text-ink">Whether a paid canceled day counts as a worked day.</strong> That decides whether Sunday is a sixth
              or a seventh day, and it lives in the crew agreement's language, which the engine does not hold.
            </li>
            <li>
              <strong className="font-semibold text-ink">Whether there is a second unit.</strong> The engine assumes one and says so. If there is not, the
              second-unit option is a hire, and a hire is a conversation.
            </li>
            <li>
              <strong className="font-semibold text-ink">The price of a contract extension.</strong> {dayLabel(PRODUCTION.shootDays + 1)} would be a negotiation
              with everyone whose deal ends on {dayLabel(PRODUCTION.shootDays)}. A negotiation is not a rate.
            </li>
            <li>
              <strong className="font-semibold text-ink">Whether the cast are ready for the cover scenes.</strong> Rehearsal state is not in any system the
              engine reads. The first assistant director knows, and is the person this page is for.
            </li>
          </ul>
          <div className="border-t border-line px-5 py-3 text-xs text-muted">
            Assumed rates in this view: unit day {formatUsd(ASSUMED.assumed_unit_day_cost_cents)} · overtime {ASSUMED.assumed_ot_multiplier_1}× then {ASSUMED.assumed_ot_multiplier_2}× ·
            turnaround {ASSUMED.assumed_turnaround_hours} hrs · seventh day {ASSUMED.assumed_seventh_day_multiplier}× · capacity {formatEighths(ASSUMED.assumed_day_capacity_eighths)} pages ·
            second unit {formatUsd(ASSUMED.assumed_second_unit_day_cost_cents)} a day. Every one is named assumed_* in the source.
          </div>
        </Card>

        {/* ---------------------------- LOSE ANOTHER DAY --------------------------- */}
        <Card className="mt-5">
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight text-ink">Now lose a different day</h2>
              <p className="mt-0.5 max-w-[60ch] text-xs text-muted">
                Any exterior day in the {PRODUCTION.shootDays} can go. The same rules re-slot it: a different permit window, a different cast, a different Sunday.
              </p>
            </div>
            <select
              value={lostDay}
              onChange={(e) => onLostDayChange(Number(e.target.value))}
              className="rounded-md border border-line bg-surface px-2 py-1.5 text-xs text-ink shadow-card focus:border-accent focus:outline-none"
              aria-label="Choose which exterior day the weather takes"
            >
              {LOSABLE.map((d) => (
                <option key={d} value={d}>
                  Day {d} · {shortDate(dayToDate(d))} · {locationById(shootDay(d).locationId).name}
                </option>
              ))}
            </select>
          </div>
        </Card>

        {/* ------------------------------ FOR THE ENGINEER ----------------------------- */}
        <details className="card mt-5 group">
          <summary className="card-head cursor-pointer select-none list-none">
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight text-ink">For the engineer</h2>
              <p className="mt-0.5 text-xs text-muted">The live reader, and every stage day the cover search considered.</p>
            </div>
            <ChevronDown className="h-4 w-4 text-muted transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="p-4">
            <LiveReader />
            {coverOpt?.candidates ? (
              <Card className="mt-5">
                <button type="button" onClick={() => setShowCandidates((v) => !v)} className="card-head w-full text-left" aria-expanded={showCandidates}>
                  <div>
                    <h3 className="text-[15px] font-semibold tracking-tight text-ink">Every stage day the cover search considered</h3>
                    <p className="mt-0.5 text-xs text-muted">{coverOpt.candidates.length} candidates, in schedule order, with why each was or was not chosen.</p>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-muted transition-transform ${showCandidates ? 'rotate-180' : ''}`} aria-hidden />
                </button>
                {showCandidates ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[40rem] text-left text-xs">
                      <thead>
                        <tr className="border-b border-line text-2xs uppercase tracking-eyebrow text-muted">
                          <th className="px-5 py-2 font-medium">Day</th>
                          <th className="py-2 font-medium">Set</th>
                          <th className="py-2 font-medium">Scenes</th>
                          <th className="py-2 font-medium">Pages</th>
                          <th className="py-2 font-medium">Verdict</th>
                          <th className="px-5 py-2 font-medium">Why</th>
                        </tr>
                      </thead>
                      <tbody>
                        {coverOpt.candidates.map((c) => (
                          <tr key={c.day} className="border-b border-line/70 align-top">
                            <td className="tnum px-5 py-2 font-semibold text-ink">{c.day}</td>
                            <td className="py-2 text-ink">{locationById(c.locationId).name}</td>
                            <td className="tnum py-2 text-body">{c.scenes.join(', ')}</td>
                            <td className="tnum py-2 text-body">{formatEighths(c.eighths)}</td>
                            <td className="py-2">
                              <Chip sev={FEAS_SEV[c.feasibility]}>{FEAS_LABEL[c.feasibility]}</Chip>
                            </td>
                            <td className="px-5 py-2 text-body">{c.reasons.join(' · ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </Card>
            ) : null}
          </div>
        </details>
      </div>
    </div>
  );
}

/** The stage day an option pulls forward, for options that do not open it fully. */
function coverDayOf(o: ReslotOption): number | null {
  if (!o.tomorrow || !o.candidates) return null;
  const first = o.tomorrow.scenes[0];
  if (!first) return null;
  return o.candidates.find((c) => c.scenes.includes(first))?.day ?? null;
}

/**
 * For a scene with no hand-written page, the facts the stripboard export
 * already holds. Not a reading: a lookup, and labeled as one.
 */
function StructuredBreakdown({ scene }: { scene: Scene }) {
  const rows: { k: string; v: string }[] = [
    { k: 'int_ext', v: scene.intExt },
    { k: 'set', v: scene.set },
    { k: 'time_of_day', v: scene.time },
    { k: 'pages', v: `${formatEighths(scene.eighths)}` },
    { k: 'cast', v: scene.cast.map((n) => `${n} ${castByNumber(n).character}`).join(' · ') || 'none' },
    { k: 'background', v: scene.extras ? String(scene.extras) : 'none' },
    { k: 'needs', v: scene.needs.length ? scene.needs.map((n) => n.replace('_', ' ')).join(', ') : 'none' },
    { k: 'locked_to_light', v: scene.time === 'DAWN' || scene.time === 'DUSK' ? `yes — ${scene.time.toLowerCase()}` : 'no' },
    { k: 'weather_dependent', v: scene.weatherDependent ? 'yes' : 'no' },
    { k: 'second_unit', v: scene.secondUnit ? 'eligible, with doubles' : 'no' },
  ];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12">
      <div className="border-b border-line p-5 lg:col-span-7 lg:border-b-0 lg:border-r">
        <Eyebrow>
          Page · Ep {scene.episode} · Sc {scene.number} · invented
        </Eyebrow>
        <p className="mt-3 font-mono text-[13.5px] leading-[1.75] text-ink">{slugOf(scene)}</p>
        <p className="mt-4 max-w-[52ch] text-[13.5px] leading-relaxed text-body">
          No page has been read for this scene. The facts on the right come from the stripboard export, the way a scheduling tool already holds them.
          Nothing to light, because nothing was read. The eleven hand-written pages around the ford show what the reader adds.
        </p>
      </div>
      <ul className="divide-y divide-line lg:col-span-5">
        {rows.map((r) => (
          <li key={r.k} className="px-4 py-2.5">
            <div className="font-mono text-2xs text-muted">{r.k}</div>
            <div className="mt-0.5 text-[13.5px] font-medium text-ink">{r.v}</div>
          </li>
        ))}
        <li className="px-4 py-2.5 text-2xs text-muted">From the export, not the reader. Confidence is not a concept here; the export is either right or it is not.</li>
      </ul>
    </div>
  );
}

function OptionCard({ o, rank, chosen, onChoose }: { o: ReslotOption; rank: number; chosen: boolean; onChoose: () => void }) {
  const sev = FEAS_SEV[o.feasibility];
  const shown = o.findings.filter((f) => f.severity !== 'open').slice(0, 4);
  const more = o.findings.length - shown.length;
  return (
    <div className={`card flex flex-col transition-all ${chosen ? 'border-ink shadow-lift' : 'hover:shadow-lift'}`}>
      <div className="flex items-start justify-between gap-3 px-5 pt-4">
        <div className="min-w-0">
          <Eyebrow>Option {rank}</Eyebrow>
          <h3 className="mt-1 font-display text-[19px] leading-tight text-ink">{o.title}</h3>
        </div>
        <Chip sev={sev} className="shrink-0">
          {FEAS_LABEL[o.feasibility]}
        </Chip>
      </div>
      <p className="mt-2 px-5 text-[13.5px] leading-relaxed text-body">{o.summary}</p>
      <div className="mt-4 flex items-baseline gap-2 px-5">
        <span className={`tnum font-display text-[1.75rem] leading-none ${o.costCents === null ? 'text-muted' : 'text-ink'}`}>
          {o.costCents === null ? (o.costLines.length > 0 ? `${formatUsd(o.costLines.reduce((n, l) => n + l.cents, 0))}+` : '—') : formatUsd(o.costCents)}
        </span>
        <span className="text-2xs text-muted">{o.costCents === null ? (o.costLines.length > 0 ? 'priced so far · total unknown' : 'not priced') : 'assumed rates, USD'}</span>
      </div>
      <ul className="mt-4 flex-1 space-y-2 border-t border-line px-5 pt-3">
        {shown.length === 0 ? <li className="text-xs text-muted">Nothing breaks that a human has to decide.</li> : null}
        {shown.map((f, i) => (
          <li key={`${f.code}-${i}`} className="flex items-start gap-2 text-xs leading-snug text-body">
            <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${SEV_DOT[f.severity]}`} aria-hidden />
            <span>{f.title}</span>
          </li>
        ))}
        {more > 0 ? <li className="text-2xs text-muted">and {more} more, below</li> : null}
      </ul>
      <div className="px-5 pb-4 pt-4">
        <button type="button" onClick={onChoose} aria-pressed={chosen} className={chosen ? 'btn-primary w-full justify-center' : 'btn w-full justify-center'}>
          {chosen ? (
            <>
              <Check className="h-3.5 w-3.5" aria-hidden /> Chosen
            </>
          ) : (
            'Choose this'
          )}
        </button>
      </div>
      {chosen ? (
        <div className="border-t border-line">
          <div className="px-5 pt-3">
            <Eyebrow>Everything the rules found</Eyebrow>
          </div>
          <FindingList findings={o.findings} dense />
        </div>
      ) : null}
    </div>
  );
}
