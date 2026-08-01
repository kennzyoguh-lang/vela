"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { api, ApiError } from "@/lib/api/client";
import { streamAskVela, type Citation } from "@/lib/api/ask-vela-stream";
import { cn } from "@/lib/utils";

interface AskVelaConversationSummary {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AskVelaMessageRecord {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[] | null;
}

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  streaming?: boolean;
}

function CitationChips({ citations }: { citations: Citation[] }) {
  if (citations.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {citations.map((c) => (
        <span
          key={c.refId}
          title={c.label}
          className="bg-surface-canvas text-text-secondary rounded-pill px-2 py-0.5 text-[0.6875rem]"
        >
          {c.label.length > 32 ? `${c.label.slice(0, 32)}…` : c.label}
        </span>
      ))}
    </div>
  );
}

// Shared chat core for both the dock (AskVelaDock.tsx) and the full page
// (app/(dashboard)/ask-vela/page.tsx) — the parent controls the outer height
// container (the dock is already a flex child of the h-dvh app shell; the
// full page wraps this in an explicit height div), this component only
// needs h-full flex flex-col internally.
export function ChatPanel({ variant }: { variant: "dock" | "full" }) {
  const queryClient = useQueryClient();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [pendingMessages, setPendingMessages] = useState<DisplayMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: conversations } = useQuery({
    queryKey: ["ask-vela", "conversations"],
    queryFn: () => api.get<AskVelaConversationSummary[]>("/v1/ask-vela/conversations"),
    staleTime: 30_000,
  });

  const { data: conversationDetail, isLoading: isLoadingMessages } = useQuery({
    queryKey: ["ask-vela", "conversations", conversationId],
    queryFn: () =>
      api.get<{ conversation: AskVelaConversationSummary; messages: AskVelaMessageRecord[] }>(
        `/v1/ask-vela/conversations/${conversationId}`,
      ),
    enabled: !!conversationId,
  });

  useEffect(() => {
    setPendingMessages([]);
  }, [conversationId]);

  const persistedMessages: DisplayMessage[] =
    conversationDetail?.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      citations: m.citations ?? undefined,
    })) ?? [];
  const displayMessages = [...persistedMessages, ...pendingMessages];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [displayMessages.length, pendingMessages]);

  async function handleSend() {
    const content = input.trim();
    if (!content || isSending) return;
    setInput("");
    setError(null);
    setIsSending(true);

    let activeConversationId = conversationId;
    if (!activeConversationId) {
      try {
        const created = await api.post<AskVelaConversationSummary>("/v1/ask-vela/conversations");
        activeConversationId = created.id;
        setConversationId(created.id);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Couldn't start a conversation.");
        setIsSending(false);
        return;
      }
    }

    const assistantMessageId = `pending-assistant-${Date.now()}`;
    setPendingMessages((prev) => [
      ...prev,
      { id: `pending-user-${Date.now()}`, role: "user", content },
      { id: assistantMessageId, role: "assistant", content: "", streaming: true },
    ]);

    await streamAskVela(activeConversationId, content, {
      onDelta: (delta) => {
        setPendingMessages((prev) =>
          prev.map((m) => (m.id === assistantMessageId ? { ...m, content: m.content + delta } : m)),
        );
      },
      onDone: () => {
        setIsSending(false);
        setPendingMessages([]);
        queryClient.invalidateQueries({
          queryKey: ["ask-vela", "conversations", activeConversationId],
        });
        queryClient.invalidateQueries({ queryKey: ["ask-vela", "conversations"] });
      },
      onError: (message) => {
        setError(message);
        setIsSending(false);
        setPendingMessages([]);
      },
    });
  }

  return (
    <div className="flex h-full flex-col">
      {variant === "full" ? (
        <div className="border-border flex flex-wrap gap-2 border-b p-3">
          <Button
            size="sm"
            variant={conversationId === null ? "primary" : "secondary"}
            onClick={() => setConversationId(null)}
          >
            New conversation
          </Button>
          {(conversations ?? []).map((c) => (
            <Button
              key={c.id}
              size="sm"
              variant={c.id === conversationId ? "primary" : "ghost"}
              onClick={() => setConversationId(c.id)}
            >
              {c.title ?? "Untitled"}
            </Button>
          ))}
        </div>
      ) : null}

      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        className="flex flex-1 flex-col gap-3 overflow-y-auto p-4"
      >
        {isLoadingMessages ? (
          <Skeleton className="h-16 w-2/3" />
        ) : displayMessages.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-center">
            <p className="font-ui text-text-secondary text-[0.875rem]">
              Ask about your invoices, compliance deadlines, cash position, or payroll.
            </p>
          </div>
        ) : (
          displayMessages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "font-ui max-w-[85%] rounded-md px-3 py-2 text-[0.875rem]",
                m.role === "user"
                  ? "bg-cobalt/10 text-text-primary self-end"
                  : "bg-surface-raised text-text-primary self-start",
              )}
            >
              <p className="whitespace-pre-wrap">
                {m.content}
                {m.streaming && !m.content ? (
                  <Loader2 className="text-text-secondary inline size-3 animate-spin" aria-hidden />
                ) : null}
              </p>
              {m.citations ? <CitationChips citations={m.citations} /> : null}
            </div>
          ))
        )}
      </div>

      {error ? (
        <p role="alert" className="text-status-danger px-4 pb-2 text-[0.8125rem]">
          {error}
        </p>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSend();
        }}
        className="border-border flex items-end gap-2 border-t p-3"
      >
        <label htmlFor={`ask-vela-input-${variant}`} className="sr-only">
          Ask Vela
        </label>
        <textarea
          id={`ask-vela-input-${variant}`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          rows={1}
          placeholder="Ask Vela anything about your business…"
          className="border-border bg-surface-raised font-ui text-text-primary focus:border-data-aiAccent max-h-24 flex-1 resize-none rounded-sm border px-3 py-2 text-[0.875rem]"
        />
        <Button type="submit" size="icon" loading={isSending} disabled={!input.trim()}>
          <Send className="size-4" aria-hidden />
        </Button>
      </form>
    </div>
  );
}
