import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn,
} from "typeorm";
import { ThreadMemberEntity } from "./thread-member.entity";

/** Matches PostgreSQL enum `ThreadType`. */
export enum ThreadTypeColumn {
  direct = "direct",
  group = "group",
}

/** Matches PostgreSQL enum `ThreadContext` — ties a thread to Gateway Hub entities. */
export enum ThreadContextColumn {
  transaction = "transaction",
  dispute = "dispute",
}

@Entity({ name: "threads" })
export class ThreadEntity {
  @PrimaryColumn({ type: "text" })
  id: string;

  @Column({
    type: "enum",
    enum: ThreadTypeColumn,
    enumName: "ThreadType",
  })
  type: ThreadTypeColumn;

  @Column({ type: "text", nullable: true })
  title: string | null;

  /** For direct chats: sorted `userA:userB` — unique so one thread per pair */
  @Column({ name: "direct_pair_key", type: "text", nullable: true, unique: true })
  directPairKey: string | null;

  @Column({ name: "created_by_user_id", type: "text" })
  createdByUserId: string;

  /** When set, thread is the canonical chat for that transaction or dispute in the hub. */
  @Column({
    name: "context_type",
    type: "enum",
    enum: ThreadContextColumn,
    enumName: "ThreadContext",
    nullable: true,
  })
  contextType: ThreadContextColumn | null;

  /** External id from the payments hub (e.g. transaction id, dispute id). */
  @Column({ name: "context_external_id", type: "text", nullable: true })
  contextExternalId: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamp" })
  createdAt: Date;

  /** Many-to-many with users via thread_members */
  @OneToMany(() => ThreadMemberEntity, (m) => m.thread)
  members: ThreadMemberEntity[];
}
