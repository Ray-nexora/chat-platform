import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    DO $$ BEGIN
      CREATE TYPE "MessageType" AS ENUM (
        'text', 'emoji', 'gif', 'image', 'video', 'audio', 'file', 'link_preview'
      );
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);

  const hasTable = await knex.schema.hasTable("chat_messages");
  if (!hasTable) {
    await knex.schema.createTable("chat_messages", (table) => {
      table.text("id").primary();
      table.text("thread_id").notNullable();
      table.text("sender_id").notNullable();
      table.specificType("type", '"MessageType"').notNullable();
      table.text("text");
      table.jsonb("attachments");
      table.jsonb("link_preview");
      table.timestamp("created_at", { useTz: false }).notNullable().defaultTo(knex.fn.now());
    });
  }

  await knex.raw(
    `CREATE INDEX IF NOT EXISTS chat_messages_thread_id_created_at_idx ON chat_messages (thread_id, created_at)`
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("chat_messages");
  await knex.raw(`DROP TYPE IF EXISTS "MessageType"`);
}
