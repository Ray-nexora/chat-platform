import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { RedisPubSubService } from "./redis-pubsub.service";
import { REDIS_PUBLISHER } from "./redis.tokens";

/**
 * Global module: one {@link REDIS_PUBLISHER} (singleton) per process.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_PUBLISHER,
      useFactory: (config: ConfigService) => {
        const url = config.getOrThrow<string>("redisUrl");
        return new Redis(url);
      },
      inject: [ConfigService],
    },
    RedisPubSubService,
  ],
  exports: [REDIS_PUBLISHER, RedisPubSubService],
})
export class RedisModule {}
