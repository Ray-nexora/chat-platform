import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type Redis from "ioredis";
import { v4 as uuidv4 } from "uuid";
import { MessageTypeColumn } from "../database/entities/chat-message.entity";
import { MemberRoleColumn } from "../database/entities/thread-member.entity";
import {
  ThreadContextColumn,
  ThreadTypeColumn,
} from "../database/entities/thread.entity";
import { ChatMessageRepository } from "../database/repositories/chat-message.repository";
import { ThreadMemberRepository } from "../database/repositories/thread-member.repository";
import { ThreadRepository } from "../database/repositories/thread.repository";
import { UserRepository } from "../database/repositories/user.repository";
import { KafkaService } from "../kafka/kafka.service";
import { RedisPubSubService } from "../redis/redis-pubsub.service";
import { REDIS_PUBLISHER } from "../redis/redis.tokens";
import type { ChatMessage } from "../types/message";
import { toChatMessage } from "./chat-message.mapper";
import type { CreateMessageInput, PostMessageBody } from "./create-message.input";
import { decodeMessageCursor, encodeMessageCursor } from "./message-cursor";
import { toThreadDetail, toThreadSummary } from "./thread.mapper";

export type { CreateMessageInput, PostMessageBody } from "./create-message.input";

function directPairKey(a: string, b: string): string {
  return [a, b].sort().join(":");
}

const TYPING_PREFIX = "chat:typing:";
const TYPING_TTL_SEC = 5;

@Injectable()
export class ChatService {
  constructor(
    private readonly users: UserRepository,
    private readonly threads: ThreadRepository,
    private readonly members: ThreadMemberRepository,
    private readonly chatMessages: ChatMessageRepository,
    private readonly redis: RedisPubSubService,
    private readonly kafka: KafkaService,
    @Inject(REDIS_PUBLISHER) private readonly redisPublisher: Redis
  ) {}

  private typingKey(threadId: string, userId: string): string {
    return `${TYPING_PREFIX}${threadId}:${userId}`;
  }

  /**
   * Updates Redis typing keys + broadcasts the same shape as WebSocket gateway.
   * Used by REST `POST .../typing` and by {@link ChatGateway} (member already verified there).
   */
  async applyTypingState(
    threadId: string,
    userId: string,
    typing: boolean
  ): Promise<void> {
    const key = this.typingKey(threadId, userId);
    if (typing) {
      await this.redisPublisher.set(key, "1", "EX", TYPING_TTL_SEC);
    } else {
      await this.redisPublisher.del(key);
    }
    await this.redis.publishThread(threadId, {
      event: "typing",
      payload: { threadId, userId, typing },
    });
  }

  /** REST: caller must be a thread member. */
  async setTyping(
    threadId: string,
    userId: string,
    typing: boolean
  ): Promise<void> {
    await this.requireMember(threadId, userId);
    await this.applyTypingState(threadId, userId, typing);
  }

  /** REST: list user ids with active typing (Redis TTL), for polling clients without WebSocket. */
  async listTypingUserIds(
    threadId: string,
    viewerUserId: string
  ): Promise<{ userIds: string[] }> {
    await this.requireMember(threadId, viewerUserId);
    const pattern = `${TYPING_PREFIX}${threadId}:*`;
    const keys = await this.scanKeys(pattern);
    const prefix = `${TYPING_PREFIX}${threadId}:`;
    const userIds = keys
      .map((k) => (k.startsWith(prefix) ? k.slice(prefix.length) : ""))
      .filter(Boolean);
    return { userIds };
  }

  private async scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = "0";
    do {
      const [next, batch] = await this.redisPublisher.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100
      );
      cursor = next;
      keys.push(...batch);
    } while (cursor !== "0");
    return keys;
  }

  async listThreadsForUser(userId: string) {
    const list = await this.members.listThreadsForUser(userId);
    return { userId, threads: list.map(toThreadSummary) };
  }

  async getThread(threadId: string, viewerUserId: string) {
    await this.requireMember(threadId, viewerUserId);
    const thread = await this.threads.findById(threadId);
    if (!thread) throw new NotFoundException("thread not found");
    const memberRows = await this.members.listMembers(threadId);
    return toThreadDetail(thread, memberRows);
  }

  async createDirectThread(userId: string, otherUserId: string, displayName?: string) {
    if (userId === otherUserId) {
      throw new BadRequestException("otherUserId must differ from caller");
    }
    await this.users.ensureExists(userId, displayName);
    await this.users.ensureExists(otherUserId);

    const pairKey = directPairKey(userId, otherUserId);
    const existing = await this.threads.findDirectByPairKey(pairKey);
    if (existing) {
      const memberRows = await this.members.listMembers(existing.id);
      return toThreadDetail(existing, memberRows);
    }

    const id = uuidv4();
    const thread = this.threads.create({
      id,
      type: ThreadTypeColumn.direct,
      title: null,
      directPairKey: pairKey,
      createdByUserId: userId,
      contextType: null,
      contextExternalId: null,
    });
    await this.threads.save(thread);

    await this.members.addMember(id, userId, MemberRoleColumn.member);
    await this.members.addMember(id, otherUserId, MemberRoleColumn.member);

    const t = await this.threads.findById(id);
    const memberRows = await this.members.listMembers(id);
    return toThreadDetail(t ?? thread, memberRows);
  }

  /**
   * One thread per external transaction or dispute id (Gateway Hub).
   * Idempotent: returns existing thread; adds the caller as a member if missing
   * (caller is assumed authorized by the hub for that resource).
   */
  async getOrCreateContextThread(
    callerId: string,
    contextType: ThreadContextColumn,
    externalId: string,
    opts?: {
      memberIds?: string[];
      title?: string;
      callerDisplayName?: string;
    }
  ) {
    const ext = externalId?.trim();
    if (!ext) {
      throw new BadRequestException("externalId required");
    }

    const defaultTitle =
      contextType === ThreadContextColumn.dispute
        ? `Dispute ${ext}`
        : `Transaction ${ext}`;
    const title = opts?.title?.trim() || defaultTitle;

    const existing = await this.threads.findByContext(contextType, ext);
    if (existing) {
      if (!(await this.members.isMember(existing.id, callerId))) {
        await this.users.ensureExists(callerId, opts?.callerDisplayName);
        await this.members.addMember(
          existing.id,
          callerId,
          MemberRoleColumn.member
        );
      }
      const t = await this.threads.findById(existing.id);
      const memberRows = await this.members.listMembers(existing.id);
      return toThreadDetail(t ?? existing, memberRows);
    }

    const unique = [...new Set([callerId, ...(opts?.memberIds ?? [])])];
    if (unique.length < 1) {
      throw new BadRequestException("at least one member required");
    }

    await this.users.ensureExists(callerId, opts?.callerDisplayName);
    for (const uid of unique) {
      if (uid !== callerId) await this.users.ensureExists(uid);
    }

    const id = uuidv4();
    const thread = this.threads.create({
      id,
      type: ThreadTypeColumn.group,
      title,
      directPairKey: null,
      createdByUserId: callerId,
      contextType,
      contextExternalId: ext,
    });
    await this.threads.save(thread);

    for (const uid of unique) {
      const role =
        uid === callerId ? MemberRoleColumn.owner : MemberRoleColumn.member;
      await this.members.addMember(id, uid, role);
    }

    const t = await this.threads.findById(id);
    const memberRows = await this.members.listMembers(id);
    return toThreadDetail(t ?? thread, memberRows);
  }

  async createGroupThread(
    creatorId: string,
    title: string,
    memberIds: string[],
    creatorDisplayName?: string
  ) {
    const unique = [...new Set(memberIds)];
    if (!unique.includes(creatorId)) {
      throw new BadRequestException("memberIds must include caller");
    }
    if (unique.length < 2) {
      throw new BadRequestException("group requires at least two members");
    }

    await this.users.ensureExists(creatorId, creatorDisplayName);
    for (const uid of unique) {
      if (uid !== creatorId) await this.users.ensureExists(uid);
    }

    const id = uuidv4();
    const thread = this.threads.create({
      id,
      type: ThreadTypeColumn.group,
      title,
      directPairKey: null,
      createdByUserId: creatorId,
      contextType: null,
      contextExternalId: null,
    });
    await this.threads.save(thread);

    for (const uid of unique) {
      const role =
        uid === creatorId ? MemberRoleColumn.owner : MemberRoleColumn.member;
      await this.members.addMember(id, uid, role);
    }

    const t = await this.threads.findById(id);
    const memberRows = await this.members.listMembers(id);
    return toThreadDetail(t ?? thread, memberRows);
  }

  async addMemberToGroup(threadId: string, actorUserId: string, newUserId: string) {
    const thread = await this.threads.findById(threadId);
    if (!thread) throw new NotFoundException("thread not found");
    if (thread.type !== ThreadTypeColumn.group) {
      throw new BadRequestException("only group threads accept new members");
    }

    const actor = await this.members.findMembership(threadId, actorUserId);
    if (!actor || (actor.role !== MemberRoleColumn.owner && actor.role !== MemberRoleColumn.admin)) {
      throw new ForbiddenException("not allowed to add members");
    }

    if (await this.members.isMember(threadId, newUserId)) {
      throw new BadRequestException("user already in thread");
    }

    await this.users.ensureExists(newUserId);
    await this.members.addMember(threadId, newUserId, MemberRoleColumn.member);

    const memberRows = await this.members.listMembers(threadId);
    const t = await this.threads.findById(threadId);
    return toThreadDetail(t ?? thread, memberRows);
  }

  async listMessages(
    threadId: string,
    limit: number,
    viewerUserId: string,
    cursorRaw?: string
  ): Promise<{
    threadId: string;
    messages: ChatMessage[];
    nextCursor: string | null;
  }> {
    await this.requireMember(threadId, viewerUserId);

    let cursor: { id: string; createdAt: Date } | undefined;
    if (cursorRaw) {
      const decoded = decodeMessageCursor(cursorRaw);
      if (!decoded) throw new BadRequestException("invalid cursor");
      cursor = decoded;
    }

    const rows = await this.chatMessages.findByThreadIdPaginated(
      threadId,
      limit,
      cursor
    );

    const chronological = rows.slice().reverse().map(toChatMessage);

    const nextCursor =
      rows.length === limit && rows.length > 0
        ? encodeMessageCursor({
            id: rows[rows.length - 1].id,
            createdAt: rows[rows.length - 1].createdAt,
          })
        : null;

    return { threadId, messages: chronological, nextCursor };
  }

  async createMessage(
    threadId: string,
    senderId: string,
    input: PostMessageBody
  ): Promise<ChatMessage> {
    await this.requireMember(threadId, senderId);

    const columnType = (input.type ?? "text") as MessageTypeColumn;

    const full: CreateMessageInput = {
      senderId,
      type: input.type,
      text: input.text,
      attachments: input.attachments,
      linkPreview: input.linkPreview,
    };

    const row = this.chatMessages.createForThread(threadId, {
      id: uuidv4(),
      senderId,
      type: columnType,
      text: full.text ?? null,
      attachments: full.attachments ?? null,
      linkPreview: full.linkPreview ?? null,
    });

    const saved = await this.chatMessages.save(row);
    const msg = toChatMessage(saved);

    await this.redis.publishThread(threadId, { event: "message", payload: msg });
    await this.kafka.publishChatEvent(msg).catch(() => {});

    return msg;
  }

  private async requireMember(threadId: string, userId: string): Promise<void> {
    const ok = await this.members.isMember(threadId, userId);
    if (!ok) throw new ForbiddenException("not a member of this thread");
  }
}
