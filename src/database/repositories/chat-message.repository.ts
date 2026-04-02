import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { DeepPartial } from "typeorm";
import { Repository } from "typeorm";
import { ChatMessageEntity } from "../entities/chat-message.entity";
import { ThreadEntity } from "../entities/thread.entity";

/**
 * Data-access layer for chat messages. TypeORM {@link Repository} is scoped as a Nest singleton.
 */
@Injectable()
export class ChatMessageRepository {
  constructor(
    @InjectRepository(ChatMessageEntity)
    private readonly repo: Repository<ChatMessageEntity>
  ) {}

  async findByThreadId(threadId: string, limit: number): Promise<ChatMessageEntity[]> {
    const take = Math.min(limit, 500);
    return this.repo.find({
      where: { thread: { id: threadId } },
      order: { createdAt: "DESC" },
      take,
    });
  }

  /**
   * Newest-first page. Optional cursor = oldest boundary from previous page
   * (fetch messages strictly older than cursor in sort order).
   */
  async findByThreadIdPaginated(
    threadId: string,
    limit: number,
    cursor?: { id: string; createdAt: Date }
  ): Promise<ChatMessageEntity[]> {
    const take = Math.min(limit, 500);
    const qb = this.repo
      .createQueryBuilder("m")
      .innerJoin("m.thread", "t")
      .where("t.id = :threadId", { threadId })
      .orderBy("m.createdAt", "DESC")
      .addOrderBy("m.id", "DESC")
      .take(take);
    if (cursor) {
      qb.andWhere(
        "(m.createdAt < :cAt OR (m.createdAt = :cAt AND m.id < :cId))",
        { cAt: cursor.createdAt, cId: cursor.id }
      );
    }
    return qb.getMany();
  }

  create(data: DeepPartial<ChatMessageEntity>): ChatMessageEntity {
    return this.repo.create(data);
  }

  async save(entity: ChatMessageEntity): Promise<ChatMessageEntity> {
    return this.repo.save(entity);
  }

  /** Attach message to an existing thread by id (many-to-one). */
  createForThread(
    threadId: string,
    data: Omit<DeepPartial<ChatMessageEntity>, "thread">
  ): ChatMessageEntity {
    return this.repo.create({
      ...data,
      thread: { id: threadId } as ThreadEntity,
    });
  }
}
