/**
 * Read chat events from Kafka (debug). Run: npm run kafka:tail
 */
import "dotenv/config";
import { Kafka, logLevel } from "kafkajs";
import configuration from "../src/config/configuration";

const config = configuration();

const kafka = new Kafka({
  clientId: "chat-platform-tail",
  brokers: config.kafkaBrokers,
  logLevel: logLevel.NOTHING,
});

const consumer = kafka.consumer({ groupId: "chat-platform-tail-" + Date.now() });

async function main(): Promise<void> {
  await consumer.connect();
  await consumer.subscribe({ topic: config.kafkaTopic, fromBeginning: false });
  await consumer.run({
    eachMessage: async ({ message }) => {
      const v = message.value?.toString();
      if (v) console.log(v);
    },
  });
}

main().catch(console.error);
