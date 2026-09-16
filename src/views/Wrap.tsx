import { useMemo, useState } from 'react';
import { CREW_COUNT, MOMENTS, PRODUCTION, buildWrapReport, clock, dayLabel, dayToDate, formatUsd, longDate, shortDate, wrapDayDate } from '../engine';
import type { WrapCategory } from '../engine';
import { Card, CardHead, Eyebrow, FindingList, SEV_DOT, Stat } from '../components/ui';

const M = MOMENTS.wrap;

const CATEGORY_LABEL: Record<WrapCategory, string> = {
  rentals: 'Rentals',
  locations: 'Locations',
  people: 'People',
  media: 'Media',
  cast: 'Cast',
  money: 'Money',
};

const CATEGORY_SUB: Record<WrapCategory, string> = {
  rentals: 'Gear goes back on a date, and the meter runs on the whole order until the last item does.',
  locations: 'Deposits come back on sign-off, and sign-off has to be asked for.',
  people: 'Final pay, petty cash, and the hotel block that ends before the flights do.',
  media: 'The negative of the series, on drives, in a van.',
  cast: 'Options lapse on a date whether or not anyone decides.',
  money: 'The incentive audit and the insurer, each with a deadline.',
};

const ORDER: WrapCategory[] = ['media', 'rentals', 'people', 'locations', 'money', 'cast'];

export default function Wrap() {
  const [cat, setCat] = useState<WrapCategory | 'all'>('all');
  const report = useMemo(() => buildWrapReport({ asOfDay: M.day }), []);

  const open = report.findings.filter((f) => f.severity !== 'clear');
  const blocks = report.findings.filter((f) => f.severity === 'block');
  const thisWeek = report.findings.filter((f) => f.dueDay !== null && f.dueDay <= PRODUCTION.shootDays + 7);
  const visible = cat === 'all' ? ORDER : [cat];

  return (
    <div className="animate-rise">
      {/* ------------------------------- HERO ------------------------------- */}
      <header className="mx-auto max-w-7xl px-5 pb-8 pt-10 lg:px-8 lg:pt-14">
        <Eyebrow>
          {longDate(dayToDate(M.day))} · {clock(M.time)} · {dayLabel(M.day)} of {PRODUCTION.shootDays} · {M.label}
        </Eyebrow>
        <h1 className="mt-3 max-w-[22ch] font-display text-[2.4rem] leading-[1.05] text-ink sm:text-[3rem]">
          Everyone leaves tomorrow. The production does not.
        </h1>
        <p className="mt-5 max-w-[64ch] text-[16px] leading-relaxed text-body">
          On day eighty the {CREW_COUNT} people who made this disappear, never to stand in one place again. What they leave behind is owed: to rental
          houses on a date, to locations on sign-off, to a bond company on a checksum, to {report.byCategory.cast.length} actors whose options lapse on a
          calendar that does not know the shoot is over. Every one of these was derivable from the production's own records on day one. Nobody had
          time. This page had time.
        </p>
        <div className="mt-6 inline-flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-line bg-surface px-4 py-3 shadow-card">
          <span className="font-display text-[17px] text-ink">Day eighty is a list. The list was always there.</span>
          <span className="text-xs text-muted">Generated from the same records the other two views use.</span>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 pb-16 lg:px-8">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Open items" value={open.length} sub={`${blocks.length} of them block something: a bond sign-off and an armorer's license.`} tone={blocks.length > 0 ? 'block' : 'ink'} />
          <Stat
            label="Per day, if nobody acts"
            value={formatUsd(report.exposurePerDayCents, { compact: true })}
            tone="review"
            sub="Late fees and hotel overrun that start accruing once each deadline passes. Deposits at risk are not in this figure; they are a sum, not a rate."
          />
          <Stat label="Due this week" value={thisWeek.length} sub={`Deadlines between ${dayLabel(PRODUCTION.shootDays + 1)} and ${dayLabel(PRODUCTION.shootDays + 7)}.`} />
          <Stat label="Cannot be computed" value={report.cannotCompute.length} sub="By design. Listed at the bottom with the reason for each." />
        </div>

        {/* ----------------------------- DEADLINES ----------------------------- */}
        <Card className="mt-8">
          <CardHead title="The next three weeks" sub="One column per calendar day after wrap. A dot per item due." />
          <div className="overflow-x-auto px-5 py-4">
            <DeadlineRail deadlines={report.deadlines} />
          </div>
          <p className="px-5 pb-3 text-2xs text-muted sm:hidden">Swipe sideways for the later days.</p>
        </Card>

        {/* ----------------------------- CATEGORIES ---------------------------- */}
        <div className="mt-8 flex flex-wrap items-center gap-1.5">
          {(['all', ...ORDER] as const).map((c) => {
            const on = cat === c;
            const n = c === 'all' ? report.findings.length : report.byCategory[c].length;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCat(c)}
                aria-pressed={on}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${on ? 'border-ink bg-ink text-paper' : 'border-line bg-surface text-body hover:border-line-strong'}`}
              >
                {c === 'all' ? 'Everything' : CATEGORY_LABEL[c]} <span className={`tnum ${on ? 'text-paper/70' : 'text-muted'}`}>{n}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-5 xl:grid-cols-2">
          {visible.map((c) => (
            <Card key={c}>
              <CardHead title={CATEGORY_LABEL[c]} sub={CATEGORY_SUB[c]} right={<span className="tnum text-2xs text-muted">{report.byCategory[c].length}</span>} />
              <FindingList findings={report.byCategory[c]} dense />
            </Card>
          ))}
        </div>

        {/* --------------------------- NOT COMPUTABLE -------------------------- */}
        <Card className="mt-8">
          <CardHead title="Not computable from here, by design" sub="Each of these would be easy to fake. None is." />
          <ul className="divide-y divide-line">
            {report.cannotCompute.map((c, i) => (
              <li key={i} className="grid grid-cols-1 gap-x-6 gap-y-1 px-5 py-3.5 md:grid-cols-[14rem_minmax(0,1fr)]">
                <span className="text-sm font-semibold text-ink">{c.what}</span>
                <span className="text-[13.5px] leading-relaxed text-body">{c.why}</span>
              </li>
            ))}
          </ul>
        </Card>

        <p className="mt-4 max-w-[80ch] text-xs leading-relaxed text-muted">
          Counts in this view are fabricated from the fixed seed: how many time cards are open, how many advances, which location has a damage report. The
          rules are not: a licensed weapon is a licensing matter and not a fee, two unverified days block a bond sign-off, an option lapses on its date.
          Point the same rules at a real rental log and a real LTO log and every number becomes a measurement.
        </p>
      </div>
    </div>
  );
}

function DeadlineRail({ deadlines }: { deadlines: { day: number; items: { severity: 'block' | 'review' | 'open' | 'clear'; title: string }[] }[] }) {
  const first = PRODUCTION.shootDays + 1;
  const last = PRODUCTION.shootDays + 21;
  const byDay = new Map(deadlines.map((d) => [d.day, d.items]));
  const later = deadlines.filter((d) => d.day > last);
  const cols: number[] = [];
  for (let d = first; d <= last; d += 1) cols.push(d);
  return (
    <div className="flex min-w-[52rem] gap-1">
      {cols.map((d) => {
        const items = byDay.get(d) ?? [];
        const iso = wrapDayDate(d);
        const weekend = ['Sat', 'Sun'].includes(shortDate(iso).slice(0, 3));
        return (
          <div key={d} className={`flex min-w-0 flex-1 flex-col items-center rounded-md border px-1 py-2 ${weekend ? 'border-line/60 bg-sunken/50' : 'border-line bg-surface'}`}>
            <span className="tnum text-2xs font-semibold text-ink">{d}</span>
            <span className="tnum text-2xs text-muted">{shortDate(iso).slice(4)}</span>
            <div className="mt-2 flex min-h-[2.5rem] flex-wrap justify-center gap-1">
              {items.map((it, i) => (
                <span key={i} className={`h-2 w-2 rounded-full ${SEV_DOT[it.severity]}`} title={it.title} />
              ))}
            </div>
          </div>
        );
      })}
      <div className="flex min-w-[4rem] flex-col items-center rounded-md border border-dashed border-line-strong px-1 py-2">
        <span className="text-2xs font-semibold text-ink">later</span>
        <span className="text-2xs text-muted">&nbsp;</span>
        <div className="mt-2 flex min-h-[2.5rem] flex-wrap justify-center gap-1">
          {later.flatMap((d) => d.items).map((it, i) => (
            <span key={i} className={`h-2 w-2 rounded-full ${SEV_DOT[it.severity]}`} title={it.title} />
          ))}
        </div>
      </div>
    </div>
  );
}
