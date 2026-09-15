# Day Eighty

> "On day 80, it's over."
> "Within the 79 days, because there's not 80."
> — *The Jeremy Boreing Show*, Weds LIVE Ep. 56, about 2:19 and 1:59

**Three hundred people who did not exist last week. Seventy-nine shoot days. On day eighty, everyone
disappears, never to stand in one place again.**

A film production is a company that exists for seventy-nine days. Its operations problems are the
ordinary ones, compressed until they hurt: hire everyone at once, lose a day you cannot get back, then
dissolve on a date. This finds the constraints on the night they matter.

```bash
npm install && npm run dev    # the demo
npm run test                  # 76 tests, boundary-focused
```

---

## The scene

It is ten past six on Day 46 of 79. Tomorrow is an exterior at a river ford: thirty riders,
thirty-three horses, a dawn, a dusk, a child, and a permit that closes on Day 50. The forecast turned
at half past five. The call sheet is due at eight.

The page opens on that desk. Beside the forecast is the prelim call sheet issued at 4:40 PM. Below them
are six things a producer can do tonight, priced against the contracts, the permit window, the child's
hours and the turnaround. One of them, add a day at the end, has no price, because **there is no Day
80** and the engine will not price one. Choose any of the others and the strips move, the notices go
out in order, and the revised sheet reissues at 7:52 PM with what changed at its foot.

That is the whole demo, and it is the demo because it is the shape of the night the founders described.

**Everything about the production is invented, down to its title.** *Far Bank* is a working title
for a series that does not exist. Its scenes, its characters, its contracts, its locations, its dates
and its country belong to no book, no show and no company. What is borrowed is the shape of the
problem. See "What is not real here."

---

## Three things I deliberately did not build

Stated because the omissions are the research.

1. **A scheduling suite.** The industry has them, they are good, and every production already runs on
   one. This does not replace the stripboard; it reads the stripboard and does the thing the stripboard
   cannot, which is check a proposed move against the contracts and permits in the time it takes to
   click. The working version would take the export those tools already produce.
2. **A weather model.** The forecast is an input with a stated horizon. An engine that predicts the sky
   would be wrong exactly when it mattered and confident exactly then.
3. **An AI that chooses.** The engine prices and refuses. It does not recommend, because the two
   questions the decision actually turns on, whether the cover set is worth more to the picture than the ford in tomorrow's weather, and
   whether the cast have rehearsed the cover scenes, are not numbers. They are printed above the
   options with blank answer lines. The producer chooses, with the costs in front of them instead of
   behind them.

---

## The demo

**`npm run dev`, then choose the cover set.** No API key, no network calls, no backend, no webfont
CDN. The one exception is the live reader, which calls the model directly from the browser only if
you press read, and then only the page text crosses.

The architecture argument the page exists to make:

> **The model reads the page. The rules move the strips.**

Reading `Two horses lose their footing on the stones and go down in the current` and concluding "two
stunt performers, a safety diver team, and this scene needs a stunt coordinator who can see the
stones" is genuinely hard and genuinely model-shaped: a writer encoded a background count, an animal
booking and a water safety requirement in English, in a field whose schema is `string`. Deciding
whether those riders can move to Tuesday is not. It is a permit window, a contract, a turnaround rule
and a calendar, it has to be reproducible, and an assistant director may have to defend it to a
completion bond company.

| Stage | Kind | Job |
|---|---|---|
| 1 · Read | probabilistic | Read the scene page into a breakdown, with confidence and source spans |
| 2 · Check | deterministic | Apply the constraints. Cite the document. No model in the loop. |
| 3 · Price | deterministic | Cost what can be costed. Refuse what cannot. Reissue the sheet. |

Then lose a different day from the selector below the board. Every exterior day in the schedule can
be lost, and the same rules re-slot it: a different permit window, a different cast, a different
Sunday. The solver is general. Only the pages around the ford are hand-written; for every other scene
the reader shows what the stripboard export already holds and says, plainly, that nothing was read.

---

## The premise

On Ep. 56 of *The Jeremy Boreing Show* ([YouTube](https://www.youtube.com/watch?v=BjRjSsC484k), the
production passages around 1:58 and 2:18), the founders of Boreing Media described making the first
season of *The Pendragon Cycle* as standing up a company of three hundred people that did not exist
one week and did the next, then running it flat out for seventy-nine days with no day eighty. Jon
Lewis described the specific failure mode: a day goes wrong in Budapest, and five or six executives
stand around a paper production schedule trying to work out where to re-slot the shoot. And they said,
of the next production, that they could not wait to see what working with AI would do for exactly that.

That is a stated, unsolved, operations-shaped need. This repo is a reply to it. The show is named
here, once, because that is the source. It appears on no page, sheet, image or frame of the demo.

---

## What it does

Three views, three moments in the life of the company, one engine. The lost day opens first. The
other two are reached from links above the footer.

### The lost day · Day 46, 6:10 PM

The reader reads tomorrow's four pages into a breakdown. Hover a fact and the exact words it came from
light up. Facts inferred from what the page does *not* say (a dawn happens once; an exterior is
weather-dependent whether or not the writer typed the word) have nothing to light, and render as such.

Then the rules check six options against the constraints a paper schedule gets wrong at 7:40 PM:

- Cast contract windows and the days an actor is contractually elsewhere
- Location permit windows, and whether a Sunday is allowed and at what uplift
- Whether a stage set is built yet
- Scenes locked to dawn or dusk, which happen once per day
- A child's maximum hours and latest wrap
- Turnaround between wrap and a dawn call, and what a forced call costs
- Page capacity per day and the overtime tiers beyond it
- What is already booked on a day (riders, horses, a diver) and what it costs to add or cancel
- A seventh consecutive day, and an actor whose deal forbids one
- Prep days a set needs that have not happened
- Whether the water is safe once the rain stops, which is the safety lead's call and not the engine's
- What a second unit can take with doubles, and what still needs a face in front of the main unit

| Option | What the engine says |
|---|---|
| Shoot a cover set tomorrow | Feasible. The forest house is built and its cast are free; the scriptorium is not, because one actor is at the theater. The ford scenes fit into the remaining permit days. Day 58 opens, and that is a first AD's call. |
| Split the day | Feasible. Stage until it clears, a company move, and the dusk scene at the ford. The scenes with people in the water stay off, because the river is up whatever the sky does. |
| Cover set, second unit takes the wides | Partly feasible, because a second unit is assumed. It shoots the crossing and the far bank with doubles; the dialogue scene still needs the main unit. |
| Cancel the day and absorb | Feasible, and the unit is paid for a day it does not shoot. |
| Shoot on the rest day | Partly feasible. Only one of the four scenes can shoot on a Sunday; the other three are barred by a contract clause or by the child's hours. The total depends on whether a paid but canceled Friday counts as a worked day, which the engine does not know. |
| Add a day at the end | **Not feasible.** There is no Day 80. |

Choose one and the stripboard reflows, the notices that have to go out tonight are listed in the
order a production office actually makes them, and the call sheet reissues marked revised with what
changed against the prelim at its foot.

**Read a page of your own.** Under "For the engineer" is the same reader, live. Press read on a page of your own and it goes, through a small relay the author runs, to a real model, which returns quotes; the engine finds them on the page and lights them. No key is needed. Two other ways in sit under it for anyone who would rather not use the relay: your own key from the browser, or the exact request body to send from a terminal and paste back. All three cross the same boundary and are checked the same way.

### Crew-up · Day −7, 6:00 PM

One week to Day 1. Every one of 306 people has hard gates: a signed deal memo, an NDA, a safety orientation, and either a local tax registration or work authorization in a country most of them flew
into. Stunt performers need an insurer-approved risk assessment, drivers an insurer's license check,
the armorer a verified license, the child a work permit and a studio teacher.

Every gate has a lead time. Every person has a start date. The rules subtract.

| Verdict | Meaning |
|---|---|
| `BLOCKED` | An open gate cannot close before this person's first set day. The schedule moves, or the person is replaced. |
| `EXPOSED` | An open gate is in a third party's hands. Time exists; control does not. |
| `OPEN` | Closeable inside the production, in time, if someone does it. |
| `CLEARED` | Every hard gate closed. |

Department rules on top: a department whose head is blocked cannot sign off its own work, and a
department of any size with no cleared second has one person between it and a bad day.

There is no name, email, phone, passport or bank field anywhere in a crew record. The engine decides
who can be on set from gates and dates, not from who someone is.

### Wrap · Day 79, 10:40 PM

Everyone leaves tomorrow. The production does not. Rentals go back on a date and the meter runs on
the whole order until the last item does. Deposits come back on sign-off, and sign-off has to be asked
for. Final pay closes on a day. Two shoot days are on shuttle drives and nowhere else, and the bond will
not sign off on that. Weapons go back to a licensed vault, which is not a fee. Seven actors have series
options that lapse on a date whether or not anyone decides.

It also lists what it will not compute: what is on the cards (only the checksum knows), the cost of
exercising an option (in the vendor's system, not this one), the incentive amount (which program
applies is unknown), and the credit roll, because the system holds 306 surrogate identifiers and no
names, by design.

---

## Data and privacy

**Every crew record in this repo is fabricated by `crew.ts` from a fixed seed, at runtime, on your
machine.** Clone it and you reproduce these exact records. Nobody who has worked on any production is
represented, and nobody needed to be.

- **Minimum necessary as a schema.** There is no name, email, phone, passport, nationality, address or
  bank field anywhere in the crew or cast types. The engines do not need them, so they never receive
  them, and `boundary.test.ts` asserts the field lists stay that way.
- **The model boundary is a function signature.** `buildBreakdownRequest` accepts scene page text and
  validates that at runtime. Passing it a crew record throws. Passing it a cast contract, which carries
  the one genuinely sensitive figure in the system, throws. Passing it an arbitrary string throws, so a
  field carrying a rate or a name cannot reach a model by being renamed.
- **The second door is shape-checked.** `buildLiveBreakdownRequest`, which the live reader uses, accepts
  a pasted page only if it starts with a slugline, is shorter than a scene, and carries no email
  address, amount of money, phone number, payment or identity term, or crew identifier. It is a shape
  check, not a content check; what it guarantees is that nothing shaped like a record passes.
- **The relay holds one key and no data.** `src/relay/worker.ts` is a Cloudflare Worker of about a
  hundred lines: it answers only the site's origin, passes the page through the same
  `buildLiveBreakdownRequest`, rate-limits by caller and in total, forwards the contract and the page
  under the author's key, and returns the reply. It stores nothing and logs nothing. The key is a
  secret set from a terminal and appears in no file. A monthly spend limit on the account is the
  backstop no code can replace.
- **Two ways around the relay.** Your own key from the browser (some organizations' settings refuse
  browser calls to the API, and the page says so plainly), or the exact request body to send with
  `curl` from your own machine and paste back; `parseModelReply` reads the reply and the same quote
  check applies. On that path the key never touches the page at all.
- **Money is integer cents**, never floats, and `null` is never coerced to `0`.
- **Surrogate identifiers only.** `CR-` prefixed, opaque, encoding nothing, and matching no vendor's
  format.

## What is *not* real here

Stated plainly, because a prototype that blurs this line is worse than useless:

- **The production, down to its title.** *Far Bank* is a working title for a series that does not
  exist. The 207 scenes, the 24 characters and their contracts, the 12 locations, the dates, the
  country, and the 306 crew records are fabricated from a fixed seed and belong to no book, show or
  company. Dates are printed without a year. No script, schedule, crew list, contract or budget of any
  real production has been seen.
- **The public numbers are kept because they were said aloud.** Seventy-nine days, eight episodes,
  about three hundred people. Everything built on them is invented.
- **Every rate, cap and lead time is assumed**, named `assumed_*` in the source so the naming itself
  resists drift from "modeled scenario" to "finding". A unit day cost, a consulate lead time, a
  seventh-day multiplier: each is in a plausible range for a period series of this scale shooting
  abroad, and none was obtained from anyone.
- **The breakdown is precomputed** for the eleven hand-written pages, so the page runs offline with no
  key in client-side code. The same contract, printed in `breakdown.ts`, runs live in the reader card
  against a real model when you press read.
- **The wrap counts are fabricated.** How many time cards are open, which location has a damage
  report. The rules that act on them are not.
- **The conventions are real.** Stripboard colors, prelim and revised sheets, turnaround, forced
  calls, day-out-of-days status codes, cover sets, second units, the order the calls go out. Someone
  who has run a set will recognize them without a legend.

## Where this would go next

1. **Point it at a real stripboard.** The scheduling tools every production uses export the scenes,
   the day-out-of-days and the strips. Read the export, and every constraint check becomes a
   measurement. Nothing about the architecture changes.
2. **Point it at a real onboarding tracker.** Whatever the production office already keeps, however
   it keeps it. The board needs a gate list and a start date per person, and it needs no names.
3. **Supply the ten-minute inputs.** Permit windows, the actors with rest-day clauses, the child's
   hours, the crew agreement's rest-day language. Each is one line from someone who knows, and each
   turns an assumption into a rule.
4. **Put the reader behind a proxy.** It is live today with the reader's own key in the browser. A
   server-side proxy makes it live for everyone, with the same contract and the same boundary test.
5. **Generate the wrap list on Day 1, not Day 79.** It is the same computation. Running it early makes
   the deadlines negotiable instead of arriving.

---

## Operator questions

The engine is the easy half. These are the things that cannot be known from outside, in rough order of
how much they would change what is worth building:

1. On the day that went wrong, what was the paper schedule made of? A scheduling tool's printout, a
   spreadsheet, or a whiteboard? Whatever it was is the input format.
2. Who made the re-slot decision, and what did they have in front of them when they made it? What did
   they wish they had?
3. How were three hundred people onboarded in a week? One tracker, several, or a person's head? What
   was the last gate to close before Day 1, and how many days late was it?
4. Which gates actually blocked someone from working, as opposed to being paperwork that caught up
   later? That is the difference between a board and a nag.
5. How many days were lost to weather, illness or a location falling through, and how was each one
   absorbed? Overtime, a cover set, a Sunday, a second unit, or pages that were never shot?
6. What did the crew agreement say about a seventh day, and did anyone read that clause before or after
   the first time it mattered?
7. What does the completion bond require at wrap, and how long after wrap did the last rental go back?
8. Who owned the cast option calendar, and did any option lapse or nearly lapse because nobody owned it?
9. For the next production: same country, same crew core, same tools? Or none of the above?
10. Does anyone on the production side have an engineer? If the answer is no, every one of these
    decisions currently routes through a vendor's roadmap, and that is itself the most interesting fact
    about what to build first.
11. Which of the six options would you have chosen, that night? The engine leaves that line blank on
    purpose.
12. What is the one constraint the engine does not check that would have embarrassed it on day forty?

---

Unaffiliated. A speculative prototype built from publicly available information by someone outside
the company. Not a product of, affiliated with, or endorsed by any business or person it cites.
