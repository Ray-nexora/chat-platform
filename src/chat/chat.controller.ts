import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { JwtUser } from "../auth/types";
import { ThreadContextColumn } from "../database/entities/thread.entity";
import { ChatService } from "./chat.service";
import type { ChatMessage, MessageType } from "../types/message";
import type { PostMessageBody } from "./create-message.input";

@Controller("threads")
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get()
  async listThreads(@CurrentUser() user: JwtUser) {
    return this.chat.listThreadsForUser(user.userId);
  }

  @Post("direct")
  @HttpCode(201)
  async createDirect(
    @CurrentUser() user: JwtUser,
    @Body() body: { otherUserId: string; displayName?: string }
  ) {
    if (!body?.otherUserId) {
      throw new BadRequestException("otherUserId required");
    }
    return this.chat.createDirectThread(user.userId, body.otherUserId, body.displayName);
  }

  /**
   * Get or create the chat thread for a Gateway Hub transaction or dispute.
   * Same JWT as other dashboard calls; hub should pass stable external ids from its API.
   */
  @Post("context")
  @HttpCode(201)
  async getOrCreateContext(
    @CurrentUser() user: JwtUser,
    @Body()
    body: {
      contextType: "transaction" | "dispute";
      externalId: string;
      memberIds?: string[];
      title?: string;
      callerDisplayName?: string;
    }
  ) {
    if (!body?.contextType || !body?.externalId?.trim()) {
      throw new BadRequestException("contextType and externalId required");
    }
    if (body.contextType !== "transaction" && body.contextType !== "dispute") {
      throw new BadRequestException("contextType must be transaction or dispute");
    }
    const contextType =
      body.contextType === "dispute"
        ? ThreadContextColumn.dispute
        : ThreadContextColumn.transaction;
    return this.chat.getOrCreateContextThread(user.userId, contextType, body.externalId, {
      memberIds: body.memberIds,
      title: body.title,
      callerDisplayName: body.callerDisplayName,
    });
  }

  @Post("group")
  @HttpCode(201)
  async createGroup(
    @CurrentUser() user: JwtUser,
    @Body() body: { title: string; memberIds: string[]; creatorDisplayName?: string }
  ) {
    if (!body?.title || !Array.isArray(body?.memberIds)) {
      throw new BadRequestException("title and memberIds required");
    }
    const memberIds = [...new Set([...body.memberIds, user.userId])];
    return this.chat.createGroupThread(
      user.userId,
      body.title,
      memberIds,
      body.creatorDisplayName
    );
  }

  @Get(":threadId/messages")
  async listMessages(
    @CurrentUser() user: JwtUser,
    @Param("threadId") threadId: string,
    @Query("limit") limitRaw?: string,
    @Query("cursor") cursor?: string
  ) {
    const limit = Math.min(Number(limitRaw) || 100, 500);
    return this.chat.listMessages(threadId, limit, user.userId, cursor);
  }

  @Post(":threadId/messages")
  @HttpCode(201)
  async postMessage(
    @CurrentUser() user: JwtUser,
    @Param("threadId") threadId: string,
    @Body()
    body: Partial<{
      type: MessageType;
      text: string;
      attachments: PostMessageBody["attachments"];
      linkPreview: ChatMessage["linkPreview"];
    }>
  ) {
    const input: PostMessageBody = {
      type: body.type,
      text: body.text,
      attachments: body.attachments,
      linkPreview: body.linkPreview,
    };

    return this.chat.createMessage(threadId, user.userId, input);
  }

  /**
   * Polling fallback when the client has no WebSocket: active typers stored in Redis (short TTL).
   * Response shape matches Gateway Hub: `{ userIds: string[] }`.
   */
  @Get(":threadId/typing")
  async getTyping(
    @CurrentUser() user: JwtUser,
    @Param("threadId") threadId: string
  ) {
    return this.chat.listTypingUserIds(threadId, user.userId);
  }

  /**
   * REST typing indicator (same effect as WebSocket `{ type: "typing", typing }`).
   * Body: `{ "typing": true | false }`.
   */
  @Post(":threadId/typing")
  @HttpCode(204)
  async postTyping(
    @CurrentUser() user: JwtUser,
    @Param("threadId") threadId: string,
    @Body() body: { typing?: boolean }
  ) {
    await this.chat.setTyping(threadId, user.userId, Boolean(body?.typing));
  }

  @Get(":threadId")
  async getThread(
    @CurrentUser() user: JwtUser,
    @Param("threadId") threadId: string
  ) {
    return this.chat.getThread(threadId, user.userId);
  }

  @Post(":threadId/members")
  @HttpCode(201)
  async addMember(
    @CurrentUser() user: JwtUser,
    @Param("threadId") threadId: string,
    @Body() body: { userId: string }
  ) {
    if (!body?.userId) {
      throw new BadRequestException("userId required");
    }
    return this.chat.addMemberToGroup(threadId, user.userId, body.userId);
  }
}
