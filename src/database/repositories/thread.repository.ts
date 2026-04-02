import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { DeepPartial } from "typeorm";
import { Repository } from "typeorm";
import {
  ThreadContextColumn,
  ThreadEntity,
  ThreadTypeColumn,
} from "../entities/thread.entity";

@Injectable()
export class ThreadRepository {
  constructor(
    @InjectRepository(ThreadEntity)
    private readonly repo: Repository<ThreadEntity>
  ) {}

  async findById(id: string): Promise<ThreadEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findDirectByPairKey(pairKey: string): Promise<ThreadEntity | null> {
    return this.repo.findOne({
      where: { directPairKey: pairKey, type: ThreadTypeColumn.direct },
    });
  }

  async findByContext(
    contextType: ThreadContextColumn,
    externalId: string
  ): Promise<ThreadEntity | null> {
    return this.repo.findOne({
      where: {
        contextType,
        contextExternalId: externalId,
      },
    });
  }

  create(data: DeepPartial<ThreadEntity>): ThreadEntity {
    return this.repo.create(data);
  }

  async save(entity: ThreadEntity): Promise<ThreadEntity> {
    return this.repo.save(entity);
  }
}
