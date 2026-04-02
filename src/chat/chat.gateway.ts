import { Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { IncomingMessage } from "http";
import type { RawData } from "ws";
import { WebSocket, type Server } from "ws";
import { ChatService } from "./chat.service";
import { ThreadMemberRepository } from "../database/repositories/thread-member.repository";
import { RedisPubSubService } from "../redis/redis-pubsub.service";
import type { OutgoingEvent } from "../types/message";

interface ClientMeta {
  threadId: string;
  userId: string;
  unsubscribe: () => Promise<void>;
}

/**
 * WebSocket URL: ws://host/ws?threadId=T1&token=JWT
 * User id is taken from the JWT `sub` claim (same as REST Bearer auth).
 */
@WebSocketGateway({ path: "/ws" })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server: Server;

  private readonly meta = new WeakMap<WebSocket, ClientMeta>();

  constructor(
    private readonly redis: RedisPubSubService,
    private readonly jwt: JwtService,
    private readonly members: ThreadMemberRepository,
    private readonly chat: ChatService
  ) {}

  async handleConnection(client: WebSocket, req: IncomingMessage): Promise<void> {
    try {
      const url = new URL(req.url ?? "", "http://localhost");
      const threadId = url.searchParams.get("threadId");
      const token = url.searchParams.get("token");
      if (!threadId || !token) {
        client.close(4000, "threadId and token required");
        return;
      }

      let userId: string;
      try {
        const payload = this.jwt.verify<{ sub: string }>(token);
        userId = payload.sub;
      } catch {
        client.close(4001, "invalid or expired token");
        return;
      }

      const allowed = await this.members.isMember(threadId, userId);
      if (!allowed) {
        client.close(4003, "not a member of this thread");
        return;
      }

      const unsubscribe = await this.redis.subscribeThread(
        threadId,
        (event: OutgoingEvent) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(event));
          }
        }
      );

      this.meta.set(client, { threadId, userId, unsubscribe });

      client.on("message", (data: RawData) => {
        try {
          const raw = JSON.parse(String(data)) as {
            type?: string;
            event?: string;
            action?: string;
            typing?: boolean;
          };
          const isTyping =
            raw.type === "typing" ||
            raw.event === "typing" ||
            raw.action === "typing" ||
            typeof raw.typing === "boolean";
          if (isTyping) {
            void this.chat.applyTypingState(
              threadId,
              userId,
              Boolean(raw.typing)
            );
          }
        } catch {
          /* ignore */
        }
      });
    } catch (e) {
      this.logger.warn(e instanceof Error ? e.message : String(e));
      client.close(4000, "bad request");
    }
  }

  handleDisconnect(client: WebSocket): void {
    const m = this.meta.get(client);
    if (m) void m.unsubscribe();
    this.meta.delete(client);
  }
}
