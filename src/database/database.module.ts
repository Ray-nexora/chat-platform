import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ChatMessageEntity } from "./entities/chat-message.entity";
import { ThreadMemberEntity } from "./entities/thread-member.entity";
import { ThreadEntity } from "./entities/thread.entity";
import { UserEntity } from "./entities/user.entity";
import { ChatMessageRepository } from "./repositories/chat-message.repository";
import { ThreadMemberRepository } from "./repositories/thread-member.repository";
import { ThreadRepository } from "./repositories/thread.repository";
import { UserRepository } from "./repositories/user.repository";

/**
 * Global module: one TypeORM DataSource (singleton) and repository providers.
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: "postgres",
        url: config.getOrThrow<string>("databaseUrl"),
        entities: [UserEntity, ThreadEntity, ThreadMemberEntity, ChatMessageEntity],
        synchronize: false,
        logging: process.env.TYPEORM_LOGGING === "true",
        // Fail fast instead of hanging when Postgres is down or misconfigured (passed to node-pg Pool).
        extra: {
          connectionTimeoutMillis: 10_000,
        },
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([
      UserEntity,
      ThreadEntity,
      ThreadMemberEntity,
      ChatMessageEntity,
    ]),
  ],
  providers: [
    UserRepository,
    ThreadRepository,
    ThreadMemberRepository,
    ChatMessageRepository,
  ],
  exports: [
    TypeOrmModule,
    UserRepository,
    ThreadRepository,
    ThreadMemberRepository,
    ChatMessageRepository,
  ],
})
export class DatabaseModule {}
