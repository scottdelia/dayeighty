import { useMemo, useState } from 'react';
import { ChevronRight, X } from 'lucide-react';
import {
  CREW_COUNT,
  GATES,
  MOMENTS,
  SOFT_LABELS,
  adjudicateAll,
  arrivalCurve,
  blockerPareto,
  dayLabel,
  dayToDate,
  generateCrew,
  longDate,
  summarizeDepartments,
  clock,
} from '../engine';
import type { CrewMember, CrewVerdict, GateKey } from '../engine';
import { Card, CardHead, Eyebrow, FindingList, SEV_DOT, Segmented, Slider, Stat, TallyBar, VerdictChip } from '../components/ui';

const M = MOMENTS.crewUp;

type Horizon = 1 | 3 | 7 | 14 | 99;

export default function CrewUp() {
  const [horizon, setHorizon] = useState<Horizon>(1);
  const [dept, setDept] = useState<string | null>(null);
  const [personId, setPersonId] = useState<string | null>(null);
  const [rtwLead, setRtwLead] = useState(GATES.right_to_work.assumed_lead_days);
  const [minorLead, setMinorLead] = useState(GATES.minor_permit.assumed_lead_days);
  const [animalLead, setAnimalLead] = useState(GATES.animal_handler_cert.assumed_lead_days);

  const crew = useMemo(() => generateCrew({ asOfDay: M.day }), []);
  const ctx = useMemo(
    () => ({ asOfDay: M.day, leadDays: { right_to_work: rtwLead, minor_permit: minorLead, animal_handler_cert: animalLead } as Partial<Record<GateKey, number>> }),
    [rtwLead, minorLead, animalLead],
  );
  const adj = useMemo(() => adjudicateAll(crew, ctx), [crew, ctx]);
  const horizonDay = horizon === 99 ? 999 : horizon;
  const depts = useMemo(() => summarizeDepartments(crew, adj, horizonDay), [crew, adj, horizonDay]);
  const pareto = useMemo(() => blockerPareto(crew, adj, horizonDay).slice(0, 6), [crew, adj, horizonDay]);
  const curve = useMemo(() => arrivalCurve(crew, adj, -21, 14), [crew, adj]);

  const needed = crew.filter((m) => m.startsOnDay <= horizonDay);
  const tally: Record<CrewVerdict, number> = { BLOCKED: 0, EXPOSED: 0, OPEN: 0, CLEARED: 0 };
  for (const m of needed) tally[adj.get(m.id)!.verdict] += 1;

  const listed: CrewMember[] = useMemo(() => {
    const base = dept ? crew.filter((m) => m.department === dept) : crew.filter((m) => adj.get(m.id)!.verdict === 'BLOCKED' && m.startsOnDay <= horizonDay);
    const order: Record<CrewVerdict, number> = { BLOCKED: 0, EXPOSED: 1, OPEN: 2, CLEARED: 3 };
    return [...base].sort((a, b) => order[adj.get(a.id)!.verdict] - order[adj.get(b.id)!.verdict] || a.startsOnDay - b.startsOnDay);
  }, [crew, adj, dept, horizonDay]);

  const person = personId ? crew.find((m) => m.id === personId) ?? null : null;
  const personAdj = person ? adj.get(person.id)! : null;

  const horizonLabel = horizon === 99 ? 'the whole shoot' : dayLabel(horizon);

  return (
    <div className="animate-rise">
      {/* ------------------------------- HERO ------------------------------- */}
      <header className="mx-auto max-w-7xl px-5 pb-8 pt-10 lg:px-8 lg:pt-14">
        <Eyebrow>
          {longDate(dayToDate(M.day))} · {clock(M.time)} · {dayLabel(M.day)} · {M.label}
        </Eyebrow>
        <h1 className="mt-3 max-w-[20ch] font-display text-[2.4rem] leading-[1.05] text-ink sm:text-[3rem]">
          Three hundred six people who did not exist last week.
        </h1>
        <p className="mt-5 max-w-[64ch] text-[16px] leading-relaxed text-body">
          One week to Day 1. Every one of them needs a signed deal memo, an NDA, a safety orientation and work authorization in a country most of them
          flew into. The office cannot hurry a consulate. It can know, tonight, who the consulate is going to make late, and move the schedule
          instead of the person.
        </p>
        <div className="mt-6 inline-flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-line bg-surface px-4 py-3 shadow-card">
          <span className="font-display text-[17px] text-ink">A gate has a lead time. A person has a start date. The rules subtract.</span>
          <span className="text-xs text-muted">No model in this path.</span>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 pb-16 lg:px-8">
        {/* ------------------------------ STATS ------------------------------ */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Eyebrow>Needed by</Eyebrow>
            <div className="mt-1.5">
              <Segmented<Horizon>
                label="Horizon"
                value={horizon}
                onChange={(v) => {
                  setHorizon(v);
                  setPersonId(null);
                }}
                options={[
                  { value: 1, label: 'Day 1' },
                  { value: 3, label: 'Day 3' },
                  { value: 7, label: 'Day 7' },
                  { value: 14, label: 'Day 14' },
                  { value: 99, label: 'All 79' },
                ]}
              />
            </div>
          </div>
          <p className="max-w-[48ch] text-xs text-muted">
            {CREW_COUNT} people on the crew list. {needed.length} are needed by {horizonLabel}. The board below is about those {needed.length}.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label={`Needed by ${horizonLabel}`} value={needed.length} sub="People whose first set day is on or before the horizon." />
          <Stat label="Cleared" value={tally.CLEARED} tone="clear" sub="Every hard gate closed. Nothing to do but send the call sheet." />
          <Stat label="Cannot be on set" value={tally.BLOCKED} tone="block" sub="An open gate with a lead time longer than the days left. The schedule has to move, or the person is replaced." />
          <Stat label="With a third party" value={tally.EXPOSED} tone="review" sub={`Fits if it started today. Chase it. ${tally.OPEN} more are open and closeable in the office.`} />
        </div>

        {/* ------------------------------ BOARD ------------------------------ */}
        <div className="mt-8 grid grid-cols-1 items-start gap-5 xl:grid-cols-12">
          <Card className="xl:col-span-7">
            <CardHead title="By department" sub="Worst first. Click a department to see its people." right={<span className="text-2xs text-muted">{depts.length} departments</span>} />
            <ul className="divide-y divide-line">
              {[...depts]
                .sort((a, b) => sevOrder(a.severity) - sevOrder(b.severity) || b.tally.BLOCKED - a.tally.BLOCKED)
                .map((d) => {
                  const on = dept === d.department;
                  return (
                    <li key={d.department}>
                      <button
                        type="button"
                        onClick={() => {
                          setDept(on ? null : d.department);
                          setPersonId(null);
                        }}
                        aria-pressed={on}
                        className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-5 py-3 text-left transition-colors sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_auto] ${
                          on ? 'bg-sunken' : 'hover:bg-sunken/60'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 shrink-0 rounded-full ${SEV_DOT[d.severity]}`} aria-hidden />
                            <span className="truncate text-sm font-medium text-ink">{d.department}</span>
                          </div>
                          <div className="mt-0.5 pl-4 text-2xs text-muted">
                            {d.neededByHorizon} of {d.headcount} needed
                            {d.headVerdict === 'BLOCKED' ? <span className="ml-1.5 font-medium text-block-deep">· head blocked</span> : null}
                            {d.keyCleared === false && d.headVerdict !== 'BLOCKED' ? <span className="ml-1.5 text-review-deep">· no cleared second</span> : null}
                          </div>
                        </div>
                        <div className="col-span-2 mt-2 sm:col-span-1 sm:mt-0">
                          <TallyBar tally={d.tally} total={d.neededByHorizon} />
                          <div className="mt-1 flex justify-between text-2xs text-muted">
                            <span>
                              {d.tally.BLOCKED > 0 ? <span className="text-block-deep">{d.tally.BLOCKED} blocked</span> : null}
                              {d.tally.BLOCKED > 0 && d.tally.EXPOSED > 0 ? ' · ' : ''}
                              {d.tally.EXPOSED > 0 ? <span className="text-review-deep">{d.tally.EXPOSED} exposed</span> : null}
                              {(d.tally.BLOCKED > 0 || d.tally.EXPOSED > 0) && d.tally.OPEN > 0 ? ' · ' : ''}
                              {d.tally.OPEN > 0 ? <span>{d.tally.OPEN} open</span> : null}
                            </span>
                            {d.topBlocker ? <span className="truncate">{GATES[d.topBlocker.gate].label.toLowerCase()}</span> : <span className="text-clear-deep">clear</span>}
                          </div>
                        </div>
                        <ChevronRight className={`hidden h-4 w-4 text-faint transition-transform sm:block ${on ? 'rotate-90' : ''}`} aria-hidden />
                      </button>
                    </li>
                  );
                })}
            </ul>
          </Card>

          <div className="space-y-5 xl:col-span-5">
            <Card>
              <CardHead
                title={dept ?? 'Who cannot be on set'}
                sub={dept ? `${listed.length} people, worst first` : `${listed.length} people needed by ${horizonLabel}, worst first`}
                right={
                  dept ? (
                    <button type="button" onClick={() => setDept(null)} className="btn !px-2 !py-1 text-xs" aria-label="Clear department filter">
                      <X className="h-3.5 w-3.5" aria-hidden /> All
                    </button>
                  ) : null
                }
              />
              <ul className="max-h-[26rem] divide-y divide-line overflow-y-auto">
                {listed.slice(0, 80).map((m) => {
                  const a = adj.get(m.id)!;
                  const on = personId === m.id;
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => setPersonId(on ? null : m.id)}
                        aria-pressed={on}
                        className={`flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors ${on ? 'bg-sunken' : 'hover:bg-sunken/60'}`}
                      >
                        <span className="tnum w-[5.5rem] shrink-0 font-mono text-2xs text-muted">{m.id}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-ink">
                            {m.role}
                            {m.isHead ? <span className="ml-1.5 text-2xs text-muted">dept head</span> : null}
                          </span>
                          <span className="block text-2xs text-muted">
                            {m.department} · starts {dayLabel(m.startsOnDay)} · {m.residency}
                          </span>
                        </span>
                        <VerdictChip verdict={a.verdict} />
                      </button>
                    </li>
                  );
                })}
                {listed.length === 0 ? <li className="px-5 py-6 text-sm text-muted">Nobody. That is the good outcome.</li> : null}
              </ul>
            </Card>

            {person && personAdj ? (
              <Card>
                <CardHead
                  title={`${person.role} · ${person.department}`}
                  sub={`${person.id} · starts ${dayLabel(person.startsOnDay)} · ${personAdj.alreadyWorking ? 'already on the clock' : `${personAdj.daysUntilStart} days away`}`}
                  right={<VerdictChip verdict={personAdj.verdict} />}
                />
                <div className="px-5 py-3">
                  <Eyebrow>Gates</Eyebrow>
                  <ul className="mt-2 divide-y divide-line">
                    {(Object.keys(person.gates) as GateKey[]).map((k) => {
                      const closed = person.gates[k] === true;
                      const spec = GATES[k];
                      const lead = ctx.leadDays?.[k] ?? spec.assumed_lead_days;
                      return (
                        <li key={k} className="flex items-start gap-3 py-2">
                          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${closed ? 'bg-clear' : 'bg-line-strong'}`} aria-hidden />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                              <span className={`text-sm ${closed ? 'text-muted line-through decoration-line-strong' : 'text-ink'}`}>{spec.label}</span>
                              <span className="tnum text-2xs text-muted">
                                {spec.owner === 'third_party' ? 'third party' : 'production'} · {lead} d
                              </span>
                            </div>
                            {!closed ? <p className="mt-0.5 text-xs text-muted">{spec.note}</p> : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  {personAdj.softOpen.length > 0 ? (
                    <p className="mt-3 text-xs text-muted">
                      Also open, not blocking: {personAdj.softOpen.map((k) => SOFT_LABELS[k].toLowerCase()).join('; ')}.
                    </p>
                  ) : null}
                </div>
                <div className="border-t border-line">
                  <div className="px-5 pt-3">
                    <Eyebrow>Findings</Eyebrow>
                  </div>
                  <FindingList findings={personAdj.findings} dense empty="Every hard gate is closed." />
                </div>
              </Card>
            ) : (
              dept && depts.find((d) => d.department === dept)?.findings.length ? (
                <Card>
                  <CardHead title="Department findings" />
                  <FindingList findings={depts.find((d) => d.department === dept)!.findings} dense />
                </Card>
              ) : null
            )}
          </div>
        </div>

        {/* ---------------------------- CURVE + PARETO --------------------------- */}
        <div className="mt-8 grid grid-cols-1 gap-5 xl:grid-cols-12">
          <Card className="xl:col-span-7">
            <CardHead title="Arrivals against clearances" sub="Cumulative. The gap between the lines is the number of people who are supposed to be on set and cannot be." />
            <div className="px-5 py-4">
              <ArrivalChart data={curve} nowDay={M.day} />
            </div>
          </Card>
          <Card className="xl:col-span-5">
            <CardHead title="What is in the way" sub={`Open gates among people needed by ${horizonLabel}, by how many they touch.`} />
            <ul className="divide-y divide-line px-5">
              {pareto.map((p) => {
                const total = p.blocked + p.exposed + p.open;
                const max = Math.max(1, ...pareto.map((q) => q.blocked + q.exposed + q.open));
                return (
                  <li key={p.gate} className="py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm text-ink">{GATES[p.gate].label}</span>
                      <span className="tnum text-xs text-muted">{total}</span>
                    </div>
                    <div className="mt-1.5 flex h-2 w-full overflow-hidden rounded-full bg-sunken" style={{ width: `${(total / max) * 100}%` }}>
                      {p.blocked > 0 ? <div className="bg-block" style={{ width: `${(p.blocked / total) * 100}%` }} /> : null}
                      {p.exposed > 0 ? <div className="bg-review" style={{ width: `${(p.exposed / total) * 100}%` }} /> : null}
                      {p.open > 0 ? <div className="bg-open" style={{ width: `${(p.open / total) * 100}%` }} /> : null}
                    </div>
                    <div className="mt-1 text-2xs text-muted">
                      {p.blocked > 0 ? <span className="text-block-deep">{p.blocked} cannot close in time</span> : null}
                      {p.blocked > 0 && (p.exposed > 0 || p.open > 0) ? ' · ' : ''}
                      {p.exposed > 0 ? <span className="text-review-deep">{p.exposed} with a third party</span> : null}
                      {p.exposed > 0 && p.open > 0 ? ' · ' : ''}
                      {p.open > 0 ? <span>{p.open} closeable here</span> : null}
                      {' · '}
                      {GATES[p.gate].owner === 'third_party' ? 'third party' : 'production'}, {ctx.leadDays?.[p.gate] ?? GATES[p.gate].assumed_lead_days} days
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        {/* ------------------------------ UNKNOWNS ----------------------------- */}
        <Card className="mt-8">
          <CardHead title="The unknowns" sub="Lead times are assumptions. Move them and the board recomputes. Every figure above is downstream of these three sliders." />
          <div className="grid grid-cols-1 gap-8 px-5 py-5 md:grid-cols-3">
            <Slider
              name="assumed_lead_days.right_to_work"
              label="Work authorization, days from application to verification"
              value={rtwLead}
              min={2}
              max={21}
              format={(v) => `${v} days`}
              onChange={setRtwLead}
              caption="A permit, a visa or a registration. Issued by a government office on its own timetable. Ten is a guess in the plausible range; the real figure depends on passport and host country."
            />
            <Slider
              name="assumed_lead_days.minor_permit"
              label="Minor's work permit"
              value={minorLead}
              min={3}
              max={30}
              format={(v) => `${v} days`}
              onChange={setMinorLead}
              caption="Issued by a labor or education authority. Fourteen is common. Some countries are faster, and some are not."
            />
            <Slider
              name="assumed_lead_days.animal_handler_cert"
              label="Animal handler certificate"
              value={animalLead}
              min={1}
              max={14}
              format={(v) => `${v} days`}
              onChange={setAnimalLead}
              caption="Required by the welfare monitor before an animal works. The head wrangler is needed on Day 7 with thirty-three horses."
            />
          </div>
        </Card>

        <p className="mt-4 max-w-[80ch] text-xs leading-relaxed text-muted">
          There is no name, email, phone, passport or bank field anywhere in a crew record here. The engine decides who can be on set from gates and
          dates, not from who someone is. The join to a human being lives in the payroll vendor, behind its own access control, and this system never
          holds it. That is a design choice, and it is also why the credit roll cannot be generated from here on day eighty.
        </p>
      </div>
    </div>
  );
}

function sevOrder(s: 'block' | 'review' | 'open' | 'clear'): number {
  return { block: 0, review: 1, open: 2, clear: 3 }[s];
}

function ArrivalChart({ data, nowDay }: { data: { day: number; arriving: number; needed: number; cleared: number }[]; nowDay: number }) {
  const W = 720;
  const H = 220;
  const padL = 36;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const max = Math.max(...data.map((d) => d.needed), 1);
  const x = (i: number) => padL + (i / (data.length - 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB);
  const needed = data.map((d, i) => `${x(i)},${y(d.needed)}`).join(' ');
  const cleared = data.map((d, i) => `${x(i)},${y(d.cleared)}`).join(' ');
  const area = `${x(0)},${y(0)} ${needed} ${x(data.length - 1)},${y(0)}`;
  const nowIdx = data.findIndex((d) => d.day === nowDay);
  const ticks = data.map((d, i) => ({ d: d.day, i })).filter(({ d }) => [-21, -14, -7, 1, 7, 14].includes(d));
  const gridVals = [0, Math.round(max / 2), max];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Cumulative people needed versus cleared, by production day">
      {gridVals.map((v) => (
        <g key={v}>
          <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="#E4DFD5" strokeWidth={1} />
          <text x={padL - 6} y={y(v) + 4} textAnchor="end" fontSize={10} fill="#77777F" fontFamily="Inter Variable, Inter, system-ui, sans-serif">
            {v}
          </text>
        </g>
      ))}
      <polygon points={area} fill="#0F4C5C" opacity={0.06} />
      <polyline points={needed} fill="none" stroke="#151517" strokeWidth={1.75} />
      <polyline points={cleared} fill="none" stroke="#067647" strokeWidth={1.75} />
      {nowIdx >= 0 ? (
        <g>
          <line x1={x(nowIdx)} x2={x(nowIdx)} y1={padT} y2={H - padB} stroke="#B42318" strokeWidth={1} strokeDasharray="3 3" />
          <text x={x(nowIdx) + 5} y={padT + 10} fontSize={10} fill="#B42318" fontFamily="Inter Variable, Inter, system-ui, sans-serif">
            tonight
          </text>
        </g>
      ) : null}
      {ticks.map(({ d, i }) => (
        <text key={d} x={x(i)} y={H - 8} textAnchor="middle" fontSize={10} fill="#77777F" fontFamily="Inter Variable, Inter, system-ui, sans-serif">
          {d < 0 ? `D−${Math.abs(d)}` : `D${d}`}
        </text>
      ))}
      <g transform={`translate(${W - padR - 150}, ${padT + 4})`} fontSize={10} fontFamily="Inter Variable, Inter, system-ui, sans-serif">
        <line x1={0} x2={16} y1={4} y2={4} stroke="#151517" strokeWidth={1.75} />
        <text x={20} y={8} fill="#3F3F46">
          needed on set
        </text>
        <line x1={80} x2={96} y1={4} y2={4} stroke="#067647" strokeWidth={1.75} />
        <text x={100} y={8} fill="#3F3F46">
          cleared
        </text>
      </g>
    </svg>
  );
}
