import type { MessageParam, ContentBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { getAnthropicClient } from "./anthropic-client";
import { askVelaTools, getToolByName, type Citation } from "./tools";
import * as askVelaRepo from "../../repositories/ask-vela.repository";
import { NotFoundError } from "../../lib/errors";
import { logger } from "../../lib/logger";

const MODEL = "claude-sonnet-5";
const MAX_TOKENS = 2048;
// Hard cap on tool-calling round-trips per turn — prevents a runaway loop.
// If hit, one final call is made with tool_choice "none" to force a text
// answer from whatever the model has already learned, rather than looping
// forever or returning nothing.
const MAX_TOOL_ITERATIONS = 6;

const SYSTEM_PROMPT = `You are Ask Vela, the AI assistant built into VELA, a business \
operating system for Nigerian SMEs. You act as a knowledgeable colleague with read-only \
access to this specific organisation's own financial and compliance records, via the \
tools provided. Never fabricate a number — always call the relevant tool to check before \
answering a factual question about the business. If a question is outside what your \
tools can see (e.g. general business advice, tax law explanation not tied to this org's \
own filings), answer conversationally without inventing org-specific data. Be concise and \
direct, in the tone of a competent colleague, not a customer-support bot.`;

const TOOL_DEFINITIONS = askVelaTools.map((t) => ({
  name: t.name,
  description: t.description,
  input_schema: t.input_schema,
}));

export interface TurnResult {
  content: string;
  citations: Citation[];
  truncated: boolean;
}

export async function createConversation(orgId: string, userId: string) {
  return askVelaRepo.createConversation(orgId, userId);
}

export async function listConversations(orgId: string, userId: string) {
  return askVelaRepo.listConversationsForUser(orgId, userId);
}

// Conversations are private to the user who started them — RLS only
// enforces org isolation, so ownership within an org is checked here,
// otherwise any org member could read a colleague's Ask Vela history by
// conversation id alone.
async function findOwnConversation(orgId: string, userId: string, conversationId: string) {
  const conversation = await askVelaRepo.findConversationById(orgId, conversationId);
  if (!conversation || conversation.userId !== userId) {
    throw new NotFoundError("Conversation not found");
  }
  return conversation;
}

export async function getConversation(orgId: string, userId: string, conversationId: string) {
  const conversation = await findOwnConversation(orgId, userId, conversationId);
  const messages = await askVelaRepo.listMessages(orgId, conversationId);
  return { conversation, messages };
}

function toMessageParam(role: "user" | "assistant", content: string): MessageParam {
  return { role, content };
}

/**
 * The tool-calling loop: build history from persisted messages, stream a
 * turn, execute any requested tools against this org's own data, and repeat
 * until the model stops asking for tools (or the iteration cap is hit).
 * `onDelta` is called with each text token as it streams in — the caller
 * (the HTTP controller) is responsible for forwarding it to the client.
 */
export async function runTurn(
  orgId: string,
  userId: string,
  conversationId: string,
  userMessage: string,
  onDelta?: (delta: string) => void,
): Promise<TurnResult> {
  const conversation = await findOwnConversation(orgId, userId, conversationId);

  await askVelaRepo.appendMessage(orgId, conversationId, { role: "user", content: userMessage });
  if (!conversation.title) {
    await askVelaRepo.setConversationTitle(orgId, conversationId, userMessage.slice(0, 80));
  }

  const priorMessages = await askVelaRepo.listMessages(orgId, conversationId);
  let messages: MessageParam[] = priorMessages.map((m) => toMessageParam(m.role, m.content));

  const client = getAnthropicClient();
  const allCitations: Citation[] = [];
  const toolCallAudit: Array<{ name: string; input: unknown }> = [];
  let assistantText = "";
  let truncated = false;

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const forceTextOnly = iteration === MAX_TOOL_ITERATIONS - 1;
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages,
      tools: TOOL_DEFINITIONS,
      tool_choice: forceTextOnly ? { type: "none" } : { type: "auto" },
    });

    if (onDelta) {
      stream.on("text", (delta) => onDelta(delta));
    }

    const finalMsg = await stream.finalMessage();
    if (finalMsg.stop_reason === "max_tokens") truncated = true;

    for (const block of finalMsg.content) {
      if (block.type === "text") assistantText += block.text;
    }

    if (finalMsg.stop_reason !== "tool_use") break;

    messages = [...messages, { role: "assistant", content: finalMsg.content }];

    const toolResults: ContentBlockParam[] = [];
    for (const block of finalMsg.content) {
      if (block.type !== "tool_use") continue;
      toolCallAudit.push({ name: block.name, input: block.input });
      const tool = getToolByName(block.name);
      if (!tool) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: `Unknown tool: ${block.name}`,
          is_error: true,
        });
        continue;
      }
      try {
        const result = await tool.execute(orgId, block.input);
        allCitations.push(...result.citations);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result.data),
        });
      } catch (err) {
        // The raw error (a Prisma driver message, a stack trace, an internal
        // path) goes to our own logs only — sending it back as tool_result
        // content puts it directly in the model's context, and from there
        // potentially in what it says back to the user. The model only needs
        // to know the call failed, not why.
        logger.error({ err, tool: block.name, orgId }, "Ask Vela tool execution failed");
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content:
            "This tool failed to execute. Try a different approach, or let the user know you couldn't retrieve that information.",
          is_error: true,
        });
      }
    }
    messages = [...messages, { role: "user", content: toolResults }];
  }

  await askVelaRepo.appendMessage(orgId, conversationId, {
    role: "assistant",
    content: assistantText,
    citations: allCitations,
    toolCalls: toolCallAudit,
  });
  await askVelaRepo.touchConversation(orgId, conversationId);

  return { content: assistantText, citations: allCitations, truncated };
}
