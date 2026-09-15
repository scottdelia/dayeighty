import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

/* ===========================================================================
   THE SHAPE THE MODEL IS HELD TO

   Shared by the page (the live reader) and the relay (the worker), so both
   sides of the wire ask for exactly the same thing: quotes, not offsets. The
   engine finds the offsets.
   =========================================================================== */

export const FactsSchema = z.object({
  facts: z.array(
    z.object({
      key: z.string(),
      value: z.string(),
      conf: z.number(),
      quote: z.string().nullable(),
      note: z.string().nullable(),
    }),
  ),
});

export type FactsOutput = z.infer<typeof FactsSchema>;

/** The models the relay will call. Sonnet first: it is the default because a read costs cents, not dimes. */
export const RELAY_MODELS = [
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', effort: true },
  { id: 'claude-opus-5', label: 'Claude Opus 5', effort: true },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', effort: false },
] as const;

export type RelayModelId = (typeof RELAY_MODELS)[number]['id'];

export function isRelayModel(x: unknown): x is RelayModelId {
  return RELAY_MODELS.some((m) => m.id === x);
}

export function relayModel(id: RelayModelId): (typeof RELAY_MODELS)[number] {
  return RELAY_MODELS.find((m) => m.id === id)!;
}

/** The structured-output format for the Messages API, built from the same schema. */
export function factsOutputFormat() {
  return zodOutputFormat(FactsSchema);
}

/** The maximum the model may write back. A facts list for one page is well under this. */
export const RELAY_MAX_TOKENS = 4000;
