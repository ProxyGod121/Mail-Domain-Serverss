import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const emailsTable = pgTable("emails", {
  id: serial("id").primaryKey(),
  fromUserId: integer("from_user_id"),
  fromEmail: text("from_email").notNull(),
  fromName: text("from_name").notNull(),
  toUserId: integer("to_user_id"),
  toEmail: text("to_email").notNull(),
  toName: text("to_name").notNull().default(""),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  folder: text("folder").notNull().default("inbox"),
  isRead: boolean("is_read").notNull().default(false),
  isStarred: boolean("is_starred").notNull().default(false),
  isDraft: boolean("is_draft").notNull().default(false),
  replyToId: integer("reply_to_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEmailSchema = createInsertSchema(emailsTable).omit({ id: true, createdAt: true });
export type InsertEmail = z.infer<typeof insertEmailSchema>;
export type Email = typeof emailsTable.$inferSelect;
