import { MOMENTS, PRODUCTION, SHOOT_DAYS, clock, dayToDate, locationById, shortDate } from '../engine';

/* ===========================================================================
   THE TIMELINE IS THE NAVIGATION

   A production is a line: twenty-one days of prep, seventy-nine days of
   shooting, then nothing. The three views are three moments on it. The track
   is a miniature stripboard of the whole season — stage days white, exterior
   days yellow, the lost day marked — so the reader always knows where in the
   life of the company they are standing.
   =========================================================================== */

export type ViewKey = 'crewUp' | 'lostDay' | 'wrap';

const ORDER: { key: ViewKey; title: string; sub: string }[] = [
  { key: 'crewUp', title: 'Crew-up', sub: 'Who can be on set, and who cannot' },
  { key: 'lostDay', title: 'The lost day', sub: 'Re-slot before the sheet goes out' },
  { key: 'wrap', title: 'Wrap', sub: 'What day eighty owes' },
];

const FIRST = PRODUCTION.prepStartDay;
const LAST = PRODUCTION.shootDays + 1;

function days(): number[] {
  const out: number[] = [];
  for (let d: number = FIRST; d <= LAST; d += 1) if (d !== 0) out.push(d);
  return out;
}

const DAYS = days();
const BY_DAY = new Map(SHOOT_DAYS.map((d) => [d.day, d]));

function segmentClass(day: number, lostDay: number): string {
  if (day < 1) return 'bg-line';
  if (day > PRODUCTION.shootDays) return 'bg-ink';
  if (day === lostDay) return 'bg-strip-lost';
  const sd = BY_DAY.get(day);
  if (!sd) return 'bg-line';
  const loc = locationById(sd.locationId);
  if (loc.kind === 'stage') return 'bg-surface border border-line-strong';
  return loc.exterior ? 'bg-strip-dayext' : 'bg-strip-nightint';
}

function pct(day: number): number {
  const idx = DAYS.indexOf(day);
  return ((idx + 0.5) / DAYS.length) * 100;
}

export default function Timeline({ view, onChange, lostDay }: { view: ViewKey; onChange: (v: ViewKey) => void; lostDay: number }) {
  const momentDay = (key: ViewKey): number => (key === 'lostDay' ? lostDay - 1 : MOMENTS[key].day);
  return (
    <nav aria-label="Moments in the production" className="border-b border-line bg-paper">
      <div className="mx-auto max-w-7xl px-5 pb-4 pt-5 lg:px-8">
        {/* the track */}
        <div className="relative">
          <div className="flex h-2.5 w-full gap-px overflow-hidden rounded-sm" aria-hidden>
            {DAYS.map((d) => (
              <div key={d} className={`min-w-0 flex-1 transition-colors ${segmentClass(d, lostDay)}`} title={`Day ${d}`} />
            ))}
          </div>
          {ORDER.map(({ key }) => {
            const on = view === key;
            return (
              <span
                key={key}
                aria-hidden
                className={`absolute -top-[5px] h-5 w-5 -translate-x-1/2 rounded-full border-[3px] border-paper transition-all ${
                  on ? 'bg-ink shadow-lift' : 'bg-line-strong'
                }`}
                style={{ left: `${pct(momentDay(key))}%` }}
              />
            );
          })}
          <div className="mt-1.5 flex justify-between text-2xs text-faint" aria-hidden>
            <span>Prep · Day −21</span>
            <span>Day 1 · {shortDate(dayToDate(1))}</span>
            <span>Day 79 · {shortDate(dayToDate(79))}</span>
          </div>
        </div>

        {/* the moments */}
        <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
          {ORDER.map(({ key, title, sub }) => {
            const m = { day: momentDay(key), time: MOMENTS[key].time };
            const on = view === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onChange(key)}
                aria-current={on ? 'page' : undefined}
                className={`group rounded-lg border px-3 py-2.5 text-left transition-all sm:px-4 sm:py-3 ${
                  on ? 'border-ink bg-surface shadow-lift' : 'border-line bg-surface/60 hover:border-line-strong hover:bg-surface hover:shadow-card'
                }`}
              >
                <div className="tnum text-2xs font-medium uppercase tracking-eyebrow text-muted">
                  <span>Day {m.day < 0 ? `−${Math.abs(m.day)}` : m.day}</span>
                  <span className="hidden sm:inline"> · {shortDate(dayToDate(m.day))} · {clock(m.time)}</span>
                </div>
                <div className={`mt-0.5 font-display text-[17px] leading-tight sm:text-lg ${on ? 'text-ink' : 'text-body group-hover:text-ink'}`}>{title}</div>
                <div className="mt-0.5 hidden text-xs text-muted sm:block">{sub}</div>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
