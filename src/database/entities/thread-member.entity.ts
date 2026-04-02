import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from "typeorm";
import { ThreadEntity } from "./thread.entity";
import { UserEntity } from "./user.entity";

/** Matches PostgreSQL enum `MemberRole`. */
export enum MemberRoleColumn {
  owner = "owner",
  admin = "admin",
  member = "member",
}

@Entity({ name: "thread_members" })
export class ThreadMemberEntity {
  @PrimaryColumn({ name: "thread_id", type: "text" })
  threadId: string;

  @PrimaryColumn({ name: "user_id", type: "text" })
  userId: string;

  @ManyToOne(() => ThreadEntity, (t) => t.members, { onDelete: "CASCADE" })
  @JoinColumn({ name: "thread_id" })
  thread: ThreadEntity;

  @ManyToOne(() => UserEntity, (u) => u.threadMemberships, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: UserEntity;

  @Column({
    type: "enum",
    enum: MemberRoleColumn,
    enumName: "MemberRole",
  })
  role: MemberRoleColumn;

  @CreateDateColumn({ name: "joined_at", type: "timestamp" })
  joinedAt: Date;
}
