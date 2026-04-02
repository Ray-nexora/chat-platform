import type { ChatMessage, MessageType } from "../types/message";

export interface CreateMessageInput {
  senderId: string;
  type?: MessageType;
  text?: string;
  attachments?: ChatMessage["attachments"];
  linkPreview?: ChatMessage["linkPreview"];
}

/** HTTP body for POST message — sender comes from JWT. */
export type PostMessageBody = Omit<CreateMessageInput, "senderId">;
