import { useEffect, useMemo, useRef } from 'react';
import type { Placement, Scene } from '../engine';
import { PRODUCTION, dayToDate, formatEighths, locationById, restDayAfter, sceneByNumber, shootDay, shortDate } from '../engine';

/* ===========================================================================
   THE STRIPBOARD

   The wall of colored strips every production office has had since strips
   were cardboard. One column per shoot day, one strip per scene, height by
   page count, color by the convention: yellow day exterior, green night
   exterior, white day interior, blue night interior. The lost day's strips
   are salmon, and when the reader picks an option they move.
   =========================================================================== */

export interface Move {
  scene: string;
  fromDay: number;
  toDay: number;
  unit?: 'main' | 'second';
}

function stripClass(sc: Scene, lost: boolean): string {
  if (lost) return 'bg-strip-lost border-block-edge';
  if (sc.intExt === 'EXT') return sc.time === 'NIGHT' ? 'bg-strip-nightext border-clear-edge' : 'bg-strip-dayext border-review-edge';
  return sc.time === 'NIGHT' ? 'bg-strip-nightint border-accent-edge' : 'bg-strip-dayint border-line-strong';
}

function dayHeading(day: number): { label: string; date: string; where: string } {
  if (!Number.isInteger(day)) {
    const sat = Math.floor(day);
    const iso = restDayAfter(sat);
    return { label: 'Rest day', date: iso ? shortDate(iso) : '', where: 'Sunday' };
  }
  const d = shootDay(day);
  const loc = locationById(d.locationId);
  return { label: `Day ${day}`, date: shortDate(dayToDate(day)), where: loc.name.replace(/^Stage [A-Z]\d? · /, '') };
}

export default function Stripboard({
  days,
  lostDay,
  moves,
  kept,
  canceledTomorrow,
  opensDay,
  placements,
}: {
  days: readonly number[];
  lostDay: number;
  moves: readonly Move[];
  /** Scenes that stay on the lost day and still shoot: the afternoon of a split day. */
  kept: readonly string[];
  canceledTomorrow: boolean;
  opensDay: number | null;
  placements: readonly Placement[];
}) {
  const columns = useMemo(() => {
    const restTargets = moves.map((m) => m.toDay).filter((d) => !Number.isInteger(d));
    const all = [...new Set([...days, ...restTargets])].sort((a, b) => a - b);
    return all.map((day) => {
      const base = Number.isInteger(day) ? [...shootDay(day).scenes] : [];
      const removed = new Set(moves.filter((m) => m.fromDay === day).map((m) => m.scene));
      const keptHere = base.filter((n) => !removed.has(n));
      const added = moves.filter((m) => m.toDay === day).map((m) => m.scene);
      // On the lost day the cover scenes come first: they shoot in the morning.
      const scenes = day === lostDay ? [...added, ...keptHere] : [...keptHere, ...added];
      // The header names where the day is, which after a move is not where it was.
      const shortName = (id: string) => locationById(id).name.replace(/^Stage [A-Z]\d? · /, '');
      let where: string | null = null;
      if (Number.isInteger(day) && added.length > 0) {
        const here = shootDay(day).locationId;
        const fromElsewhere = [...new Set(added.map((n) => shootDay(moves.find((m) => m.scene === n)!.fromDay).locationId))].filter((id) => id !== here);
        if (fromElsewhere.length > 0) {
          const incoming = fromElsewhere.map(shortName).join(' / ');
          where = keptHere.length === 0 ? incoming : day === lostDay ? `${incoming} → ${shortName(here)}` : `${shortName(here)} + ${incoming}`;
        }
      }
      return { day, scenes, added: new Set(added), removedCount: removed.size, where };
    });
  }, [days, moves, lostDay]);

  const otByDay = useMemo(() => {
    const m = new Map<number, number>();
    for (const p of placements) m.set(p.toDay, (m.get(p.toDay) ?? 0) + p.overtimeHours);
    return m;
  }, [placements]);

  const unitOf = useMemo(() => new Map(moves.map((m) => [m.scene, m.unit ?? 'main'])), [moves]);
  const moved = moves.length > 0;
  const keptSet = new Set(kept);

  // On a phone the board is wider than the screen. Open it on tomorrow, not on Day 46.
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current;
    if (!el || el.scrollWidth <= el.clientWidth + 4) return;
    const col = el.querySelector<HTMLElement>(`[data-day="${lostDay}"]`);
    if (col) el.scrollLeft = Math.max(0, col.offsetLeft - 8);
  }, [lostDay, moves]);

  return (
    <div ref={scroller} className="overflow-x-auto">
      <div className="flex min-w-[88rem] gap-1.5 px-1 pb-1">
        {columns.map(({ day, scenes, added, removedCount, where }) => {
          const head = dayHeading(day);
          const whereLabel = where ?? head.where;
          const isLost = day === lostDay;
          // The column reads as lost until something fills it. A cover set
          // makes it an ordinary stage day; a cancellation keeps it red.
          const tinted = isLost && (!moved || canceledTomorrow);
          const isOpen = opensDay === day;
          const total = scenes.reduce((n, s) => n + sceneByNumber(s).eighths, 0);
          const ot = otByDay.get(day) ?? 0;
          const rest = !Number.isInteger(day);
          return (
            <div
              key={day}
              data-day={day}
              className={`flex min-w-0 flex-1 flex-col rounded-md border ${
                tinted ? 'border-block-edge bg-block-wash/60' : rest ? 'border-dashed border-line-strong bg-sunken/60' : 'border-line bg-surface'
              }`}
            >
              <div className="border-b border-line/80 px-2 py-1.5">
                <div className={`tnum text-2xs font-semibold ${tinted ? 'text-block-deep' : 'text-ink'}`}>{head.label}</div>
                <div className="tnum whitespace-nowrap text-2xs text-muted">{head.date}</div>
                <div className="line-clamp-2 text-2xs leading-tight text-muted" title={whereLabel}>
                  {whereLabel}
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-1 px-1 py-1.5">
                {isLost && canceledTomorrow ? (
                  <div className="flex flex-1 items-center justify-center rounded-sm border border-dashed border-block-edge px-1 py-4 text-center text-2xs font-medium text-block-deep">
                    Day canceled
                  </div>
                ) : null}
                {isOpen && scenes.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center rounded-sm border border-dashed border-review-edge px-1 py-4 text-center text-2xs font-medium text-review-deep">
                    Opens · hold as cover
                  </div>
                ) : null}
                {scenes.map((n) => {
                  const sc = sceneByNumber(n);
                  const wasMoved = added.has(n);
                  const keptHere = isLost && keptSet.has(n);
                  const lost = isLost && !wasMoved && !keptHere && !moved ? true : isLost && !wasMoved && !keptHere;
                  const from = moves.find((m) => m.scene === n)?.fromDay;
                  const unit = unitOf.get(n) ?? 'main';
                  return (
                    <div
                      key={n}
                      className={`animate-rise rounded-sm border px-1 py-1 ${stripClass(sc, lost)} ${wasMoved || keptHere ? 'ring-2 ring-ink/60 ring-offset-1 ring-offset-surface' : ''}`}
                      style={{ minHeight: `${Math.max(26, sc.eighths * 2.6)}px` }}
                      title={`Sc ${sc.number} · ${sc.intExt}. ${sc.set} — ${sc.time} · ${formatEighths(sc.eighths)} pp · cast ${sc.cast.join(', ')}`}
                    >
                      <div className="flex items-baseline justify-between gap-1">
                        <span className="tnum whitespace-nowrap text-2xs font-semibold text-ink">{sc.number}</span>
                        {sc.time !== 'DAY' ? (
                          <span className="rounded-sm border border-ink/25 px-0.5 text-[9px] font-medium leading-[13px] tracking-tight text-ink/80">
                            {sc.time === 'NIGHT' ? 'N' : sc.time}
                          </span>
                        ) : null}
                        <span className="tnum whitespace-nowrap text-2xs text-ink/60">{formatEighths(sc.eighths)}</span>
                      </div>
                      <div className="line-clamp-2 text-[10px] leading-tight tracking-tight text-ink/80">{sc.set}</div>
                      {wasMoved && from !== undefined ? (
                        <div className="mt-0.5 text-2xs font-medium text-ink">
                          ← from {from}
                          {unit === 'second' ? <span className="ml-1 rounded-sm bg-ink px-1 text-paper">2nd unit</span> : null}
                        </div>
                      ) : null}
                      {keptHere ? <div className="mt-0.5 text-2xs font-medium text-ink">after the move</div> : null}
                    </div>
                  );
                })}
              </div>

              <div className="flex items-baseline justify-between border-t border-line/80 px-2 py-1">
                <span className="tnum whitespace-nowrap text-2xs text-muted">{formatEighths(total)} pp</span>
                {ot > 0 ? <span className="tnum text-2xs font-medium text-review-deep">+{ot.toFixed(1)} hrs</span> : null}
                {removedCount > 0 && scenes.length === 0 && !isLost ? <span className="text-2xs text-muted">empty</span> : null}
              </div>
            </div>
          );
        })}
        {/* The board ends. Every schedule does, and nothing is after it. */}
        {columns[columns.length - 1]!.day < PRODUCTION.shootDays ? (
          <div className="flex w-6 shrink-0 items-center justify-center text-faint" aria-hidden>
            ···
          </div>
        ) : null}
        <div className="flex w-16 shrink-0 flex-col rounded-md border border-ink bg-ink text-paper">
          <div className="px-2 py-1.5">
            <div className="tnum text-2xs font-semibold">End of</div>
            <div className="tnum font-display text-lg leading-tight">Day {PRODUCTION.shootDays}</div>
          </div>
          <div className="flex flex-1 items-end px-2 pb-2 text-2xs leading-tight text-paper/70">nothing after it</div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-2xs text-muted">
        <Legend cls="bg-strip-dayext border-review-edge" label="Day exterior" />
        <Legend cls="bg-strip-nightext border-clear-edge" label="Night exterior" />
        <Legend cls="bg-strip-dayint border-line-strong" label="Day interior" />
        <Legend cls="bg-strip-nightint border-accent-edge" label="Night interior" />
        <Legend cls="bg-strip-lost border-block-edge" label="Lost" />
        <span className="sm:hidden">Swipe sideways for the rest of the board.</span>
        <span className="ml-auto">The board's own colors. Strip height is page count.</span>
      </div>
    </div>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-3 w-4 rounded-[3px] border ${cls}`} aria-hidden />
      {label}
    </span>
  );
}
