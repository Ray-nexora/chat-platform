import { Buffer } from "buffer";

export interface MessageCursorPayload {
  id: string;
  createdAt: string;
}

export function encodeMessageCursor(cursor: {
  id: string;
  createdAt: Date;
}): string {
  const payload: MessageCursorPayload = {
    id: cursor.id,
    createdAt: cursor.createdAt.toISOString(),
  };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeMessageCursor(
  cursor: string
): { id: string; createdAt: Date } | null {
  try {
    const json = Buffer.from(cursor, "base64url").toString("utf8");
    const o = JSON.parse(json) as MessageCursorPayload;
    if (!o?.id || !o?.createdAt) return null;
    const createdAt = new Date(o.createdAt);
    if (Number.isNaN(createdAt.getTime())) return null;
    return { id: o.id, createdAt };
  } catch {
    return null;
  }
}
