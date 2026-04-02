import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { DeepPartial } from "typeorm";
import { Repository } from "typeorm";
import { UserEntity } from "../entities/user.entity";

@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repo: Repository<UserEntity>
  ) {}

  async findById(id: string): Promise<UserEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  async ensureExists(id: string, displayName?: string | null): Promise<UserEntity> {
    let user = await this.findById(id);
    if (!user) {
      user = this.repo.create({
        id,
        displayName: displayName ?? null,
      } as DeepPartial<UserEntity>);
      await this.repo.save(user);
    }
    return user;
  }
}
