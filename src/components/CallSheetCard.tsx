import type { CallSheet, CallSheetCast, CallSheetDiff, CallSheetScene } from '../engine';
import { PRODUCTION, clock, dayToDate, formatEighths, locationById, longDate, shortDate } from '../engine';

/* ===========================================================================
   THE CALL SHEET, AS PAPER

   Rendered the way it is printed, because that is how it is read: at 10 PM,
   on a phone, by someone who wants three facts and will not scroll for them.
   Crew call, where, what time do I need to be in the chair.
   =========================================================================== */

export default function CallSheetCard({ sheet, diff }: { sheet: CallSheet; diff?: CallSheetDiff | null }) {
  const loc = locationById(sheet.locationId);
  const date = dayToDate(sheet.day);
  const revised = sheet.revision === 'REVISED';
  return (
    <div className="card overflow-hidden">
      <div className={`flex items-center justify-between px-5 py-2 ${revised ? 'bg-ink text-paper' : 'bg-line-strong text-ink'}`}>
        <span className="text-2xs font-semibold uppercase tracking-eyebrow">{revised ? 'Revised · 7:52 PM · supersedes prelim 4:40 PM' : 'Prelim · issued 4:40 PM'}</span>
        <span className="tnum text-2xs font-medium uppercase tracking-eyebrow">
          Day {sheet.day} of {PRODUCTION.shootDays}
        </span>
      </div>

      <div className="px-5 pt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div>
            <div className="font-display text-xl text-ink">{PRODUCTION.titleMark}</div>
            <div className="text-xs text-muted">
              {PRODUCTION.nature} · {longDate(date)}
            </div>
          </div>
          {sheet.canceled ? (
            <div className="rounded-md border-2 border-block px-3 py-1 font-display text-lg uppercase tracking-wide text-block">No call</div>
          ) : (
            <div className="text-right">
              <div className="eyebrow">Crew call</div>
              <div className="tnum font-display text-3xl leading-none text-ink">{clock(sheet.unitCall)}</div>
            </div>
          )}
        </div>
      </div>

      {sheet.canceled ? (
        <div className="px-5 pb-5 pt-4">
          <ul className="space-y-1.5 text-[13.5px] text-body">
            {sheet.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-line px-5 py-3 text-xs sm:grid-cols-4">
            <Fact k={sheet.move ? 'First location' : 'Location'} v={loc.name} />
            <Fact k="Planned wrap" v={clock(sheet.plannedWrap)} />
            <Fact k="Sunrise · sunset" v={`${clock(sheet.sunrise)} · ${clock(sheet.sunset)}`} />
            <Fact k="On set" v={`${sheet.headcount.crew} crew · ${sheet.headcount.extras} background · ${sheet.headcount.horses} horses`} />
          </dl>
          <p className="border-b border-line px-5 py-2.5 text-xs text-body">
            <span className="font-semibold text-ink">Weather. </span>
            {sheet.weatherLine}
          </p>

          <SceneTable scenes={sheet.scenes} total={sheet.move ? null : sheet.totalEighths} />
          <CastTable cast={sheet.cast} />

          {sheet.move ? (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-y border-line bg-sunken px-5 py-2.5">
                <span className="text-2xs font-semibold uppercase tracking-eyebrow text-ink">Company move · {clock(sheet.move.at)}</span>
                <span className="text-xs text-body">to {locationById(sheet.move.locationId).name}</span>
              </div>
              <SceneTable scenes={sheet.move.scenes} total={sheet.totalEighths} />
              <CastTable cast={sheet.move.cast} />
            </>
          ) : null}

          <div className="border-t border-line px-5 py-3">
            <div className="eyebrow">Notes</div>
            <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-body">
              {sheet.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </div>

          {sheet.advance ? (
            <div className="border-t border-line bg-sunken/60 px-5 py-3 text-xs text-body">
              <span className="eyebrow">Advance · Day {sheet.advance.day} · {shortDate(dayToDate(sheet.advance.day))}</span>
              <div className="mt-1">
                {locationById(sheet.advance.locationId).name} · scenes {sheet.advance.scenes.join(', ')}
                {sheet.advance.flags.length > 0 ? ` · ${sheet.advance.flags.join(' · ')}` : ''}
              </div>
            </div>
          ) : null}
        </>
      )}

      {diff ? (
        <div className="border-t border-line bg-sunken/60 px-5 py-4">
          <div className="eyebrow">What changed against the prelim</div>
          <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
            <Fact k="Scenes out" v={diff.scenesRemoved.length ? diff.scenesRemoved.join(', ') : '—'} />
            <Fact k="Scenes in" v={diff.scenesAdded.length ? diff.scenesAdded.join(', ') : '—'} />
            <Fact k="Cast released" v={diff.castReleased.length ? diff.castReleased.join(', ') : '—'} />
            <Fact k="Cast added" v={diff.castAdded.length ? diff.castAdded.join(', ') : '—'} />
            <Fact k="Bookings canceled" v={diff.bookingsCanceled.length ? diff.bookingsCanceled.join(' · ') : '—'} />
            <Fact k="Catering headcount" v={`${diff.catering.from} → ${diff.catering.to}`} />
            <div className="sm:col-span-2">
              <Fact k="Transportation" v={diff.transport} />
            </div>
          </dl>
        </div>
      ) : null}
    </div>
  );
}

function SceneTable({ scenes, total }: { scenes: readonly CallSheetScene[]; total: number | null }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[30rem] text-left text-xs">
        <thead>
          <tr className="border-b border-line text-2xs uppercase tracking-eyebrow text-muted">
            <th className="px-5 py-2 font-medium">Sc</th>
            <th className="py-2 font-medium">Set</th>
            <th className="py-2 font-medium">D/N</th>
            <th className="py-2 text-right font-medium">Pages</th>
            <th className="px-5 py-2 font-medium">Cast</th>
          </tr>
        </thead>
        <tbody>
          {scenes.map((s) => (
            <tr key={s.number} className="border-b border-line/70">
              <td className="tnum px-5 py-2 font-semibold text-ink">{s.number}</td>
              <td className="py-2 text-ink">{s.slug.replace(/ — .*$/, '')}</td>
              <td className="py-2 text-body">{s.time}</td>
              <td className="tnum py-2 text-right text-body">{formatEighths(s.eighths)}</td>
              <td className="tnum px-5 py-2 text-body">{s.cast.join(', ')}</td>
            </tr>
          ))}
          {total !== null ? (
            <tr>
              <td className="px-5 py-2 text-2xs uppercase tracking-eyebrow text-muted" colSpan={3}>
                Total
              </td>
              <td className="tnum py-2 text-right font-semibold text-ink">{formatEighths(total)}</td>
              <td />
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function CastTable({ cast }: { cast: readonly CallSheetCast[] }) {
  if (cast.length === 0) return null;
  return (
    <div className="overflow-x-auto border-t border-line">
      <table className="w-full min-w-[30rem] text-left text-xs">
        <thead>
          <tr className="border-b border-line text-2xs uppercase tracking-eyebrow text-muted">
            <th className="px-5 py-2 font-medium">No</th>
            <th className="py-2 font-medium">Character</th>
            <th className="py-2 font-medium">P/U</th>
            <th className="py-2 font-medium">M/U</th>
            <th className="py-2 font-medium">On set</th>
            <th className="px-5 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {cast.map((c) => (
            <tr key={c.number} className="border-b border-line/70">
              <td className="tnum px-5 py-2 font-semibold text-ink">{c.number}</td>
              <td className="py-2 text-ink">
                {c.character}
                {c.minor ? <span className="ml-1.5 rounded-sm bg-review-wash px-1 text-2xs text-review-deep">minor</span> : null}
                {c.remark ? <div className="text-2xs text-muted">{c.remark}</div> : null}
              </td>
              <td className="tnum py-2 text-body">{clock(c.pickup)}</td>
              <td className="tnum py-2 text-body">{clock(c.makeup)}</td>
              <td className="tnum py-2 text-body">{clock(c.onSet)}</td>
              <td className="px-5 py-2 text-body">{c.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="eyebrow">{k}</dt>
      <dd className="mt-0.5 text-ink">{v}</dd>
    </div>
  );
}
