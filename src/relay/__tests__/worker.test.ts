import { describe, expect, it } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { BREAKDOWN_CONTRACT } from '../../engine/breakdown';
import { handleRequest, type Env, type Reader } from '../worker';

/* ===========================================================================
   THE RELAY, WITHOUT A NETWORK

   The call to Anthropic is injected, so these tests hold the relay to its
   four jobs: refuse strangers, refuse anything not shaped like a scene,
   rate-limit, and turn every failure into a plain sentence.
   =========================================================================== */

const SITE = 'https://scottdelia.github.io';
const PAGE = 'EXT. HILLFORT, GATE — DAWN\n\nA column of riders waits below the gate. THE SMITH opens it from inside.';

const okReader: Reader = async ({ model, contract, page }) => {
  expect(contract).toBe(BREAKDOWN_CONTRACT);
  expect(page).toBe(PAGE);
  return { model, inTokens: 900, outTokens: 120, output: { facts: [{ key: 'int_ext', value: 'EXT', conf: 0.99, quote: 'EXT.', note: null }] }, refusal: null };
};

function post(body: unknown, origin: string | null = SITE, path = '/read'): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (origin) headers.origin = origin;
  return new Request(`https://relay.example${path}`, { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) });
}

const env: Env = { ANTHROPIC_API_KEY: 'sk-ant-test' };

describe('who may call the relay', () => {
  it('answers a preflight from the site and refuses one from anywhere else', async () => {
    const ok = await handleRequest(new Request('https://relay.example/read', { method: 'OPTIONS', headers: { origin: SITE } }), env, okReader);
    expect(ok.status).toBe(204);
    expect(ok.headers.get('access-control-allow-origin')).toBe(SITE);
    const no = await handleRequest(new Request('https://relay.example/read', { method: 'OPTIONS', headers: { origin: 'https://evil.example' } }), env, okReader);
    expect(no.status).toBe(403);
  });

  it('refuses a request with no origin or a foreign one', async () => {
    expect((await handleRequest(post({ page: PAGE }, null), env, okReader)).status).toBe(403);
    expect((await handleRequest(post({ page: PAGE }, 'https://evil.example'), env, okReader)).status).toBe(403);
  });

  it('honors a configured origin list', async () => {
    const custom: Env = { ...env, ALLOWED_ORIGINS: 'https://other.example' };
    expect((await handleRequest(post({ page: PAGE }, 'https://other.example'), custom, okReader)).status).toBe(200);
    expect((await handleRequest(post({ page: PAGE }, SITE), custom, okReader)).status).toBe(403);
  });

  it('has one door', async () => {
    expect((await handleRequest(post({ page: PAGE }, SITE, '/anything'), env, okReader)).status).toBe(404);
  });
});

describe('what may cross', () => {
  it('reads a page shaped like a scene and returns the model, the usage and the facts', async () => {
    const res = await handleRequest(post({ page: PAGE, model: 'claude-sonnet-5' }), env, okReader);
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe(SITE);
    const body = (await res.json()) as { ok: boolean; model: string; usage: { input_tokens: number }; output: { facts: unknown[] }; refusal: null };
    expect(body.ok).toBe(true);
    expect(body.model).toBe('claude-sonnet-5');
    expect(body.usage.input_tokens).toBe(900);
    expect(body.output.facts).toHaveLength(1);
  });

  it('falls back to Sonnet for an unknown model name', async () => {
    const res = await handleRequest(post({ page: PAGE, model: 'gpt-9' }), env, okReader);
    expect(((await res.json()) as { model: string }).model).toBe('claude-sonnet-5');
  });

  it('refuses what is not JSON, not a scene, or carries a record', async () => {
    expect((await handleRequest(post('not json'), env, okReader)).status).toBe(400);
    const noSlug = await handleRequest(post({ page: 'Maelor rides to the ford.' }), env, okReader);
    expect(noSlug.status).toBe(400);
    expect(((await noSlug.json()) as { message: string }).message).toMatch(/slugline/);
    const email = await handleRequest(post({ page: `${PAGE}\nCall maelor@example.com.` }), env, okReader);
    expect(email.status).toBe(400);
    expect((await handleRequest(post({ page: 'x'.repeat(20_000) }), env, okReader)).status).toBe(413);
  });

  it('carries a refusal instead of inventing facts', async () => {
    const declining: Reader = async ({ model }) => ({ model, inTokens: 10, outTokens: 0, output: null, refusal: 'not a script' });
    const body = (await (await handleRequest(post({ page: PAGE }), env, declining)).json()) as { refusal: string; output: null };
    expect(body.refusal).toBe('not a script');
    expect(body.output).toBeNull();
  });
});

describe('what a demo may cost', () => {
  const closed = { limit: async () => ({ success: false }) };
  const open = { limit: async () => ({ success: true }) };

  it('rate-limits one caller and everyone', async () => {
    expect((await handleRequest(post({ page: PAGE }), { ...env, PER_IP: closed, GLOBAL: open }, okReader)).status).toBe(429);
    expect((await handleRequest(post({ page: PAGE }), { ...env, PER_IP: open, GLOBAL: closed }, okReader)).status).toBe(429);
    expect((await handleRequest(post({ page: PAGE }), { ...env, PER_IP: open, GLOBAL: open }, okReader)).status).toBe(200);
  });

  it('says so when the relay itself has no key, before spending anything', async () => {
    let called = false;
    const spy: Reader = async (a) => {
      called = true;
      return okReader(a);
    };
    const res = await handleRequest(post({ page: PAGE }), {}, spy);
    expect(res.status).toBe(500);
    expect(called).toBe(false);
  });
});

describe('how it fails', () => {
  it("turns a rejected relay key into the relay's problem, not the visitor's", async () => {
    const bad: Reader = async () => {
      throw new Anthropic.AuthenticationError(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }, 'invalid x-api-key', new Headers());
    };
    const res = await handleRequest(post({ page: PAGE }), env, bad);
    expect(res.status).toBe(500);
    expect(((await res.json()) as { message: string }).message).toMatch(/relay's problem/);
  });

  it('turns a network failure into a sentence', async () => {
    const down: Reader = async () => {
      throw new Error('socket hang up');
    };
    const res = await handleRequest(post({ page: PAGE }), env, down);
    expect(res.status).toBe(502);
    expect(((await res.json()) as { message: string }).message).toMatch(/could not reach/);
  });
});
