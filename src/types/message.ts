export type MessageType =
  | "text"
  | "emoji"
  | "gif"
  | "image"
  | "video"
  | "audio"
  | "file"
  | "link_preview";

export interface Attachment {
  kind: "audio" | "image" | "video" | "gif" | "file";
  url: string;
  mime?: string;
  name?: string;
  sizeBytes?: number;
  durationMs?: number;
  width?: number;
  height?: number;
}

export interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  siteName?: string;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  senderId: string;
  type: MessageType;
  /** Plain text, emoji-only, or caption */
  text?: string;
  attachments?: Attachment[];
  linkPreview?: LinkPreview;
  createdAt: string;
}

export type OutgoingEvent =
  | { event: "message"; payload: ChatMessage }
  | { event: "typing"; payload: { threadId: string; userId: string; typing: boolean } }
  | { event: "error"; payload: { message: string } };
