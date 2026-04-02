import type { Knex } from "knex";

/**
 * Gateway Hub–style threads: one chat per external transaction or dispute id.
 * Uses `type = group` with optional context columns (unique per context + external id).
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    DO $$ BEGIN
      CREATE TYPE "ThreadContext" AS ENUM ('transaction', 'dispute');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);

  const hasCol = await knex.schema.hasColumn("threads", "context_type");
  if (!hasCol) {
    await knex.schema.alterTable("threads", (t) => {
      t.specificType("context_type", '"ThreadContext"');
      t.text("context_external_id");
    });
  }

  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS threads_context_external_unique
    ON threads (context_type, context_external_id)
    WHERE context_type IS NOT NULL AND context_external_id IS NOT NULL
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX IF EXISTS threads_context_external_unique`);
  const hasCol = await knex.schema.hasColumn("threads", "context_type");
  if (hasCol) {
    await knex.schema.alterTable("threads", (t) => {
      t.dropColumn("context_external_id");
      t.dropColumn("context_type");
    });
  }
  await knex.raw(`DROP TYPE IF EXISTS "ThreadContext"`);
}
