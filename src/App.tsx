import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { DEFAULT_LOST_DAY, PRODUCTION } from './engine';
import Timeline from './components/Timeline';
import type { ViewKey } from './components/Timeline';
import Disclosure from './components/Disclosure';
import CrewUp from './views/CrewUp';
import LostDay from './views/LostDay';
import Wrap from './views/Wrap';

/*
  The page opens inside the scene. No wordmark, no view switcher, no chip:
  the first thing on screen is the desk at 6:10 PM. The other two moments are
  reached by two links above the footer, and the timeline navigation appears
  only once the reader has left the lost day.
*/
export default function App() {
  const [view, setView] = useState<ViewKey>('lostDay');
  const [lostDay, setLostDay] = useState<number>(DEFAULT_LOST_DAY);

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 pt-4 lg:px-8">
        {view === 'lostDay' ? (
          <span className="text-xs text-faint">Day Eighty</span>
        ) : (
          <button type="button" onClick={() => setView('lostDay')} className="inline-flex items-center gap-1.5 text-xs text-body hover:text-ink">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> The lost day
          </button>
        )}
        <a href="#disclosure" className="text-xs text-body underline decoration-line-strong underline-offset-4 hover:text-ink">
          What is real here
        </a>
      </div>

      {view !== 'lostDay' ? <Timeline view={view} onChange={setView} lostDay={lostDay} /> : null}

      <main className="min-w-0">
        {view === 'crewUp' ? <CrewUp /> : null}
        {view === 'lostDay' ? <LostDay lostDay={lostDay} onLostDayChange={setLostDay} /> : null}
        {view === 'wrap' ? <Wrap /> : null}
      </main>

      {view === 'lostDay' ? (
        <section className="border-t border-line">
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-5 py-10 lg:px-8 md:grid-cols-2">
            <button type="button" onClick={() => setView('crewUp')} className="card px-5 py-4 text-left transition-all hover:shadow-lift">
              <span className="eyebrow">Day −7 · one week to Day 1</span>
              <span className="mt-1 block font-display text-xl text-ink">How they all got here</span>
              <span className="mt-1 block text-sm text-body">Three hundred six people who did not exist last week, and who among them cannot be on set.</span>
            </button>
            <button type="button" onClick={() => setView('wrap')} className="card px-5 py-4 text-left transition-all hover:shadow-lift">
              <span className="eyebrow">Day 79 · wrap</span>
              <span className="mt-1 block font-display text-xl text-ink">What tomorrow owes</span>
              <span className="mt-1 block text-sm text-body">Everyone leaves on day eighty. The production does not.</span>
            </button>
          </div>
        </section>
      ) : null}

      <Disclosure />

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-5 py-4 text-2xs text-muted lg:px-8">
          <span>
            Day Eighty · {PRODUCTION.titleMark} · {PRODUCTION.nature} · a speculative prototype by{' '}
            <a href="https://github.com/scottdelia" className="text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink">Scott Delia</a>, unaffiliated with anyone it cites.
          </span>
          <span>No network calls until you press read; then the page text goes to a relay and on to Anthropic, and nothing is stored. Every number recomputed from a fixed seed on load.</span>
        </div>
      </footer>
    </div>
  );
}
