import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn,
} from "typeorm";
import { ThreadMemberEntity } from "./thread-member.entity";

@Entity({ name: "users" })
export class UserEntity {
  @PrimaryColumn({ type: "text" })
  id: string;

  @Column({ name: "display_name", type: "text", nullable: true })
  displayName: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamp" })
  createdAt: Date;

  /** Many-to-many with threads via {@link ThreadMemberEntity} */
  @OneToMany(() => ThreadMemberEntity, (m) => m.user)
  threadMemberships: ThreadMemberEntity[];
}
