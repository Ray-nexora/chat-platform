import type { ChatMessageEntity } from "../database/entities/chat-message.entity";
import type { Attachment, ChatMessage, LinkPreview, MessageType } from "../types/message";

export function toChatMessage(row: ChatMessageEntity): ChatMessage {
  const threadId = row.threadId ?? row.thread?.id;
  if (!threadId) {
    throw new Error("ChatMessageEntity missing thread id");
  }
  return {
    id: row.id,
    threadId,
    senderId: row.senderId,
    type: row.type as MessageType,
    text: row.text ?? undefined,
    attachments: row.attachments as Attachment[] | undefined,
    linkPreview: row.linkPreview as LinkPreview | undefined,
    createdAt: row.createdAt.toISOString(),
  };
}
