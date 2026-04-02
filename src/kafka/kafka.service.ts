import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Kafka, logLevel, type Producer } from "kafkajs";
import type { ChatMessage } from "../types/message";

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private producer: Producer | null = null;
  private kafkaOk = false;

  constructor(private readonly config: ConfigService) {}

  get connected(): boolean {
    return this.kafkaOk;
  }

  async onModuleInit(): Promise<void> {
    const enabled = this.config.get<boolean>("kafkaEnabled", { infer: true });
    if (!enabled) {
      this.logger.warn("Kafka disabled (KAFKA_ENABLED=false)");
      return;
    }

    const brokers = this.config.getOrThrow<string[]>("kafkaBrokers");
    const topic = this.config.getOrThrow<string>("kafkaTopic");

    const kafka = new Kafka({
      clientId: "chat-platform",
      brokers,
      logLevel: logLevel.NOTHING,
    });

    this.producer = kafka.producer();
    try {
      await this.producer.connect();
      const admin = kafka.admin();
      await admin.connect();
      try {
        await admin.createTopics({
          topics: [{ topic, numPartitions: 3, replicationFactor: 1 }],
          waitForLeaders: true,
        });
      } catch {
        /* topic may already exist */
      }
      await admin.disconnect();
      this.kafkaOk = true;
      this.logger.log(`Kafka connected, topic: ${topic}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`Kafka not available: ${msg}`);
      await this.producer.disconnect().catch(() => {});
      this.producer = null;
      this.kafkaOk = false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.producer) {
      await this.producer.disconnect();
      this.producer = null;
    }
  }

  async publishChatEvent(message: ChatMessage): Promise<void> {
    if (!this.producer) return;

    const topic = this.config.getOrThrow<string>("kafkaTopic");
    const key = message.threadId;
    const value = JSON.stringify({
      type: "MessageSent",
      occurredAt: message.createdAt,
      message,
    });

    await this.producer.send({
      topic,
      messages: [{ key, value }],
    });
  }
}
