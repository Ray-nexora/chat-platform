import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import type { OutgoingEvent } from "../types/message";
import { REDIS_PUBLISHER } from "./redis.tokens";

const CHANNEL_PREFIX = "chat:thread:";

export function threadChannel(threadId: string): string {
  return `${CHANNEL_PREFIX}${threadId}`;
}

/**
 * Pub/sub facade over a singleton publisher {@link REDIS_PUBLISHER}.
 * Subscriber connections are created per WebSocket (Redis requirement).
 */
@Injectable()
export class RedisPubSubService implements OnModuleDestroy {
  private readonly redisUrl: string;

  constructor(
    @Inject(REDIS_PUBLISHER) private readonly pub: Redis,
    private readonly config: ConfigService
  ) {
    this.redisUrl = this.config.getOrThrow<string>("redisUrl");
  }

  async publishThread(threadId: string, event: OutgoingEvent): Promise<void> {
    const payload = JSON.stringify(event);
    await this.pub.publish(threadChannel(threadId), payload);
  }

  /**
   * Isolated subscriber per WebSocket so `message` events are not broadcast to all handlers.
   * Awaits Redis SUBSCRIBE so the first publish after connect is never missed (race with PUBLISH).
   */
  async subscribeThread(
    threadId: string,
    onMessage: (event: OutgoingEvent) => void
  ): Promise<() => Promise<void>> {
    const sub = new Redis(this.redisUrl);
    const ch = threadChannel(threadId);

    const handler = (_channel: string, message: string) => {
      try {
        const parsed = JSON.parse(message) as OutgoingEvent;
        onMessage(parsed);
      } catch {
        /* ignore */
      }
    };

    sub.on("message", handler);
    await sub.subscribe(ch);

    return async () => {
      sub.off("message", handler);
      await sub.unsubscribe(ch);
      await sub.quit();
    };
  }

  async onModuleDestroy(): Promise<void> {
    await this.pub.quit();
  }
}
