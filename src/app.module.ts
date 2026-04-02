import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import configuration from "./config/configuration";
import { AppController } from "./app.controller";
import { ChatModule } from "./chat/chat.module";
import { DatabaseModule } from "./database/database.module";
import { UploadsModule } from "./uploads/uploads.module";
import { KafkaModule } from "./kafka/kafka.module";
import { RedisModule } from "./redis/redis.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    DatabaseModule,
    RedisModule,
    KafkaModule,
    AuthModule,
    ChatModule,
    UploadsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
