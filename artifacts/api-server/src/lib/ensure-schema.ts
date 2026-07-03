import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

/**
 * Lightweight, idempotent additive migrations run once at server startup.
 *
 * This deployment has no separate migration step (the Render build only
 * installs + bundles), so additive schema changes are applied here with
 * `ADD COLUMN IF NOT EXISTS`, which is safe to run on every boot and never
 * touches existing data. Keep statements strictly additive and idempotent.
 */
export async function ensureSchema(): Promise<void> {
  await db.execute(sql`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS postage numeric(10, 2) NOT NULL DEFAULT 0
  `);
  logger.info("Schema ensured (additive migrations applied)");
}
