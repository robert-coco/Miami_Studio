import { sql } from "drizzle-orm";
import { check, index, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const drafts = sqliteTable("drafts", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  topic: text("topic").notNull(),
  audience: text("audience").notNull(),
  channel: text("channel", { enum: ["LinkedIn", "X"] }).notNull(),
  tone: text("tone", { enum: ["Practical", "Warm", "Bold"] }).notNull(),
  keyPoints: text("key_points").notNull(),
  callToAction: text("call_to_action").notNull().default(""),
  body: text("body").notNull(),
  status: text("status", { enum: ["draft", "reviewed"] }).notNull().default("draft"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("idx_drafts_owner_updated").on(table.ownerId, table.updatedAt),
  check("draft_status", sql`${table.status} in ('draft', 'reviewed')`),
  check("draft_channel", sql`${table.channel} in ('LinkedIn', 'X')`),
  check("draft_tone", sql`${table.tone} in ('Practical', 'Warm', 'Bold')`),
]);
