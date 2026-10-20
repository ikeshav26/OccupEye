import { boolean, integer, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const notificationsTable = pgTable("notifications", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  classroomId: varchar("classroom_id", { length: 100 }).notNull(),
  studentCount: integer("student_count").notNull().default(0),
  fanStatus: varchar("fan_status", { length: 20 }).notNull().default("ON"),
  idleSeconds: integer("idle_seconds").notNull(),
  snapshotUrl: text("snapshot_url"),
  cloudinaryPublicId: varchar("cloudinary_public_id", { length: 255 }),
  isResolved: boolean("is_resolved").notNull().default(false),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Notification = typeof notificationsTable.$inferSelect;
export type NewNotification = typeof notificationsTable.$inferInsert;
