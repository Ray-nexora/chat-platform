import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    DO $$ BEGIN
      CREATE TYPE "ThreadType" AS ENUM ('direct', 'group');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);

  await knex.raw(`
    DO $$ BEGIN
      CREATE TYPE "MemberRole" AS ENUM ('owner', 'admin', 'member');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);

  if (!(await knex.schema.hasTable("users"))) {
    await knex.schema.createTable("users", (t) => {
      t.text("id").primary();
      t.text("display_name");
      t.timestamp("created_at", { useTz: false }).notNullable().defaultTo(knex.fn.now());
    });
  }

  if (!(await knex.schema.hasTable("threads"))) {
    await knex.schema.createTable("threads", (t) => {
      t.text("id").primary();
      t.specificType("type", '"ThreadType"').notNullable();
      t.text("title");
      t.text("direct_pair_key").unique();
      t.text("created_by_user_id").notNullable().references("id").inTable("users");
      t.timestamp("created_at", { useTz: false }).notNullable().defaultTo(knex.fn.now());
    });
  }

  if (!(await knex.schema.hasTable("thread_members"))) {
    await knex.schema.createTable("thread_members", (t) => {
      t.text("thread_id").notNullable().references("id").inTable("threads").onDelete("CASCADE");
      t.text("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
      t.specificType("role", '"MemberRole"').notNullable();
      t.timestamp("joined_at", { useTz: false }).notNullable().defaultTo(knex.fn.now());
      t.primary(["thread_id", "user_id"]);
    });
  }

  await knex.raw(
    `CREATE INDEX IF NOT EXISTS thread_members_user_id_idx ON thread_members (user_id)`
  );

  await backfillLegacyThreads(knex);

  await knex.raw(`
    DO $$ BEGIN
      ALTER TABLE chat_messages
      ADD CONSTRAINT chat_messages_thread_id_fkey
      FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);
}

/**
 * If messages exist from before threads existed, create users/threads/members so FK can apply.
 */
async function backfillLegacyThreads(knex: Knex): Promise<void> {
  const hasMessages = await knex.schema.hasTable("chat_messages");
  if (!hasMessages) return;

  const orphan = await knex.raw<{ rows: { c: string }[] }>(
    `SELECT COUNT(*)::text AS c FROM chat_messages cm
     LEFT JOIN threads t ON t.id = cm.thread_id
     WHERE t.id IS NULL`
  );
  if (orphan.rows[0]?.c === "0") return;

  await knex.raw(`
    INSERT INTO users (id)
    SELECT DISTINCT sender_id FROM chat_messages
    ON CONFLICT (id) DO NOTHING
  `);

  await knex.raw(`
    INSERT INTO threads (id, type, title, direct_pair_key, created_by_user_id)
    SELECT DISTINCT ON (m.thread_id)
      m.thread_id,
      'group'::"ThreadType",
      'Legacy thread',
      NULL,
      (SELECT sender_id FROM chat_messages x WHERE x.thread_id = m.thread_id ORDER BY created_at ASC LIMIT 1)
    FROM chat_messages m
    ON CONFLICT (id) DO NOTHING
  `);

  await knex.raw(`
    INSERT INTO thread_members (thread_id, user_id, role)
    SELECT DISTINCT m.thread_id, m.sender_id, 'member'::"MemberRole"
    FROM chat_messages m
    ON CONFLICT (thread_id, user_id) DO NOTHING
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(
    `ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_thread_id_fkey`
  );
  await knex.schema.dropTableIfExists("thread_members");
  await knex.schema.dropTableIfExists("threads");
  await knex.schema.dropTableIfExists("users");
  await knex.raw(`DROP TYPE IF EXISTS "MemberRole"`);
  await knex.raw(`DROP TYPE IF EXISTS "ThreadType"`);
}
