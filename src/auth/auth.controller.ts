import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
} from "@nestjs/common";
import { AuthService } from "./auth.service";

/**
 * Dev-oriented token issuance. Replace with password/OAuth login in production.
 */
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("token")
  @HttpCode(201)
  async token(
    @Body() body: { userId: string; displayName?: string | null }
  ) {
    if (!body?.userId || typeof body.userId !== "string") {
      throw new BadRequestException("userId required");
    }
    return this.auth.issueToken(body.userId, body.displayName);
  }
}
