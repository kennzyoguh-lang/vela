-- CreateEnum
CREATE TYPE "ask_vela_message_role" AS ENUM ('user', 'assistant');

-- CreateTable
CREATE TABLE "ask_vela_conversations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ask_vela_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ask_vela_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "role" "ask_vela_message_role" NOT NULL,
    "content" TEXT NOT NULL,
    "citations" JSONB,
    "tool_calls" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ask_vela_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ask_vela_conversations_org_id_user_id_idx" ON "ask_vela_conversations"("org_id", "user_id");

-- CreateIndex
CREATE INDEX "ask_vela_messages_org_id_conversation_id_idx" ON "ask_vela_messages"("org_id", "conversation_id");

-- AddForeignKey
ALTER TABLE "ask_vela_conversations" ADD CONSTRAINT "ask_vela_conversations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ask_vela_conversations" ADD CONSTRAINT "ask_vela_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ask_vela_messages" ADD CONSTRAINT "ask_vela_messages_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ask_vela_messages" ADD CONSTRAINT "ask_vela_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ask_vela_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

