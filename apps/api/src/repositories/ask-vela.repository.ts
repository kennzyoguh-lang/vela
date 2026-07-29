import { randomUUID } from "node:crypto";
import { withOrgScope } from "../lib/prisma";
import type {
  AskVelaConversation,
  AskVelaMessage,
  AskVelaMessageRole,
  Prisma,
} from "@prisma/client";

export async function createConversation(
  orgId: string,
  userId: string,
): Promise<AskVelaConversation> {
  return withOrgScope(orgId, (tx) =>
    tx.askVelaConversation.create({ data: { id: randomUUID(), orgId, userId } }),
  );
}

export async function listConversationsForUser(
  orgId: string,
  userId: string,
): Promise<AskVelaConversation[]> {
  return withOrgScope(orgId, (tx) =>
    tx.askVelaConversation.findMany({
      where: { orgId, userId },
      orderBy: { updatedAt: "desc" },
    }),
  );
}

export async function findConversationById(
  orgId: string,
  conversationId: string,
): Promise<AskVelaConversation | null> {
  return withOrgScope(orgId, (tx) =>
    tx.askVelaConversation.findFirst({ where: { id: conversationId, orgId } }),
  );
}

export async function setConversationTitle(
  orgId: string,
  conversationId: string,
  title: string,
): Promise<void> {
  await withOrgScope(orgId, (tx) =>
    tx.askVelaConversation.update({ where: { id: conversationId, orgId }, data: { title } }),
  );
}

export async function touchConversation(orgId: string, conversationId: string): Promise<void> {
  await withOrgScope(orgId, (tx) =>
    tx.askVelaConversation.update({
      where: { id: conversationId, orgId },
      data: { updatedAt: new Date() },
    }),
  );
}

export async function listMessages(
  orgId: string,
  conversationId: string,
): Promise<AskVelaMessage[]> {
  return withOrgScope(orgId, (tx) =>
    tx.askVelaMessage.findMany({
      where: { orgId, conversationId },
      orderBy: { createdAt: "asc" },
    }),
  );
}

export interface AppendMessageInput {
  role: AskVelaMessageRole;
  content: string;
  citations?: unknown;
  toolCalls?: unknown;
}

export async function appendMessage(
  orgId: string,
  conversationId: string,
  input: AppendMessageInput,
): Promise<AskVelaMessage> {
  return withOrgScope(orgId, (tx) =>
    tx.askVelaMessage.create({
      data: {
        id: randomUUID(),
        orgId,
        conversationId,
        role: input.role,
        content: input.content,
        citations: input.citations as Prisma.InputJsonValue,
        toolCalls: input.toolCalls as Prisma.InputJsonValue,
      },
    }),
  );
}
