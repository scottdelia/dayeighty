import { useMemo, useState } from 'react';
import Anthropic from '@anthropic-ai/sdk';
import { ClipboardCopy, KeyRound, ScanText, TerminalSquare } from 'lucide-react';
import { BREAKDOWN_CONTRACT, LIVE_PAGE_MAX_CHARS, buildLiveBreakdownRequest, factsFromQuotes, pageShapeProblem, parseModelReply } from '../engine';
import type { BreakdownFact } from '../engine';
import { FactsSchema, RELAY_MAX_TOKENS, RELAY_MODELS, factsOutputFormat, relayModel, type RelayModelId } from '../shared/facts';
import { Card, CardHead, Eyebrow } from './ui';
import { FactList, SpannedPage } from './SpannedText';

/* ===========================================================================
   THE LIVE READER

   The eleven pages around the ford are precomputed so the site runs offline.
   This card runs the same reader, on a page it has never seen, against a
   real model. Three ways in, one boundary:

   1. The relay. Press read and the page goes to a small worker the site's
      author runs (src/relay/worker.ts), which holds his key and forwards the
      contract and the page to api.anthropic.com. Nothing is stored. A
      visitor needs no key.

   2. Your own key, from this browser. The key lives in component state, goes
      out as a request header to api.anthropic.com, and is gone on reload.
      Some organizations' settings refuse calls made from a browser; the
      page says so plainly when that happens.

   3. A terminal. The page hands over the exact request body, you send it
      with curl from your own machine and paste the reply back. The key
      never touches the page.

   On every path the page crosses the same boundary the tests hold:
   `buildLiveBreakdownRequest` refuses anything not shaped like a scene, and
   anything carrying a rate, an identifier or a contact detail, before a
   request is built. The model sees the contract and the page. That is the
   whole payload. And on every path the reply is checked the same way: the
   model returns quotes, the engine finds them on the page, and a quote that
   is not there cannot light the wrong words.
   =========================================================================== */

/** Where the relay lives. Overridable at build time for local work (VITE_RELAY_URL=http://localhost:8787). */
const RELAY_URL: string = (import.meta.env.VITE_RELAY_URL as string | undefined) ?? 'https://dayeighty-relay.scottdelia.workers.dev';

const SAMPLE_PAGE =
  'EXT. HILLFORT, GATE — DAWN\n\nA column of forty riders waits below the gate in the half-light, breath steaming. THE SMITH opens it from inside, one bar at a time. BLEDRI watches from the rampart and says nothing. The first horse through slips on the wet stone and recovers.';

const CURL =
  'curl https://api.anthropic.com/v1/messages -H "x-api-key: YOUR_KEY" -H "anthropic-version: 2023-06-01" -H "content-type: application/json" -d @request.json';

type Status =
  | { kind: 'idle' }
  | { kind: 'refused'; why: string }
  | { kind: 'reading'; via: string }
  | { kind: 'done'; facts: BreakdownFact[]; model: string; inTokens: number | null; outTokens: number | null; via: string }
  | { kind: 'error'; message: string };

export default function LiveReader() {
  const [model, setModel] = useState<RelayModelId>('claude-sonnet-5');
  const [text, setText] = useState(SAMPLE_PAGE);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [lit, setLit] = useState<number | null>(null);
  const [readText, setReadText] = useState('');
  const [selfOpen, setSelfOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [copied, setCopied] = useState<'no' | 'yes' | 'failed'>('no');
  const [pasted, setPasted] = useState('');

  const problem = useMemo(() => pageShapeProblem(text), [text]);
  const busy = status.kind === 'reading';
  const canRead = problem === null && !busy;

  /** Every path starts here: the same boundary, or a refusal in plain words. */
  function crossBoundary(): { contract: string; page: string } | null {
    try {
      const request = buildLiveBreakdownRequest(text);
      return { contract: request.contract, page: request.pages[0]! };
    } catch (e) {
      setStatus({ kind: 'refused', why: e instanceof Error ? e.message : String(e) });
      return null;
    }
  }

  /** Every path ends here: the model's quotes become spans on the page it read, or nothing is rendered. */
  function finish(page: string, output: unknown, refusal: string | null, modelName: string, inTokens: number | null, outTokens: number | null, via: string) {
    if (refusal !== null) {
      setStatus({ kind: 'error', message: `The model declined to read this page: ${refusal}` });
      return;
    }
    const checked = FactsSchema.safeParse(output);
    if (!checked.success) {
      setStatus({ kind: 'error', message: 'The reply was not a facts list in the shape the contract asks for. Nothing was rendered, because rendering a guess is worse than rendering nothing.' });
      return;
    }
    setReadText(page);
    setStatus({ kind: 'done', facts: factsFromQuotes(page, checked.data), model: modelName, inTokens, outTokens, via });
  }

  /* ------------------------------ 1. the relay ------------------------------ */
  async function readViaRelay() {
    const crossed = crossBoundary();
    if (!crossed) return;
    setStatus({ kind: 'reading', via: 'the relay' });
    setLit(null);
    try {
      const res = await fetch(`${RELAY_URL}/read`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ page: crossed.page, model }),
      });
      let body: { ok?: boolean; message?: string; model?: string; usage?: { input_tokens?: number; output_tokens?: number }; output?: unknown; refusal?: string | null } = {};
      try {
        body = (await res.json()) as typeof body;
      } catch {
        setStatus({ kind: 'error', message: `The relay answered ${res.status} with something that was not JSON. Nothing was read.` });
        return;
      }
      if (!res.ok || !body.ok) {
        setStatus({ kind: 'error', message: body.message ?? `The relay answered ${res.status}. Nothing was read.` });
        return;
      }
      finish(crossed.page, body.output, body.refusal ?? null, body.model ?? model, body.usage?.input_tokens ?? null, body.usage?.output_tokens ?? null, 'the relay');
    } catch {
      setStatus({ kind: 'error', message: 'Could not reach the relay from this browser. Nothing was read. The two paths below do not need it.' });
    }
  }

  /* --------------------------- 2. your own key --------------------------- */
  async function readWithKey() {
    const crossed = crossBoundary();
    if (!crossed) return;
    setStatus({ kind: 'reading', via: 'your key' });
    setLit(null);
    try {
      // Direct from the browser, with the reader's own key. The flag is named
      // the way it is because a key in a browser is usually a mistake; here it
      // is the reader's key, on the reader's machine, for the reader's page.
      const client = new Anthropic({ apiKey: apiKey.trim(), dangerouslyAllowBrowser: true, maxRetries: 1 });
      const format = factsOutputFormat();
      const response = await client.messages.parse({
        model,
        max_tokens: RELAY_MAX_TOKENS,
        system: crossed.contract,
        messages: [{ role: 'user', content: crossed.page }],
        output_config: relayModel(model).effort ? { format, effort: 'medium' } : { format },
      });
      finish(
        crossed.page,
        response.parsed_output ?? null,
        response.stop_reason === 'refusal' ? (response.stop_details?.explanation ?? 'no explanation given') : null,
        response.model,
        response.usage.input_tokens,
        response.usage.output_tokens,
        'your key',
      );
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError && /CORS requests are not allowed/i.test(e.message)) {
        setStatus({
          kind: 'error',
          message:
            "The key is fine. Your organization's settings do not allow calls to the API from a browser, so this page cannot send the request for you. Use the relay button above, or the terminal path below: the same request goes out from your own machine, and the key never touches this page.",
        });
      } else if (e instanceof Anthropic.AuthenticationError) {
        setStatus({
          kind: 'error',
          message: `That key was not accepted. Nothing was read. The API said: ${e.message}. A Console API key starts with sk-ant-api03- and is shown in full only once, when it is created; the keys list shows a shortened copy that will not work.`,
        });
      } else if (e instanceof Anthropic.RateLimitError) setStatus({ kind: 'error', message: 'Rate limited. Wait a moment and read again.' });
      else if (e instanceof Anthropic.BadRequestError) setStatus({ kind: 'error', message: `The request was refused by the API: ${e.message}` });
      else if (e instanceof Anthropic.APIError) setStatus({ kind: 'error', message: `API error ${e.status ?? ''}: ${e.message}` });
      else if (e instanceof Anthropic.APIConnectionError) setStatus({ kind: 'error', message: 'Could not reach the API from this browser. Nothing was read.' });
      else setStatus({ kind: 'error', message: e instanceof Error ? e.message : 'Something went wrong, and the page says so rather than showing a guess.' });
    }
  }

  /* ----------------------------- 3. a terminal ---------------------------- */
  /** The exact body the other two paths send, for the terminal. Built through the same boundary. */
  function requestBody(): string | null {
    const crossed = crossBoundary();
    if (!crossed) return null;
    const { type, schema } = factsOutputFormat();
    const body = {
      model,
      max_tokens: RELAY_MAX_TOKENS,
      system: crossed.contract,
      messages: [{ role: 'user', content: crossed.page }],
      output_config: relayModel(model).effort ? { format: { type, schema }, effort: 'medium' } : { format: { type, schema } },
    };
    return JSON.stringify(body, null, 2);
  }

  async function copyRequest() {
    const body = requestBody();
    if (body === null) return;
    try {
      await navigator.clipboard.writeText(body);
      setCopied('yes');
    } catch {
      setCopied('failed');
    }
  }

  function readPasted() {
    const crossed = crossBoundary();
    if (!crossed) return;
    setLit(null);
    try {
      const reply = parseModelReply(pasted);
      finish(crossed.page, reply.output, reply.refusal, reply.model ?? 'a pasted reply', reply.inTokens, reply.outTokens, 'your terminal');
    } catch (e) {
      setStatus({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <Card className="mt-5">
      <CardHead
        title="Read a page of your own"
        sub="The same reader, live, on a page it has never seen. No key needed; the page is the only thing that crosses."
        right={<ScanText className="h-4 w-4 text-accent" aria-hidden />}
      />
      <div className="grid grid-cols-1 lg:grid-cols-12">
        <div className="border-b border-line p-5 lg:col-span-7 lg:border-b-0 lg:border-r">
          <label className="block">
            <span className="eyebrow">The page</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={7}
              spellCheck={false}
              className="mt-1 w-full resize-y rounded-md border border-line bg-surface px-3 py-2 font-mono text-[13px] leading-relaxed text-ink shadow-card focus:border-accent focus:outline-none"
              aria-label="Scene page text"
            />
          </label>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs">
              {problem ? (
                <span className="text-block-deep">Will not cross the boundary: {problem}.</span>
              ) : (
                <span className="text-muted">
                  Shaped like a scene. {text.length} of {LIVE_PAGE_MAX_CHARS} characters. Payload: the contract and this page, nothing else.
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <select
                value={model}
                onChange={(e) => setModel(e.target.value as RelayModelId)}
                className="rounded-md border border-line bg-surface px-2 py-[7px] text-xs text-ink shadow-card focus:border-accent focus:outline-none"
                aria-label="Model"
              >
                {RELAY_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              <button type="button" onClick={readViaRelay} disabled={!canRead} className={`btn-primary ${canRead ? '' : 'cursor-not-allowed opacity-50'}`}>
                {status.kind === 'reading' && status.via === 'the relay' ? 'Reading…' : 'Read this page'}
              </button>
            </div>
          </div>

          <p className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-muted">
            Read sends this page, and only this page, to a small relay the author runs, which forwards it with the contract to api.anthropic.com
            under his key and returns the model's reply. Nothing is stored or logged on the way. The model is held to the contract printed below; it
            returns quotes, not offsets, and the engine finds the offsets, so a quote that is not on the page cannot light the wrong words.
          </p>

          <details open={selfOpen} onToggle={(e) => setSelfOpen((e.currentTarget as HTMLDetailsElement).open)} className="mt-3 rounded-md border border-line bg-sunken/50 px-4 py-3 text-xs">
            <summary className="flex cursor-pointer select-none items-center gap-2 font-medium text-body">
              <KeyRound className="h-3.5 w-3.5 text-accent" aria-hidden />
              Prefer not to go through the relay? Run the same request yourself
            </summary>

            <div className="mt-3">
              <span className="eyebrow">With your own key, from this browser</span>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-line bg-surface px-2.5 shadow-card focus-within:border-accent">
                  <KeyRound className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden />
                  <input
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-ant-… · held in this tab, sent only to api.anthropic.com"
                    className="min-w-0 flex-1 bg-transparent py-1.5 font-mono text-xs text-ink placeholder:text-faint focus:outline-none"
                    aria-label="Anthropic API key"
                  />
                </div>
                <button
                  type="button"
                  onClick={readWithKey}
                  disabled={!canRead || apiKey.trim().length === 0}
                  className={`btn ${!canRead || apiKey.trim().length === 0 ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                  {status.kind === 'reading' && status.via === 'your key' ? 'Reading…' : 'Read with my key'}
                </button>
              </div>
              <p className="mt-1.5 leading-relaxed text-muted">
                The key lives in this card's memory, goes out as a header to api.anthropic.com from your browser, and a reload forgets it. Some
                organizations' settings refuse calls from a browser; if yours does, the page will say so, and the terminal path works instead.
              </p>
            </div>

            <div className="mt-4 border-t border-line pt-3">
              <span className="eyebrow">
                <TerminalSquare className="mr-1 inline h-3.5 w-3.5 text-accent" aria-hidden />
                From a terminal, so the key never touches this page
              </span>
              <ol className="mt-2 list-decimal space-y-1.5 pl-5 leading-relaxed text-body">
                <li>
                  Copy the request and save it as a file named <span className="font-mono">request.json</span>.{' '}
                  <button type="button" onClick={copyRequest} disabled={problem !== null} className="btn !px-2 !py-0.5 text-2xs">
                    <ClipboardCopy className="h-3 w-3" aria-hidden /> Copy the request
                  </button>
                  {copied === 'yes' ? <span className="ml-2 text-clear-deep">Copied.</span> : null}
                  {copied === 'failed' ? <span className="ml-2 text-block-deep">The browser refused the clipboard.</span> : null}
                </li>
                <li>
                  In the folder where you saved it, run this with your key in place of YOUR_KEY. On Windows PowerShell, type{' '}
                  <span className="font-mono">curl.exe</span>.
                  <pre className="mt-1 whitespace-pre-wrap rounded-sm border border-line bg-surface px-2 py-1.5 font-mono text-[11px] leading-relaxed text-ink">{CURL}</pre>
                </li>
                <li>
                  Paste everything it printed here, then press read.
                  <textarea
                    value={pasted}
                    onChange={(e) => setPasted(e.target.value)}
                    rows={4}
                    spellCheck={false}
                    placeholder={'{"id": "msg_…", "type": "message", …}'}
                    className="mt-1 w-full resize-y rounded-md border border-line bg-surface px-2 py-1.5 font-mono text-[11px] leading-relaxed text-ink shadow-card placeholder:text-faint focus:border-accent focus:outline-none"
                    aria-label="The reply printed by the terminal"
                  />
                  <button
                    type="button"
                    onClick={readPasted}
                    disabled={pasted.trim().length === 0 || problem !== null}
                    className={`btn mt-1.5 ${pasted.trim().length === 0 || problem !== null ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    Read the reply
                  </button>
                </li>
              </ol>
            </div>
          </details>
        </div>

        <div className="lg:col-span-5">
          {status.kind === 'idle' ? (
            <div className="p-5 text-sm text-muted">
              Press read. The sample page is invented and not one of the eleven the site already knows, so what comes back is a reading, not a
              lookup. Edit it first if you like: add a child, a fire, a river.
            </div>
          ) : null}
          {status.kind === 'reading' ? (
            <div className="p-5 text-sm text-muted">
              Reading through {status.via}… <span className="text-2xs">A short page on a large model takes a few seconds.</span>
            </div>
          ) : null}
          {status.kind === 'refused' ? (
            <div className="m-5 rounded-md border border-block-edge bg-block-wash p-4 text-sm text-block-deep">{status.why}</div>
          ) : null}
          {status.kind === 'error' ? <div className="m-5 rounded-md border border-review-edge bg-review-wash p-4 text-sm text-review-deep">{status.message}</div> : null}
          {status.kind === 'done' ? (
            <>
              <div className="border-b border-line px-4 py-2.5">
                <Eyebrow>
                  Read by {status.model} through {status.via}
                  {status.inTokens !== null && status.outTokens !== null ? ` · ${status.inTokens} in · ${status.outTokens} out` : ''}
                </Eyebrow>
              </div>
              <FactList facts={status.facts} lit={lit} onLit={setLit} />
            </>
          ) : null}
        </div>
      </div>

      {status.kind === 'done' ? (
        <div className="border-t border-line p-5">
          <Eyebrow>The page, as read</Eyebrow>
          <div className="mt-3">
            <SpannedPage text={readText} facts={status.facts} lit={lit} onLit={setLit} />
          </div>
        </div>
      ) : null}

      <details className="border-t border-line px-5 py-3 text-xs text-muted">
        <summary className="cursor-pointer select-none font-medium text-body">The contract the model is held to</summary>
        <pre className="mt-2 whitespace-pre-wrap font-mono text-[11.5px] leading-relaxed text-body">{BREAKDOWN_CONTRACT}</pre>
      </details>
    </Card>
  );
}
