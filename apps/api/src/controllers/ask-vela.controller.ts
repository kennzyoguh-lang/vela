import type { Request, Response } from "express";
import * as conversationService from "../services/ask-vela/conversation.service";
import * as insightService from "../services/ask-vela/insight.service";
import { sendAskVelaMessageSchema } from "../validation/ask-vela.schema";
import { sendSuccess } from "../lib/response";
import { getAuthContext } from "../lib/auth-context";

export async function createConversation(req: Request, res: Response) {
  const { orgId, userId } = getAuthContext(req);
  const conversation = await conversationService.createConversation(orgId, userId);
  sendSuccess(res, conversation, 201);
}

export async function listConversations(req: Request, res: Response) {
  const { orgId, userId } = getAuthContext(req);
  const conversations = await conversationService.listConversations(orgId, userId);
  sendSuccess(res, conversations);
}

export async function getConversation(req: Request, res: Response) {
  const { orgId, userId } = getAuthContext(req);
  const result = await conversationService.getConversation(
    orgId,
    userId,
    req.params.conversationId!,
  );
  sendSuccess(res, result);
}

// Streaming endpoint — writes newline-delimited JSON chunks rather than a
// single JSON body, since the whole point is to forward the model's text
// deltas as they arrive. The conversation-ownership check runs (via
// getConversation) BEFORE any streaming header is sent, so a 404/ownership
// failure still surfaces as a normal JSON error through asyncHandler +
// the global error handler — once headers are flushed below, an error can
// only be reported as one more NDJSON line, never a fresh HTTP status.
export async function sendMessage(req: Request, res: Response) {
  const { orgId, userId } = getAuthContext(req);
  const conversationId = req.params.conversationId!;
  const { content } = sendAskVelaMessageSchema.parse(req.body);

  await conversationService.getConversation(orgId, userId, conversationId);

  res.setHeader("Content-Type", "application/x-ndjson");
  res.flushHeaders();

  try {
    const result = await conversationService.runTurn(
      orgId,
      userId,
      conversationId,
      content,
      (delta) => {
        res.write(`${JSON.stringify({ type: "delta", text: delta })}\n`);
      },
    );
    res.write(
      `${JSON.stringify({
        type: "done",
        citations: result.citations,
        truncated: result.truncated,
      })}\n`,
    );
  } catch (err) {
    res.write(
      `${JSON.stringify({
        type: "error",
        message: err instanceof Error ? err.message : "Something went wrong",
      })}\n`,
    );
  } finally {
    res.end();
  }
}

export async function getInsight(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const insight = await insightService.generateInsight(orgId);
  sendSuccess(res, insight);
}
