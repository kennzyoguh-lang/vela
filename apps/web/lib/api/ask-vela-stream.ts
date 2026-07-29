import type { ApiResponse } from "@vela/types";
import { authorizedFetch } from "./client";

export interface Citation {
  module: string;
  refId: string;
  label: string;
}

interface AskVelaStreamCallbacks {
  onDelta: (text: string) => void;
  onDone: (result: { citations: Citation[]; truncated: boolean }) => void;
  onError: (message: string) => void;
}

type StreamLine =
  | { type: "delta"; text: string }
  | { type: "done"; citations: Citation[]; truncated: boolean }
  | { type: "error"; message: string };

// Streamed response body, not a single JSON payload — request()/api.post()
// assume one JSON body, so this does its own fetch, reusing authorizedFetch
// for the same Bearer-attach + 401-retry logic every other call gets.
// Transport is a plain chunked fetch response (newline-delimited JSON), not
// SSE — EventSource can't set the Authorization header this app's entire
// auth model depends on.
export async function streamAskVela(
  conversationId: string,
  message: string,
  callbacks: AskVelaStreamCallbacks,
): Promise<void> {
  const res = await authorizedFetch(`/v1/ask-vela/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: message }),
  });

  if (!res.ok) {
    let msg = "Ask Vela couldn't respond.";
    try {
      const body = (await res.json()) as ApiResponse<unknown>;
      if (!body.success) msg = body.error.message;
    } catch {
      // Not JSON — keep the generic message.
    }
    callbacks.onError(msg);
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    callbacks.onError("Ask Vela couldn't respond.");
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      if (!line) continue;

      let parsed: StreamLine;
      try {
        parsed = JSON.parse(line) as StreamLine;
      } catch {
        continue;
      }

      if (parsed.type === "delta") callbacks.onDelta(parsed.text);
      else if (parsed.type === "done")
        callbacks.onDone({ citations: parsed.citations, truncated: parsed.truncated });
      else if (parsed.type === "error") callbacks.onError(parsed.message);
    }
  }
}
