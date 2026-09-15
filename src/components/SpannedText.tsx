import { useMemo } from 'react';
import type { BreakdownFact } from '../engine';

/* ===========================================================================
   SIGNATURE ELEMENT

   The reader claims to have read a fact out of a scene page. This renders the
   exact characters it says it read, keeps them linked to the fact they
   produced, and lights both ends when you touch either one.

   The point is not decoration. A first assistant director can check the
   model's work without trusting it: you can see which words produced which
   booking, and — because facts inferred from what the page does NOT say have
   no span and light nothing — you can see exactly which conclusions came from
   nowhere on the page. Those are the ones worth arguing with.
   =========================================================================== */

interface Group {
  text: string;
  facts: number[];
}

function groupByCoverage(text: string, facts: readonly BreakdownFact[]): Group[] {
  const cover: number[][] = Array.from({ length: text.length }, () => []);
  facts.forEach((f, i) => {
    if (!f.span) return;
    for (let c = f.span.start; c < f.span.end && c < text.length; c += 1) cover[c]!.push(i);
  });
  const groups: Group[] = [];
  let start = 0;
  const key = (i: number) => cover[i]!.join(',');
  for (let i = 1; i <= text.length; i += 1) {
    if (i === text.length || key(i) !== key(start)) {
      groups.push({ text: text.slice(start, i), facts: cover[start]! });
      start = i;
    }
  }
  return groups;
}

/* Marks are tinted by what kind of fact they feed, not by how sure the reader
   is. Booking-shaped facts (people, animals, water, fire) are the ones that
   cost money if misread, so they get the warmer mark. */
const BOOKING_KEYS = new Set(['cast', 'background', 'animals', 'stunts', 'water', 'fire', 'minor_present', 'prep_days']);

function toneFor(factIdxs: number[], facts: readonly BreakdownFact[], lit: boolean): string {
  const covering = factIdxs.map((i) => facts[i]!);
  const booking = covering.some((f) => BOOKING_KEYS.has(f.key));
  const shaky = Math.min(...covering.map((f) => f.conf)) < 0.75;
  if (booking) return lit ? 'bg-review-edge/70' : 'bg-review-wash';
  if (shaky) return lit ? 'bg-open-edge' : 'bg-open-wash';
  return lit ? 'bg-accent-edge' : 'bg-accent-soft';
}

export function SpannedPage({
  text,
  facts,
  lit,
  onLit,
}: {
  text: string;
  facts: readonly BreakdownFact[];
  lit: number | null;
  onLit: (i: number | null) => void;
}) {
  const groups = useMemo(() => groupByCoverage(text, facts), [text, facts]);
  const [slug, ...rest] = text.split('\n\n');
  void slug;
  void rest;
  return (
    <p className="whitespace-pre-wrap font-mono text-[13.5px] leading-[1.75] text-ink">
      {groups.map((g, gi) => {
        if (g.facts.length === 0) return <span key={gi}>{g.text}</span>;
        const isLit = lit !== null && g.facts.includes(lit);
        return (
          <mark
            key={gi}
            className={`span-mark text-ink ${toneFor(g.facts, facts, isLit)} ${isLit ? 'ring-1 ring-ink/30' : ''}`}
            onMouseEnter={() => onLit(g.facts[0]!)}
            onMouseLeave={() => onLit(null)}
          >
            {g.text}
          </mark>
        );
      })}
    </p>
  );
}

export function FactList({
  facts,
  lit,
  onLit,
}: {
  facts: readonly BreakdownFact[];
  lit: number | null;
  onLit: (i: number | null) => void;
}) {
  return (
    <ul className="divide-y divide-line">
      {facts.map((f, i) => {
        const inferred = f.span === null;
        const isLit = lit === i;
        return (
          <li key={f.key}>
            <button
              type="button"
              onMouseEnter={() => onLit(i)}
              onMouseLeave={() => onLit(null)}
              onFocus={() => onLit(i)}
              onBlur={() => onLit(null)}
              className={`w-full px-4 py-2.5 text-left transition-colors ${isLit ? 'bg-sunken' : 'hover:bg-sunken/60'}`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-mono text-2xs text-muted">{f.key}</span>
                <span className="tnum shrink-0 text-2xs text-muted">{Math.round(f.conf * 100)}%</span>
              </div>
              <div className="mt-0.5 text-[13.5px] font-medium text-ink">{f.value}</div>
              <div className="mt-1.5 h-[3px] w-full rounded-full bg-sunken">
                <div className={`h-[3px] rounded-full ${f.conf < 0.75 ? 'bg-review' : 'bg-accent'}`} style={{ width: `${Math.round(f.conf * 100)}%` }} />
              </div>
              {inferred ? (
                <div className="mt-1.5 text-2xs font-medium text-review-deep">Inferred · nothing on the page to light</div>
              ) : null}
              {f.note ? <p className="mt-1 max-w-[60ch] text-xs leading-relaxed text-muted">{f.note}</p> : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
