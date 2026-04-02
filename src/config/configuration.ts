export default () => ({
  port: parseInt(process.env.PORT ?? "6000", 10),
  databaseUrl: process.env.DATABASE_URL ?? "",
  redisUrl: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  kafkaBrokers: (process.env.KAFKA_BROKERS || "127.0.0.1:19092")
    .split(",")
    .map((s) => s.trim()),
  kafkaTopic: process.env.KAFKA_TOPIC_CHAT_EVENTS || "chat.events",
  kafkaEnabled: process.env.KAFKA_ENABLED !== "false",
  jwtSecret: process.env.JWT_SECRET ?? "dev-only-change-JWT_SECRET-in-production",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
});
