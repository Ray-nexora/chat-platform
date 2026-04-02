import { Controller, Get } from "@nestjs/common";
import { KafkaService } from "./kafka/kafka.service";

@Controller()
export class AppController {
  constructor(private readonly kafka: KafkaService) {}

  @Get("health")
  health() {
    return { ok: true, kafka: this.kafka.connected };
  }
}
