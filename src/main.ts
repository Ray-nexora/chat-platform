import "reflect-metadata";
import { Logger, RequestMethod } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { WsAdapter } from "@nestjs/platform-ws";
import { json } from "express";
import type { NextFunction, Request, Response } from "express";
import { join } from "path";
import { AppModule } from "./app.module";

function requestLoggingMiddleware(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const line = `${req.method} ${req.originalUrl || req.url}`;
    logger.log(`→ ${line}`);
    res.on("finish", () => {
      logger.log(`← ${line} ${res.statusCode} ${Date.now() - start}ms`);
    });
    next();
  };
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  const httpLogger = new Logger("HTTP");
  app.use(requestLoggingMiddleware(httpLogger));

  app.use(json({ limit: "12mb" }));
  app.useWebSocketAdapter(new WsAdapter(app));
  app.enableCors();
  app.setGlobalPrefix("api", {
    exclude: [{ path: "health", method: RequestMethod.GET }],
  });

  app.useStaticAssets(join(__dirname, "..", "public"));

  const config = app.get(ConfigService);
  const port = config.get<number>("port") ?? 6000;
  await app.listen(port);
  console.log(`[http] http://127.0.0.1:${port}`);
  console.log(`[auth] POST http://127.0.0.1:${port}/api/auth/token  body: {"userId":"..."}`);
  console.log(`[ws]   ws://127.0.0.1:${port}/ws?threadId=demo&token=JWT`);
}

bootstrap().catch((e) => {
  console.error(e);
  process.exit(1);
});
