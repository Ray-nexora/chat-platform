import type { ThreadEntity } from "../database/entities/thread.entity";
import type { ThreadMemberEntity } from "../database/entities/thread-member.entity";

export interface ThreadMemberDto {
  userId: string;
  role: string;
  joinedAt: string;
  displayName: string | null;
}

export interface ThreadDetailDto {
  id: string;
  type: string;
  title: string | null;
  directPairKey: string | null;
  /** Present when this thread is scoped to a hub transaction or dispute. */
  contextType: string | null;
  contextExternalId: string | null;
  createdByUserId: string;
  createdAt: string;
  members: ThreadMemberDto[];
}

export function toThreadDetail(
  thread: ThreadEntity,
  members: ThreadMemberEntity[]
): ThreadDetailDto {
  return {
    id: thread.id,
    type: thread.type,
    title: thread.title,
    directPairKey: thread.directPairKey,
    contextType: thread.contextType ?? null,
    contextExternalId: thread.contextExternalId ?? null,
    createdByUserId: thread.createdByUserId,
    createdAt: thread.createdAt.toISOString(),
    members: members.map((m) => ({
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
      displayName: m.user?.displayName ?? null,
    })),
  };
}

export function toThreadSummary(thread: ThreadEntity): Omit<ThreadDetailDto, "members"> {
  return {
    id: thread.id,
    type: thread.type,
    title: thread.title,
    directPairKey: thread.directPairKey,
    contextType: thread.contextType ?? null,
    contextExternalId: thread.contextExternalId ?? null,
    createdByUserId: thread.createdByUserId,
    createdAt: thread.createdAt.toISOString(),
  };
}
