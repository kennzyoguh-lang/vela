import { randomUUID } from "node:crypto";
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

beforeAll(() => {
  process.env.DATABASE_URL ??= "postgresql://vela:vela@localhost:5432/vela_test";
  process.env.APP_DATABASE_URL ??= "postgresql://vela:vela@localhost:5432/vela_test";
  process.env.REDIS_URL ??= "redis://localhost:6379";
  process.env.JWT_PRIVATE_KEY_BASE64 ??= "placeholder";
  process.env.JWT_PUBLIC_KEY_BASE64 ??= "placeholder";
});

const streamMock = vi.fn();
const getAnthropicClientMock = vi.fn(() => ({ messages: { stream: streamMock } }));

vi.mock("./anthropic-client", () => ({
  getAnthropicClient: () => getAnthropicClientMock(),
}));

vi.mock("./tools", () => ({
  askVelaTools: [
    {
      name: "get_cash_position",
      description: "test tool",
      input_schema: { type: "object", properties: {} },
      execute: vi.fn(async () => ({ data: { total: 1000 }, citations: [] })),
    },
  ],
  getToolByName: (name: string) =>
    name === "get_cash_position"
      ? {
          name: "get_cash_position",
          execute: vi.fn(async () => ({ data: { total: 1000 }, citations: [] })),
        }
      : undefined,
}));

vi.mock("../../repositories/ask-vela.repository", () => ({
  findConversationById: vi.fn(),
  appendMessage: vi.fn(),
  setConversationTitle: vi.fn(),
  listMessages: vi.fn(),
  touchConversation: vi.fn(),
}));

import * as askVelaRepo from "../../repositories/ask-vela.repository";

function streamEvent(isForcedTextOnly: boolean, toolInput: unknown = {}) {
  return {
    on: vi.fn(),
    finalMessage: vi.fn().mockResolvedValue(
      isForcedTextOnly
        ? { stop_reason: "end_turn", content: [{ type: "text", text: "Final answer." }] }
        : {
            stop_reason: "tool_use",
            content: [{ type: "tool_use", id: "tu1", name: "get_cash_position", input: toolInput }],
          },
    ),
  };
}

describe("conversation.service", () => {
  const orgId = randomUUID();
  const userId = randomUUID();
  const conversationId = randomUUID();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(askVelaRepo.findConversationById).mockResolvedValue({
      id: conversationId,
      orgId,
      userId,
      title: "Existing",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    vi.mocked(askVelaRepo.listMessages).mockResolvedValue([]);
    vi.mocked(askVelaRepo.appendMessage).mockResolvedValue({} as never);
  });

  it("stops at MAX_TOOL_ITERATIONS rather than looping forever", async () => {
    // Every call returns tool_use UNLESS it was forced text-only (tool_choice:
    // "none", the loop's last iteration) — simulates a model that never stops
    // asking for tools within its own judgement, so the cap is what ends it.
    streamMock.mockImplementation((params: { tool_choice?: { type?: string } }) =>
      streamEvent(params.tool_choice?.type === "none"),
    );

    const { runTurn } = await import("./conversation.service");
    const result = await runTurn(orgId, userId, conversationId, "keep checking my cash forever");

    expect(streamMock).toHaveBeenCalledTimes(6); // MAX_TOOL_ITERATIONS
    expect(result.content).toBe("Final answer.");
  });

  it("persists the tool-call audit trail and collected citations", async () => {
    let callCount = 0;
    streamMock.mockImplementation(() => {
      callCount += 1;
      return callCount === 1 ? streamEvent(false, { foo: "bar" }) : streamEvent(true);
    });

    const { runTurn } = await import("./conversation.service");
    await runTurn(orgId, userId, conversationId, "what's my cash position?");

    expect(askVelaRepo.appendMessage).toHaveBeenCalledWith(
      orgId,
      conversationId,
      expect.objectContaining({
        role: "assistant",
        toolCalls: [{ name: "get_cash_position", input: { foo: "bar" } }],
      }),
    );
  });

  it("propagates the anthropic-client gate error rather than swallowing it", async () => {
    // anthropic-client.test.ts covers the real gate's own "throws only when
    // actually called, never at import time" guarantee — this just confirms
    // runTurn doesn't swallow whatever getAnthropicClient throws.
    getAnthropicClientMock.mockImplementationOnce(() => {
      throw new Error("ANTHROPIC_API_KEY is not configured — set it to enable Ask Vela");
    });

    const { runTurn } = await import("./conversation.service");
    await expect(runTurn(orgId, userId, conversationId, "hello")).rejects.toThrow(
      /ANTHROPIC_API_KEY is not configured/,
    );
  });

  it("throws NotFoundError when the conversation doesn't belong to this user", async () => {
    vi.mocked(askVelaRepo.findConversationById).mockResolvedValue({
      id: conversationId,
      orgId,
      userId: randomUUID(), // a different user
      title: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const { runTurn } = await import("./conversation.service");
    await expect(runTurn(orgId, userId, conversationId, "hello")).rejects.toThrow(/not found/i);
    expect(streamMock).not.toHaveBeenCalled();
  });
});
