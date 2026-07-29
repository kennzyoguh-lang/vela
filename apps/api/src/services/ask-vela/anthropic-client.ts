import Anthropic from "@anthropic-ai/sdk";
import { env } from "../../lib/env";

// ANTHROPIC_API_KEY unset means Ask Vela fails loudly at the call site, not
// at boot — same "never blocks anything else" contract as
// paystack.gateway.ts / mono.gateway.ts (Handbook 1.4).
let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured — set it to enable Ask Vela");
  }
  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return client;
}
