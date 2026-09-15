import Anthropic from '@anthropic-ai/sdk';
import { buildLiveBreakdownRequest } from '../engine/breakdown';
import { RELAY_MAX_TOKENS, factsOutputFormat, isRelayModel, relayModel, type RelayModelId } from '../shared/facts';

/* ===========================================================================
   THE RELAY

   A Cloudflare Worker, about a hundred lines, that stands between the page
   and api.anthropic.com so that a visitor needs no key. It holds one key, the
   site owner's, as a secret. It does four things and nothing else:

   1. Refuses anything that did not come from the site (the Origin header).
   2. Refuses anything not shaped like a scene page, through the same
      `buildLiveBreakdownRequest` the tests hold. The payload to the model is
      the contract and the page. That is all.
   3. Rate-limits by caller and in total, so a demo cannot become a bill.
   4. Returns the model's facts, the model name and the token counts, or a
      plain sentence saying why not.

   It stores nothing and logs nothing. There is no page text anywhere after
   the response is sent.
   =========================================================================== */

export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  /** The site owner's key. Set with `wrangler secret put ANTHROPIC_API_KEY`; never in code or config. */
  ANTHROPIC_API_KEY?: string;
  /** Comma-separated origins allowed to call the relay. */
  ALLOWED_ORIGINS?: string;
  PER_IP?: RateLimiter;
  GLOBAL?: RateLimiter;
}

export interface ReadResult {
  model: string;
  inTokens: number;
  outTokens: number;
  /** The facts object as the model returned it. Null when the model declined. */
  output: unknown;
  refusal: string | null;
}

export type Reader = (args: { apiKey: string; model: RelayModelId; contract: string; page: string; effort: boolean }) => Promise<ReadResult>;

const DEFAULT_ORIGINS = ['https://scottdelia.github.io', 'http://localhost:5184', 'http://localhost:5185'];
const MAX_BODY_BYTES = 16_384;

function allowedOrigins(env: Env): string[] {
  const configured = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return configured.length > 0 ? configured : DEFAULT_ORIGINS;
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
}

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

/** The call to Anthropic, kept apart from the request handling so the handling can be tested without a network. */
export const sdkReader: Reader = async ({ apiKey, model, contract, page, effort }) => {
  const client = new Anthropic({ apiKey, maxRetries: 1 });
  const format = factsOutputFormat();
  const response = await client.messages.parse({
    model,
    max_tokens: RELAY_MAX_TOKENS,
    system: contract,
    messages: [{ role: 'user', content: page }],
    output_config: effort ? { format, effort: 'medium' } : { format },
  });
  if (response.stop_reason === 'refusal') {
    return {
      model: response.model,
      inTokens: response.usage.input_tokens,
      outTokens: response.usage.output_tokens,
      output: null,
      refusal: response.stop_details?.explanation ?? 'no explanation given',
    };
  }
  return {
    model: response.model,
    inTokens: response.usage.input_tokens,
    outTokens: response.usage.output_tokens,
    output: response.parsed_output ?? null,
    refusal: null,
  };
};

export async function handleRequest(request: Request, env: Env, read: Reader = sdkReader): Promise<Response> {
  const origin = request.headers.get('origin');
  const allowed = origin !== null && allowedOrigins(env).includes(origin);
  const cors = allowed ? corsHeaders(origin) : {};

  if (request.method === 'OPTIONS') {
    return allowed ? new Response(null, { status: 204, headers: cors }) : json(403, { ok: false, message: 'This relay answers only the site it was built for.' });
  }
  if (!allowed) return json(403, { ok: false, message: 'This relay answers only the site it was built for.' });
  if (request.method !== 'POST' || new URL(request.url).pathname !== '/read') {
    return json(404, { ok: false, message: 'POST /read is the only door.' }, cors);
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json(413, { ok: false, message: 'That is longer than a scene page can be.' }, cors);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { ok: false, message: 'The request was not JSON.' }, cors);
  }
  const page = body && typeof body === 'object' ? (body as { page?: unknown }).page : undefined;
  const modelRaw = body && typeof body === 'object' ? (body as { model?: unknown }).model : undefined;
  const model: RelayModelId = isRelayModel(modelRaw) ? modelRaw : 'claude-sonnet-5';

  let request2;
  try {
    request2 = buildLiveBreakdownRequest(page);
  } catch (e) {
    return json(400, { ok: false, message: e instanceof Error ? e.message : String(e) }, cors);
  }

  if (!env.ANTHROPIC_API_KEY) {
    return json(500, { ok: false, message: "The relay has no key set. That is the relay's problem, not yours." }, cors);
  }

  const caller = request.headers.get('cf-connecting-ip') ?? 'unknown';
  if (env.PER_IP && !(await env.PER_IP.limit({ key: caller })).success) {
    return json(429, { ok: false, message: 'A few reads a minute is the limit for one visitor. Wait a moment and read again.' }, cors);
  }
  if (env.GLOBAL && !(await env.GLOBAL.limit({ key: 'all' })).success) {
    return json(429, { ok: false, message: 'The relay is busy. Wait a minute and read again.' }, cors);
  }

  try {
    const result = await read({ apiKey: env.ANTHROPIC_API_KEY, model, contract: request2.contract, page: request2.pages[0]!, effort: relayModel(model).effort });
    return json(
      200,
      { ok: true, model: result.model, usage: { input_tokens: result.inTokens, output_tokens: result.outTokens }, output: result.output, refusal: result.refusal },
      cors,
    );
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return json(500, { ok: false, message: "The relay's key was not accepted. That is the relay's problem, not yours." }, cors);
    if (e instanceof Anthropic.RateLimitError) return json(429, { ok: false, message: 'Anthropic is rate-limiting the relay. Wait a moment and read again.' }, cors);
    if (e instanceof Anthropic.BadRequestError) return json(400, { ok: false, message: `The request was refused by the API: ${e.message}` }, cors);
    if (e instanceof Anthropic.APIError) return json(502, { ok: false, message: `API error ${e.status ?? ''}: ${e.message}` }, cors);
    return json(502, { ok: false, message: 'The relay could not reach the API. Nothing was read.' }, cors);
  }
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  },
};
