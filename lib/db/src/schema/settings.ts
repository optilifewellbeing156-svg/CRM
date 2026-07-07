import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Simple key/value store for global app settings.
 * Values are stored as text; callers coerce to the type they need
 * (e.g. "true"/"false" for booleans).
 */
export const appSettingsTable = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
