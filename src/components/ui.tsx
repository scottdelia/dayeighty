import type { ReactNode } from 'react';
import type { CrewVerdict, Feasibility, Finding, Severity } from '../engine';
import { dayLabel, formatUsd } from '../engine';

/* Shared primitives. Deliberately few. A demo that grows a component library
   grows inconsistencies to hide in. */

export function Card({ children, className = '', id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`card ${className}`}>
      {children}
    </section>
  );
}

export function CardHead({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <header className="card-head">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
        {sub ? <p className="mt-0.5 text-xs text-muted">{sub}</p> : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </header>
  );
}

export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`eyebrow ${className}`}>{children}</span>;
}

/* ---------------------------------------------------------------------------
   Color is the severity enum. These maps are the only place a tier becomes a
   color, so a red thing on this page always means exactly one thing.
   --------------------------------------------------------------------------- */
export const SEV_CHIP: Record<Severity, string> = {
  block: 'border-block-edge bg-block-wash text-block-deep',
  review: 'border-review-edge bg-review-wash text-review-deep',
  open: 'border-open-edge bg-open-wash text-open-deep',
  clear: 'border-clear-edge bg-clear-wash text-clear-deep',
};

export const SEV_DOT: Record<Severity, string> = {
  block: 'bg-block',
  review: 'bg-review',
  open: 'bg-open',
  clear: 'bg-clear',
};

export const SEV_TEXT: Record<Severity, string> = {
  block: 'text-block',
  review: 'text-review',
  open: 'text-open',
  clear: 'text-clear',
};

export const SEV_BAR: Record<Severity, string> = SEV_DOT;

export const SEV_LABEL: Record<Severity, string> = {
  block: 'Blocked',
  review: 'Review',
  open: 'Open',
  clear: 'Clear',
};

export const VERDICT_SEV: Record<CrewVerdict, Severity> = {
  BLOCKED: 'block',
  EXPOSED: 'review',
  OPEN: 'open',
  CLEARED: 'clear',
};

export const VERDICT_LABEL: Record<CrewVerdict, string> = {
  BLOCKED: 'Blocked',
  EXPOSED: 'Exposed',
  OPEN: 'Open',
  CLEARED: 'Cleared',
};

export const FEAS_SEV: Record<Feasibility, Severity> = {
  feasible: 'clear',
  partial: 'review',
  infeasible: 'block',
};

export const FEAS_LABEL: Record<Feasibility, string> = {
  feasible: 'Feasible',
  partial: 'Partly feasible',
  infeasible: 'Not feasible',
};

export function Chip({ sev, children, className = '' }: { sev: Severity; children: ReactNode; className?: string }) {
  return (
    <span className={`chip ${SEV_CHIP[sev]} ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${SEV_DOT[sev]}`} aria-hidden />
      {children}
    </span>
  );
}

export function VerdictChip({ verdict }: { verdict: CrewVerdict }) {
  return <Chip sev={VERDICT_SEV[verdict]}>{VERDICT_LABEL[verdict]}</Chip>;
}

export function Stat({
  label,
  value,
  sub,
  tone = 'ink',
  className = '',
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Severity | 'ink';
  className?: string;
}) {
  return (
    <div className={`card px-5 py-4 ${className}`}>
      <Eyebrow>{label}</Eyebrow>
      <div className={`tnum mt-1.5 text-[1.85rem] font-semibold leading-none tracking-tight ${tone === 'ink' ? 'text-ink' : SEV_TEXT[tone]}`}>
        {value}
      </div>
      {sub ? <div className="mt-2 text-xs leading-snug text-muted">{sub}</div> : null}
    </div>
  );
}

/** An em dash is not a zero. Used wherever a value is genuinely unknown. */
export function Unknown({ children }: { children?: ReactNode }) {
  return (
    <span className="text-muted" title="Unknown. Not zero.">
      {children ?? '—'}
    </span>
  );
}

export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border border-line bg-sunken p-0.5">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`rounded-[7px] px-3 py-1 text-xs font-medium transition-all ${
              on ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Slider({
  name,
  label,
  value,
  min,
  max,
  step = 1,
  format,
  onChange,
  caption,
}: {
  name: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  caption: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={name} className="font-mono text-xs text-body">
          {name}
        </label>
        <span className="tnum text-sm font-semibold text-ink">{format(value)}</span>
      </div>
      <p className="mt-0.5 text-xs text-muted">{label}</p>
      <input
        id={name}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2"
      />
      <p className="mt-1.5 max-w-[52ch] text-xs leading-relaxed text-muted">{caption}</p>
    </div>
  );
}

/** One finding, rendered the same way everywhere it appears. */
export function FindingRow({ f, dense = false }: { f: Finding; dense?: boolean }) {
  return (
    <li className={`${dense ? 'py-2.5' : 'py-3.5'} pl-4 pr-1`}>
      <div className="relative">
        <span className={`absolute -left-4 top-[7px] h-2 w-2 rounded-full ${SEV_DOT[f.severity]}`} aria-hidden />
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h4 className={`${dense ? 'text-[13.5px]' : 'text-[15px]'} font-semibold leading-snug text-ink`}>{f.title}</h4>
          <span className="tnum shrink-0 text-xs text-muted">
            {f.costCents === null ? (
              f.severity === 'block' ? <Unknown>not priced</Unknown> : ''
            ) : (
              <span className="text-body">{formatUsd(f.costCents)}</span>
            )}
          </span>
        </div>
        {f.detail ? <p className={`mt-1 max-w-[72ch] ${dense ? 'text-xs' : 'text-[13.5px]'} leading-relaxed text-body`}>{f.detail}</p> : null}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-muted">
          <span className="font-mono">{f.source}</span>
          {f.dueDay !== null ? <span>· due {dayLabel(f.dueDay)}</span> : null}
        </div>
      </div>
    </li>
  );
}

export function FindingList({ findings, dense = false, empty }: { findings: readonly Finding[]; dense?: boolean; empty?: string }) {
  if (findings.length === 0) return <p className="px-5 py-4 text-sm text-muted">{empty ?? 'Nothing to report.'}</p>;
  return <ul className="divide-y divide-line px-5">{findings.map((f, i) => <FindingRow key={`${f.code}-${i}`} f={f} dense={dense} />)}</ul>;
}

/** A stacked bar of verdict shares. Reads left to right, worst first. */
export function TallyBar({ tally, total }: { tally: Record<CrewVerdict, number>; total: number }) {
  const order: CrewVerdict[] = ['BLOCKED', 'EXPOSED', 'OPEN', 'CLEARED'];
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-sunken" aria-hidden>
      {order.map((v) =>
        tally[v] > 0 ? (
          <div key={v} className={`${SEV_BAR[VERDICT_SEV[v]]} transition-all`} style={{ width: `${(tally[v] / Math.max(1, total)) * 100}%` }} />
        ) : null,
      )}
    </div>
  );
}
