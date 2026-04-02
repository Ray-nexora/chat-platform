import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  RelationId,
} from "typeorm";
import { ThreadEntity } from "./thread.entity";

/** Matches PostgreSQL enum `MessageType` (see Knex migrations). */
export enum MessageTypeColumn {
  text = "text",
  emoji = "emoji",
  gif = "gif",
  image = "image",
  video = "video",
  audio = "audio",
  file = "file",
  link_preview = "link_preview",
}

@Entity({ name: "chat_messages" })
export class ChatMessageEntity {
  @PrimaryColumn({ type: "text" })
  id: string;

  /** Many-to-one: thread has many messages */
  @ManyToOne(() => ThreadEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "thread_id" })
  thread: ThreadEntity;

  @RelationId((m: ChatMessageEntity) => m.thread)
  threadId: string;

  @Column({ name: "sender_id" })
  senderId: string;

  @Column({
    type: "enum",
    enum: MessageTypeColumn,
    enumName: "MessageType",
  })
  type: MessageTypeColumn;

  @Column({ type: "text", nullable: true })
  text: string | null;

  @Column({ type: "jsonb", nullable: true })
  attachments: unknown;

  @Column({ name: "link_preview", type: "jsonb", nullable: true })
  linkPreview: unknown;

  @CreateDateColumn({ name: "created_at", type: "timestamp" })
  createdAt: Date;
}
