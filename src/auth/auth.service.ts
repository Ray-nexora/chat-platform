import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import type { SignOptions } from "jsonwebtoken";
import { UserRepository } from "../database/repositories/user.repository";

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly users: UserRepository
  ) {}

  async issueToken(userId: string, displayName?: string | null) {
    await this.users.ensureExists(userId, displayName ?? undefined);
    const expiresIn = (this.config.get<string>("jwtExpiresIn") ?? "7d") as NonNullable<
      SignOptions["expiresIn"]
    >;
    const accessToken = await this.jwt.signAsync({ sub: userId }, { expiresIn });
    return {
      accessToken,
      tokenType: "Bearer" as const,
      expiresIn,
    };
  }
}
