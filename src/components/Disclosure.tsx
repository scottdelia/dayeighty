import { CAST, CREW_COUNT, LOCATIONS, PRODUCTION, SCENES, allBreakdowns } from '../engine';

/* ===========================================================================
   WHAT IS REAL HERE, AND WHAT IS NOT

   A prototype that blurs this line is worse than no prototype. The labels are
   deliberately unflattering where they should be: "invented" and "canned" are
   the correct words, and softer ones would be a small lie told early.
   =========================================================================== */

const CARDS: { tag: string; tone: 'real' | 'assumed' | 'invented'; body: string }[] = [
  {
    tag: 'Real',
    tone: 'real',
    body:
      'The problem. A crew of hundreds that does not exist one week and does the next, a fixed number of shoot days with none spare, and a paper schedule re-sorted by hand when a day goes wrong. All three were described in public by the people who lived them, and this was built as a reply.',
  },
  {
    tag: 'Real',
    tone: 'real',
    body:
      'The rules. Deterministic TypeScript, with tests over the boundaries where a production actually goes wrong: a permit that ends the day the pages need it, a dawn that only happens once, a child who cannot work past nine, a seventh day that costs double. The page imports the tested module rather than a copy of it, so every number on screen is computed, not replayed.',
  },
  {
    tag: 'Real',
    tone: 'real',
    body:
      'The conventions. Stripboard colors, turnaround, forced calls, day-out-of-days status codes, second units, cover sets, the shape of a unit list. They are the industry\'s own, and someone who has run a set will recognize them without a legend.',
  },
  {
    tag: 'Assumed',
    tone: 'assumed',
    body:
      'Every rate, cap and lead time. All are named assumed_* in the source so the naming itself resists drift from "modeled scenario" to "finding". A unit day cost, a consulate lead time, a seventh-day multiplier: each is in a plausible range and none was obtained from anyone.',
  },
  {
    tag: 'Invented',
    tone: 'invented',
    body:
      `The production, down to its title. ${PRODUCTION.titleMark} is a working title for a series that does not exist. Its ${SCENES.length} scenes, ${CAST.length} characters and their contracts, ${LOCATIONS.length} locations, the dates, the country, and every one of the ${CREW_COUNT} crew records are fabricated at runtime from a fixed seed, and belong to no book, show or company. The problem it is built for was described in public, on The Jeremy Boreing Show, Ep. 56, by people who lived it; the README cites the passage. No script, schedule, crew list, contract or budget of any real production has been seen, and none is represented.`,
  },
  {
    tag: 'Canned',
    tone: 'invented',
    body:
      `The breakdown, for ${allBreakdowns().length} pages. Precomputed so the page runs offline with no key in client-side code. The same contract runs live in "Read a page of your own" if you paste a key of your own, and the boundary it crosses is the one the tests hold: scene text in, nothing else.`,
  },
];

const TONE: Record<string, string> = {
  real: 'text-clear-deep',
  assumed: 'text-review-deep',
  invented: 'text-muted',
};

export default function Disclosure() {
  return (
    <section id="disclosure" className="border-t border-line bg-sunken/50">
      <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
        <h2 className="font-display text-2xl text-ink">What is real here, and what is not</h2>
        <p className="mt-2 max-w-[70ch] text-[15px] text-body">A prototype that blurs this line is worse than no prototype, so:</p>

        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {CARDS.map((c, i) => (
            <div key={i} className="card p-5">
              <div className={`eyebrow ${TONE[c.tone]}`}>{c.tag}</div>
              <p className="mt-2 text-[13.5px] leading-relaxed text-body">{c.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 max-w-[80ch] border-l-2 border-ink/70 pl-5 text-[13.5px] leading-relaxed text-body">
          <strong className="font-semibold text-ink">Unaffiliated.</strong> This is a speculative prototype built from publicly available information by someone
          outside the company. It is not a product of, affiliated with, or endorsed by any business or person named in it, and nothing here reflects any
          non-public knowledge of how that business or that production is run. It was built as a conversation starter. Everything in it is wrong in the
          specifics and, I think, right in the shape; the interesting part is finding out which parts.
        </div>
      </div>
    </section>
  );
}
