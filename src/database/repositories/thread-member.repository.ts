import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { DeepPartial } from "typeorm";
import { Repository } from "typeorm";
import { ThreadEntity } from "../entities/thread.entity";
import {
  MemberRoleColumn,
  ThreadMemberEntity,
} from "../entities/thread-member.entity";

@Injectable()
export class ThreadMemberRepository {
  constructor(
    @InjectRepository(ThreadMemberEntity)
    private readonly repo: Repository<ThreadMemberEntity>
  ) {}

  async isMember(threadId: string, userId: string): Promise<boolean> {
    const n = await this.repo.count({ where: { threadId, userId } });
    return n > 0;
  }

  async findMembership(
    threadId: string,
    userId: string
  ): Promise<ThreadMemberEntity | null> {
    return this.repo.findOne({ where: { threadId, userId } });
  }

  async listThreadsForUser(userId: string): Promise<ThreadEntity[]> {
    const rows = await this.repo
      .createQueryBuilder("tm")
      .innerJoinAndSelect("tm.thread", "t")
      .where("tm.userId = :userId", { userId })
      .orderBy("t.createdAt", "DESC")
      .getMany();
    return rows.map((r) => r.thread);
  }

  async listMembers(threadId: string): Promise<ThreadMemberEntity[]> {
    return this.repo.find({
      where: { threadId },
      relations: ["user"],
      order: { joinedAt: "ASC" },
    });
  }

  create(data: DeepPartial<ThreadMemberEntity>): ThreadMemberEntity {
    return this.repo.create(data);
  }

  async save(entity: ThreadMemberEntity): Promise<ThreadMemberEntity> {
    return this.repo.save(entity);
  }

  async addMember(
    threadId: string,
    userId: string,
    role: MemberRoleColumn
  ): Promise<ThreadMemberEntity> {
    const row = this.repo.create({ threadId, userId, role });
    return this.repo.save(row);
  }
}
